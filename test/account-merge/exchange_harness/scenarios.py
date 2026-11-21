import json


def quote(value): return "'" + str(value).replace("'", "''") + "'"


class Cases:
    def __init__(self, env): self.c, self.sql, self.user, self.base, self.n = env['connections'], env['sql'], env['user'], env['baseline'], 0
    def call(self, con, statement):
        self.n += 1; marker, at = 'exchange_reply_' + str(self.n), len(con.lines); con.send('select '+statement+"; select '"+marker+"';"); return marker, at
    def reply(self, con, pending):
        marker, at = pending; con.wait(marker); values=[json.loads(x) for x in con.lines[at:] if x.startswith('{')]
        if len(values) != 1: raise RuntimeError('expected one exchange response')
        return values[0]
    def create(self, con):
        value=self.reply(con,self.call(con,"exchange_harness.capture('begin',null,null,null,null,null,null)"))
        if not value['ok'] or 'secret' not in value['value']: raise RuntimeError('intent creation failed')
        return value['value']
    def ready(self, con):
        value=self.create(con); issued=self.reply(con,self.call(con,"exchange_harness.capture('issue',"+quote(value['id'])+','+quote(value['secret'])+",null,0,null,null,null)"))['value']
        initial=self.reply(con,self.call(con,"exchange_harness.capture('runtime',"+quote(value['id'])+','+quote(value['secret'])+','+quote(issued['leg_id'])+",null,null,null,null)"))
        if not initial['ok']: raise RuntimeError('runtime setup failed')
        return value, issued
    def claim(self, v, leg, revision=0): return "exchange_harness.capture('claim',"+quote(v['id'])+','+quote(v['secret'])+','+quote(leg['leg_id'])+','+str(revision)+',0,null,null)'
    def complete(self, v, leg, claim, revision=1): return "exchange_harness.capture('complete',"+quote(v['id'])+','+quote(v['secret'])+','+quote(leg['leg_id'])+','+str(revision)+',0,'+quote(claim)+',null)'
    def exchange(self, v, leg, revision=2): return "exchange_harness.capture('exchange',"+quote(v['id'])+','+quote(v['secret'])+','+quote(leg['leg_id'])+','+str(revision)+',null,null,null)'
    def fail(self, v, leg, claim, revision, unknown=False): return "exchange_harness.capture('fail',"+quote(v['id'])+','+quote(v['secret'])+','+quote(leg['leg_id'])+','+str(revision)+',null,'+quote(claim)+','+str(unknown).lower()+')'
    def gate(self, label):
        con=self.c.open(label,self.user); con.send("begin; select kaq_private.intent_actor_gate(); select 'gate_held';"); con.wait('gate_held'); return con
    def lock(self, label, table, leg):
        con=self.c.open(label); con.send("begin; select leg_id from kaq_private."+table+' where leg_id='+quote(leg)+" for update; select 'row_held';"); con.wait('row_held'); return con
    def clear(self):
        self.sql('delete from kaq_private.account_intents where actor_uid='+quote(self.user['userId']))
        if json.loads(self.sql('select exchange_harness.snapshot();')) != self.base: raise RuntimeError('exchange baseline differs')
    def live_wait(self, deadline, intent):
        live=json.loads(self.sql("select jsonb_build_object('before',clock_timestamp()<"+quote(deadline)+"::timestamptz,'active',state='awaiting_source') from kaq_private.account_intents where id="+quote(intent)))
        if not live['before'] or not live['active']: raise RuntimeError('expiry barrier was not observed before deadline')


def authorization_claim(env):
    s=Cases(env); maker=s.c.open('authorization_maker',s.user); v,leg=s.ready(maker); gate=s.gate('authorization_gate'); a,b=s.c.open('authorization_a',s.user),s.c.open('authorization_b',s.user)
    pa,pb=s.call(a,s.claim(v,leg)),s.call(b,s.claim(v,leg)); blocked=s.c.blocked(a,gate); gate.finish(); ra,rb=s.reply(a,pa),s.reply(b,pb)
    if not all(x['ok'] and x['value']['leg_id']==leg['leg_id'] for x in (ra,rb)) or sum(x['value'].get('claimed') is True for x in (ra,rb)) != 1 or sum(x['value'].get('recovery_required') is True for x in (ra,rb)) != 1: raise RuntimeError('parallel authorization claim did not converge')
    return {'blocking':blocked,'claims':1,'recovery':1}


