import json, time
from .support import guard, next_record, quote, scalar


def fixture(sql):
    values = json.loads(scalar(sql, "select jsonb_build_object('intent',gen_random_uuid(),'leg',gen_random_uuid(),'issued',floor(extract(epoch from date_trunc('milliseconds',clock_timestamp()))*1000)::bigint);"))
    sql("insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,expires_at) values(" + quote(values['intent']) + ",'add_existing',gen_random_uuid(),gen_random_uuid(),decode(repeat('11',32),'hex'),clock_timestamp()+interval '9 minutes');"
        "insert into kaq_private.account_proof_legs(id,intent_id,side,attempt,storage_key,ingest_nonce_hash,issued_at,expires_at) values(" + quote(values['leg']) + ',' + quote(values['intent']) + ",'source',1," + quote(f"kaq-proof:{values['intent']}:{values['leg']}:1") + ",decode(repeat('22',32),'hex'),date_trunc('milliseconds',clock_timestamp()),clock_timestamp()+interval '2 minutes');")
    row = json.loads(scalar(sql, "select jsonb_build_object('issued',kaq_private.runtime_epoch_ms(proof_leg.issued_at),'expires',kaq_private.runtime_epoch_ms(proof_leg.expires_at),'intentExpires',kaq_private.runtime_epoch_ms(intent.expires_at)) from kaq_private.account_proof_legs proof_leg join kaq_private.account_intents intent on intent.id=proof_leg.intent_id where proof_leg.id=" + quote(values['leg']) + ';'))
    values.update(row); return values


def initial_cas_sql(value):
    g = quote(guard(value['intent'], value['leg'], value['issued'], value['expires']))
    n = quote(next_record(0, value['expires']))
    return "select kaq_private.runtime_compare_and_swap(" + quote(value['leg']) + ",null," + n + "::jsonb," + g + "::jsonb);"


def blocking(connections):
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        observed = connections.graph()
        if any(row['blockers'] for row in observed): return observed
    raise RuntimeError('expected pg_blocking_pids evidence')


def concurrent_initial(env):
    sql, c = env['sql'], env['connections']; value = fixture(sql)
    holder = c.open('runtime_initial_holder'); holder.send('begin; select id from kaq_private.account_proof_legs where id=' + quote(value['leg']) + " for update; select 'runtime_lock_held';"); holder.wait('runtime_lock_held')
    left, right = c.open('runtime_initial_left'), c.open('runtime_initial_right')
    left.send(initial_cas_sql(value) + "select 'runtime_initial_left_done';"); right.send(initial_cas_sql(value) + "select 'runtime_initial_right_done';"); blocked = blocking(c); holder.finish('commit')
    left.wait('runtime_initial_left_done'); right.wait('runtime_initial_right_done')
    outcomes = [line for line in left.lines + right.lines if line in {'t', 'f'}]
    if outcomes.count('t') != 1 or outcomes.count('f') != 1: raise RuntimeError('initial CAS did not elect one winner')
    if scalar(sql, 'select count(*) from kaq_private.account_proof_runtime where leg_id=' + quote(value['leg']) + ';') != '1': raise RuntimeError('initial CAS row count')
    sql('delete from kaq_private.account_intents where id=' + quote(value['intent']) + ';')
    return {'blocking': blocked, 'winners': 1, 'losers': 1}


def revision_race(env):
    sql, c = env['sql'], env['connections']; value = fixture(sql);
    if scalar(sql, initial_cas_sql(value)) != 't': raise RuntimeError('race setup failed')
    g, n = quote(guard(value['intent'], value['leg'], value['issued'], value['expires'])), quote(next_record(1, value['expires'], 'ef'))
    holder = c.open('runtime_revision_holder'); holder.send('begin; select leg_id from kaq_private.account_proof_runtime where leg_id=' + quote(value['leg']) + " for update; select 'runtime_revision_held';"); holder.wait('runtime_revision_held')
    left, right = c.open('runtime_revision_left'), c.open('runtime_revision_right')
    call = "select kaq_private.runtime_compare_and_swap(" + quote(value['leg']) + ',0,' + n + '::jsonb,' + g + '::jsonb);'
    left.send(call + "select 'runtime_revision_left_done';"); right.send(call + "select 'runtime_revision_right_done';"); blocked = blocking(c); holder.finish('commit'); left.wait('runtime_revision_left_done'); right.wait('runtime_revision_right_done')
    outcomes = [line for line in left.lines + right.lines if line in {'t', 'f'}]
    if outcomes.count('t') != 1 or outcomes.count('f') != 1 or scalar(sql, 'select revision from kaq_private.account_proof_runtime where leg_id=' + quote(value['leg']) + ';') != '1': raise RuntimeError('revision CAS race failed')
    sql('delete from kaq_private.account_intents where id=' + quote(value['intent']) + ';')
    return {'blocking': blocked, 'revision': 1}
