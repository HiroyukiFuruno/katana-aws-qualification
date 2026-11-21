from .scenarios import blocking, fixture, initial_cas_sql
from .support import guard, next_record, quote, scalar


def phase_calls(value):
    leg = quote(guard(value['intent'], value['leg'], value['issued'], value['expires']))
    proof = quote(guard(value['intent'], value['leg'], value['issued'], value['intentExpires'], 'proof'))
    promote = "select kaq_private.runtime_promote_proof(" + quote(value['leg']) + ',0,' + leg + '::jsonb,' + proof + '::jsonb,' + quote(next_record(1,value['intentExpires'],'ef')) + '::jsonb);'
    return leg, proof, promote


def phase_fixture(sql):
    value = fixture(sql)
    if scalar(sql, initial_cas_sql(value)) != 't': raise RuntimeError('phase fixture CAS failed')
    sql("update kaq_private.account_proof_legs set state='exchanging' where id=" + quote(value['leg']) + ';')
    return value


def promotion_once(env):
    sql, c = env['sql'], env['connections']; value = phase_fixture(sql); _, _, promote = phase_calls(value)
    holder = c.open('runtime_promotion_holder'); holder.send('begin; select leg_id from kaq_private.account_proof_runtime where leg_id=' + quote(value['leg']) + " for update; select 'runtime_promotion_held';"); holder.wait('runtime_promotion_held')
    left, right = c.open('runtime_promotion_left'), c.open('runtime_promotion_right')
    left.send(promote + "select 'runtime_promotion_left_done';"); right.send(promote + "select 'runtime_promotion_right_done';"); observed = blocking(c); holder.finish('commit')
    left.wait('runtime_promotion_left_done'); right.wait('runtime_promotion_right_done'); outcomes=[x for x in left.lines+right.lines if x in {'t','f'}]
    if outcomes.count('t') != 1 or outcomes.count('f') != 1 or scalar(sql,"select state||':'||revision from kaq_private.account_proof_legs where id="+quote(value['leg'])+';') != 'exchanged:1': raise RuntimeError('promotion did not converge once')
    sql('delete from kaq_private.account_intents where id='+quote(value['intent'])+';'); return {'blocking':observed,'promotions':1,'legRevision':1}


def cleanup_after_promotion(env):
    sql, c = env['sql'], env['connections']; value = phase_fixture(sql); leg, _, promote = phase_calls(value)
    holder=c.open('runtime_cleanup_holder'); holder.send('begin; select leg_id from kaq_private.account_proof_runtime where leg_id='+quote(value['leg'])+" for update; select 'runtime_cleanup_held';"); holder.wait('runtime_cleanup_held')
    promotion, cleanup=c.open('runtime_cleanup_promotion'),c.open('runtime_cleanup_old')
    promotion.send(promote+"select 'runtime_cleanup_promotion_done';"); blocking(c)
    cleanup.send("select kaq_private.runtime_delete_if_revision("+quote(value['leg'])+',0,'+leg+"::jsonb); select 'runtime_cleanup_old_done';")
    observed=blocking(c); holder.finish('commit'); promotion.wait('runtime_cleanup_promotion_done'); cleanup.wait('runtime_cleanup_old_done')
    if 't' not in promotion.lines or 'conflict' not in cleanup.lines or scalar(sql,'select phase from kaq_private.account_proof_runtime where leg_id='+quote(value['leg'])+';') != 'proof': raise RuntimeError('old cleanup removed promoted proof')
    sql('delete from kaq_private.account_intents where id='+quote(value['intent'])+';'); return {'blocking':observed,'promoted':True,'oldCleanup':'conflict'}


def stale_context_race(env):
    sql, c = env['sql'], env['connections']; value=phase_fixture(sql); leg, proof, promote=phase_calls(value)
    if scalar(sql,promote) != 't': raise RuntimeError('stale context setup promotion failed')
    holder=c.open('runtime_stale_holder'); holder.send('begin; select leg_id from kaq_private.account_proof_runtime where leg_id='+quote(value['leg'])+" for update; select 'runtime_stale_held';"); holder.wait('runtime_stale_held')
    old, current=c.open('runtime_stale_old'),c.open('runtime_stale_proof')
    old.send("select kaq_private.runtime_compare_and_swap("+quote(value['leg'])+',1,'+quote(next_record(2,value['expires'],'12'))+'::jsonb,'+leg+"::jsonb); select 'runtime_stale_old_done';")
    current.send("select kaq_private.runtime_compare_and_swap("+quote(value['leg'])+',1,'+quote(next_record(2,value['intentExpires'],'34'))+'::jsonb,'+proof+"::jsonb); select 'runtime_stale_proof_done';")
    observed=blocking(c); holder.finish('commit'); old.wait('runtime_stale_old_done'); current.wait('runtime_stale_proof_done')
    if 'f' not in old.lines or 't' not in current.lines or scalar(sql,'select revision from kaq_private.account_proof_runtime where leg_id='+quote(value['leg'])+';') != '2': raise RuntimeError('stale context race accepted old leg')
    sql('delete from kaq_private.account_intents where id='+quote(value['intent'])+';'); return {'blocking':observed,'oldLegRejected':True,'proofRevision':2}