def exchange_claim(env):
    s=Cases(env); maker=s.c.open('exchange_maker',s.user); v,leg=s.ready(maker); claim=s.reply(maker,s.call(maker,s.claim(v,leg)))['value']; s.reply(maker,s.call(maker,s.complete(v,leg,claim['claim_id']))); gate=s.gate('exchange_gate'); a,b=s.c.open('exchange_a',s.user),s.c.open('exchange_b',s.user)
    pa,pb=s.call(a,s.exchange(v,leg)),s.call(b,s.exchange(v,leg)); blocked=s.c.blocked(a,gate); gate.finish(); ra,rb=s.reply(a,pa),s.reply(b,pb)
    if not all(x['ok'] and x['value']['leg_id']==leg['leg_id'] and x['value']['leg_state']=='exchanging' for x in (ra,rb)) or sum(x['value'].get('claimed') is True for x in (ra,rb)) != 1: raise RuntimeError('parallel exchange claim did not converge')
    return {'blocking':blocked,'claims':1,'replay':1}


def complete_vs_cancel(env):
    s=Cases(env); maker=s.c.open('cancel_maker',s.user); v,leg=s.ready(maker); claim=s.reply(maker,s.call(maker,s.claim(v,leg)))['value']; holder=s.gate('cancel_gate')
    before=s.sql('select to_jsonb(l) from kaq_private.account_proof_legs l where id='+quote(leg['leg_id']))
    complete=s.c.open('complete_waiter',s.user); pc=s.call(complete,s.complete(v,leg,claim['claim_id'])); blocked=s.c.blocked(complete,holder)
    cancel=s.reply(holder,s.call(holder,"exchange_harness.capture('cancel',"+quote(v['id'])+','+quote(v['secret'])+',null,1,null,null,null)')); holder.finish('commit'); rc=s.reply(complete,pc)
    if not cancel['ok'] or cancel['value']['state'] != 'cancelled' or not rc['ok'] or rc['value']['intent_state'] != 'cancelled' or rc['value']['authorization_prepared'] or before!=s.sql('select to_jsonb(l) from kaq_private.account_proof_legs l where id='+quote(leg['leg_id'])): raise RuntimeError('cancel did not fence complete')
    return {'blocking':blocked,'cancelled':True,'completeTerminal':True}


def runtime_change_vs_exchange(env):
    s=Cases(env); maker=s.c.open('runtime_maker',s.user); v,leg=s.ready(maker); claim=s.reply(maker,s.call(maker,s.claim(v,leg)))['value']; s.reply(maker,s.call(maker,s.complete(v,leg,claim['claim_id']))); holder=s.lock('runtime_holder','account_proof_runtime',leg['leg_id']); waiter=s.c.open('runtime_exchange',s.user); pending=s.call(waiter,s.exchange(v,leg)); blocked=s.c.blocked(waiter,holder)
    holder.send('update kaq_private.account_proof_runtime set revision=revision+1 where leg_id='+quote(leg['leg_id'])+"; commit; select 'runtime_changed';"); holder.wait('runtime_changed'); result=s.reply(waiter,pending)
    if result['ok'] or result['reason'] != 'KAQ_EXCHANGE_STALE': raise RuntimeError('runtime change did not reject exchange')
    return {'blocking':blocked,'runtimeChanged':True,'exchangeRejected':True}


