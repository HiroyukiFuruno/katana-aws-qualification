import time

from .controls import quote


def wait_for_clock(sql, cutoff):
    deadline = time.monotonic() + 8
    while sql('select clock_timestamp()>=to_timestamp(' + str(cutoff) + ')') != 't':
        if time.monotonic() >= deadline: raise RuntimeError('DB expiry clock not observed')


def expiry_after_intent_wait(s):
    creator = s.c.open('intent_expiry_creator', s.second)
    created = s.response(creator, s.call(creator, s.begin(s.uuid())))['value']; s.remember({'ok': True, 'value': created})
    cutoff = int(s.sql('select floor(extract(epoch from clock_timestamp()))::bigint')) + 2
    s.sql("update kaq_private.account_intents set created_at=to_timestamp(" + str(cutoff) + ")-interval '10 minutes', expires_at=to_timestamp(" + str(cutoff) + ') where id=' + quote(created['id']))
    holder, reader = s.row('intent_expiry_row', created), s.c.open('intent_expiry_reader', s.second)
    s.configure(reader, created); pending = s.call(reader, s.control()); observed = s.c.blocked(reader, holder)
    wait_for_clock(s.sql, cutoff); holder.finish(); expired = s.response(reader, pending)
    if not expired['ok'] or expired['value']['state'] != 'expired' or expired['value']['version'] != 1: raise RuntimeError('Expiry did not settle once')
    again = s.response(reader, s.call(reader, s.control()))
    if not again['ok'] or any(again['value'][key] != expired['value'][key] for key in ['state', 'version', 'expires_at']): raise RuntimeError('Expiry extended or settled twice')
    return {'blocking': observed, 'cutoffObserved': cutoff, 'state': 'expired', 'revision': 1, 'notExtended': True}


def live_after_advisory_wait(s, snapshot):
    results, creator = {}, s.c.open('intent_live_creator', s.second)
    for kind in ['claim', 'session']:
        created = s.response(creator, s.call(creator, s.begin(s.uuid())))['value']; s.remember({'ok': True, 'value': created})
        actor = s.c.open('intent_live_' + kind, s.second); s.configure(actor, created)
        cutoff = int(s.sql('select floor(extract(epoch from clock_timestamp()))::bigint')) + 2
        if kind == 'claim':
            claims = dict(s.second['claims'], exp=cutoff)
            actor.send(s.c.context_sql(s.second, claims) + "select 'short_claim_ready';"); actor.wait('short_claim_ready')
        else: s.sql('update auth.sessions set not_after=to_timestamp(' + str(cutoff) + ') where id=' + quote(s.second['sessionId']))
        before, holder = snapshot(), s.gate('intent_live_' + kind + '_gate')
        pending = s.call(actor, s.control()); observed = s.c.blocked(actor, holder)
        wait_for_clock(s.sql, cutoff); holder.finish(); rejected = s.response(actor, pending)
        expected = 'KAQ_AUTH_CONTEXT_INVALID' if kind == 'claim' else 'KAQ_SESSION_INVALID'
        if rejected.get('ok') or rejected.get('sqlstate') != '28000' or rejected.get('reason') != expected or snapshot() != before: raise RuntimeError('Live ' + kind + ' guard failed')
        if kind == 'session': s.sql('update auth.sessions set not_after=null where id=' + quote(s.second['sessionId']))
        results['live_after_advisory_wait_' + kind] = {'blocking': observed, 'cutoffObserved': cutoff, 'rejected': expected, 'intentUnchanged': True}
        s.sql('delete from kaq_private.account_intents where actor_uid=' + quote(s.second['userId']))
    return results