def late_failure_vs_promotion(env):
    s=Cases(env); maker=s.c.open('promotion_maker',s.user); v,leg=s.ready(maker); claim=s.reply(maker,s.call(maker,s.claim(v,leg)))['value']; s.reply(maker,s.call(maker,s.complete(v,leg,claim['claim_id']))); s.reply(maker,s.call(maker,s.exchange(v,leg))); state=s.sql('select l.state||\':\'||l.revision||\':\'||r.phase||\':\'||r.revision from kaq_private.account_proof_legs l join kaq_private.account_proof_runtime r on r.leg_id=l.id where l.id='+quote(leg['leg_id'])); diagnosis=s.reply(maker,s.call(maker,"exchange_harness.capture('promote_diagnose',"+quote(v['id'])+','+quote(v['secret'])+','+quote(leg['leg_id'])+',3,null,null,null)')); holder=s.lock('promotion_holder','account_proof_runtime',leg['leg_id']); promotion,fail=s.c.open('promotion_waiter'),s.c.open('failure_waiter',s.user)
    pp=s.call(promotion,"exchange_harness.capture('promote',"+quote(v['id'])+','+quote(v['secret'])+','+quote(leg['leg_id'])+',3,null,null,null)'); blocked=s.c.blocked(promotion,holder); pf=s.call(fail,s.fail(v,leg,claim['claim_id'],3)); s.c.blocked(fail,promotion); holder.finish(); rp,rf=s.reply(promotion,pp),s.reply(fail,pf)
    if not rp['ok'] or not rp['value'] or rf['ok'] or rf['reason'] != 'KAQ_EXCHANGE_STALE': raise RuntimeError('late failure changed promoted proof: '+json.dumps({'before':state,'diagnosis':diagnosis,'promotion':rp,'failure':rf}))
    if s.sql("select l.state||':'||l.revision||':'||r.phase||':'||r.revision from kaq_private.account_proof_legs l join kaq_private.account_proof_runtime r on r.leg_id=l.id where l.id="+quote(leg['leg_id']))!='exchanged:4:proof:1': raise RuntimeError('late failure did not preserve proof state')
    return {'blocking':blocked,'promoted':True,'lateFailureRejected':True}


def expiry_after_leg_wait(env):
    s=Cases(env); maker=s.c.open('expiry_leg_maker',s.user); v,leg=s.ready(maker); deadline=s.sql('select clock_timestamp()+interval \'3 seconds\''); s.sql('update kaq_private.account_proof_legs set expires_at='+quote(deadline)+' where id='+quote(leg['leg_id'])+'; update kaq_private.account_proof_runtime set expires_at='+quote(deadline)+' where leg_id='+quote(leg['leg_id']))
    holder=s.c.open('expiry_leg_holder'); holder.send('begin; select id from kaq_private.account_proof_legs where id='+quote(leg['leg_id'])+" for update; select 'leg_held';"); holder.wait('leg_held'); waiter=s.c.open('expiry_leg_waiter',s.user); pending=s.call(waiter,s.claim(v,leg)); blocked=s.c.blocked(waiter,holder)
    s.live_wait(deadline,v['id'])
    holder.send("do $x$ begin while clock_timestamp() < "+quote(deadline)+"::timestamptz loop perform 1; end loop; end $x$; commit; select 'leg_expired';"); holder.wait('leg_expired'); result=s.reply(waiter,pending)
    if result['ok'] or result['reason'] != 'KAQ_AUTHORIZATION_STALE': raise RuntimeError('leg expiry accepted claim')
    return {'blocking':blocked,'preExpiryObserved':True,'legExpired':True,'claimRejected':True}


def expiry_after_runtime_wait(env):
    s=Cases(env); maker=s.c.open('expiry_runtime_maker',s.user); v,leg=s.ready(maker); claim=s.reply(maker,s.call(maker,s.claim(v,leg)))['value']; s.reply(maker,s.call(maker,s.complete(v,leg,claim['claim_id']))); deadline=s.sql('select clock_timestamp()+interval \'3 seconds\''); s.sql('update kaq_private.account_intents set expires_at='+quote(deadline)+' where id='+quote(v['id']))
    holder=s.lock('expiry_runtime_holder','account_proof_runtime',leg['leg_id']); waiter=s.c.open('expiry_runtime_waiter',s.user); pending=s.call(waiter,s.exchange(v,leg)); blocked=s.c.blocked(waiter,holder)
    s.live_wait(deadline,v['id'])
    holder.send("do $x$ begin while clock_timestamp() < "+quote(deadline)+"::timestamptz loop perform 1; end loop; end $x$; commit; select 'intent_expired';"); holder.wait('intent_expired'); result=s.reply(waiter,pending)
    if not result['ok'] or result['value']['intent_state'] != 'expired': raise RuntimeError('intent expiry was not settled')
    return {'blocking':blocked,'preExpiryObserved':True,'intentExpired':True,'settled':True}


def run(env):
    results={}
    for name,case in [('parallelAuthorizationClaim',authorization_claim),('parallelExchangeClaim',exchange_claim),('completeVsCancel',complete_vs_cancel),('runtimeChangeVsExchange',runtime_change_vs_exchange),('lateFailureVsProofPromotion',late_failure_vs_promotion),('expiryAfterLegWait',expiry_after_leg_wait),('expiryAfterRuntimeWait',expiry_after_runtime_wait)]:
        results[name]=case(env); Cases(env).clear()
    return results
