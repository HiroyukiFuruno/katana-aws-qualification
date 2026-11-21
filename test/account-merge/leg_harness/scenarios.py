import json


def quote(value): return "'" + str(value).replace("'", "''") + "'"


class Cases:
    def __init__(self, env): self.c, self.sql, self.user, self.baseline = env['connections'], env['sql'], env['user'], env['baseline']; self.serial = 0
    def call(self, connection, expression):
        self.serial += 1; marker, start = 'leg_reply_' + str(self.serial), len(connection.lines)
        connection.send('select ' + expression + "; select '" + marker + "';"); return marker, start
    def result(self, connection, pending):
        marker, start = pending; connection.wait(marker)
        values = [json.loads(line) for line in connection.lines[start:] if line.startswith('{')]
        if len(values) != 1: raise RuntimeError('expected one leg response')
        return values[0]
    def create(self, connection):
        pending = self.call(connection, "kaq_private.begin_account_intent('add_existing',gen_random_uuid())")
        marker, start = pending; connection.wait(marker)
        values = [json.loads(line) for line in connection.lines[start:] if line.startswith('{')]
        if len(values) != 1 or 'secret' not in values[0]: raise RuntimeError('intent creation failed')
        return values[0]
    def issue(self, value, revision, key='11111111-1111-1111-1111-111111111111', nonce='11', replace=False):
        return "leg_harness.capture('issue'," + ','.join([quote(value['id']), quote(value['secret']), str(revision), quote(key), quote(nonce), str(replace).lower()]) + ')'
    def cancel(self, value, revision): return "leg_harness.capture('cancel'," + ','.join([quote(value['id']), quote(value['secret']), str(revision), 'null', 'null', 'false']) + ')'
    def gate(self, label):
        holder = self.c.open(label, self.user); holder.send("begin; select kaq_private.intent_actor_gate(); select 'gate_held';"); holder.wait('gate_held'); return holder
    def leg_lock(self, label, leg_id):
        holder = self.c.open(label); holder.send("begin; select id from kaq_private.account_proof_legs where id=" + quote(leg_id) + " for update; select 'leg_held';"); holder.wait('leg_held'); return holder
    def intent_lock(self, label, intent_id):
        holder = self.c.open(label); holder.send("begin; select id from kaq_private.account_intents where id=" + quote(intent_id) + " for update; select 'intent_held';"); holder.wait('intent_held'); return holder
    def clear(self):
        self.sql('delete from kaq_private.account_intents where actor_uid=' + quote(self.user['userId']))
        now = json.loads(self.sql('select leg_harness.snapshot();'))
        if now != self.baseline: raise RuntimeError('leg race did not restore fixture baseline')


def same_prepare_replay(s):
    creator = s.c.open('leg_same_creator', s.user); value = s.create(creator); holder = s.gate('leg_same_gate')
    left, right = s.c.open('leg_same_a', s.user), s.c.open('leg_same_b', s.user)
    first, second = s.call(left, s.issue(value, 0)), s.call(right, s.issue(value, 0)); blocked = s.c.blocked(left, holder); holder.finish()
    a, b = s.result(left, first), s.result(right, second)
    if not a['ok'] or not b['ok'] or a['value']['leg_id'] != b['value']['leg_id'] or s.sql('select count(*) from kaq_private.account_proof_legs where intent_id=' + quote(value['id'])) != '1': raise RuntimeError('same prepare replay race failed')
    return {'blocking': blocked, 'sameLeg': True, 'rows': 1}


def different_prepare_keys(s):
    creator = s.c.open('leg_different_creator', s.user); value = s.create(creator); holder = s.gate('leg_different_gate')
    left, right = s.c.open('leg_different_a', s.user), s.c.open('leg_different_b', s.user)
    first, second = s.call(left, s.issue(value, 0, '55555555-5555-5555-5555-555555555555', '55')), s.call(right, s.issue(value, 0, '66666666-6666-6666-6666-666666666666', '66'))
    blocked = s.c.blocked(left, holder); holder.finish(); a, b = s.result(left, first), s.result(right, second)
    if sum(item['ok'] for item in [a, b]) != 1 or not any(item.get('reason') == 'KAQ_LEG_STALE' for item in [a, b]) or s.sql('select count(*) from kaq_private.account_proof_legs where intent_id=' + quote(value['id'])) != '1': raise RuntimeError('different prepare keys race failed')
    return {'blocking': blocked, 'issued': 1, 'otherRejected': 'KAQ_LEG_STALE'}


def restart_replay(s):
    creator = s.c.open('leg_restart_creator', s.user); value = s.create(creator); initial = s.result(creator, s.call(creator, s.issue(value, 0)))
    holder = s.gate('leg_restart_gate'); left, right = s.c.open('leg_restart_a', s.user), s.c.open('leg_restart_b', s.user)
    first, second = s.call(left, s.issue(value, 1, '22222222-2222-2222-2222-222222222222', '22', True)), s.call(right, s.issue(value, 1, '22222222-2222-2222-2222-222222222222', '22', True))
    blocked = s.c.blocked(left, holder); holder.finish(); a, b = s.result(left, first), s.result(right, second)
    if not a['ok'] or not b['ok'] or a['value']['leg_id'] != b['value']['leg_id'] or a['value']['attempt'] != 2 or s.sql("select count(*) from kaq_private.account_proof_legs where intent_id=" + quote(value['id']) + " and state='superseded'") != '1': raise RuntimeError('restart replay race failed')
    return {'blocking': blocked, 'attempt': 2, 'oldLeg': initial['value']['leg_id'], 'replayed': True}


def cancel_precedes_restart(s):
    creator = s.c.open('leg_cancel_creator', s.user); value = s.create(creator); initial = s.result(creator, s.call(creator, s.issue(value, 0)))
    holder = s.intent_lock('leg_cancel_lock', value['id']); cancel = s.c.open('leg_cancel', s.user); restart = s.c.open('leg_cancel_restart', s.user)
    first = s.call(cancel, s.cancel(value, 1)); s.c.blocked(cancel, holder); second = s.call(restart, s.issue(value, 1, '33333333-3333-3333-3333-333333333333', '33', True)); s.c.blocked(restart, cancel)
    holder.finish(); a, b = s.result(cancel, first), s.result(restart, second)
    if not a['ok'] or a['value']['state'] != 'cancelled' or not b['ok'] or b['value']['intent_state'] != 'cancelled' or s.sql('select count(*) from kaq_private.account_proof_legs where intent_id=' + quote(value['id'])) != '1': raise RuntimeError('cancel restart race failed')
    return {'cancelled': True, 'restartTerminal': True, 'leg': initial['value']['leg_id']}


def expiry_after_leg_wait(s):
    creator = s.c.open('leg_expiry_creator', s.user); value = s.create(creator); initial = s.result(creator, s.call(creator, s.issue(value, 0)))
    holder = s.leg_lock('leg_expiry_lock', initial['value']['leg_id']); waiter = s.c.open('leg_expiry_waiter', s.user)
    pending = s.call(waiter, s.issue(value, 1, '44444444-4444-4444-4444-444444444444', '44')); blocked = s.c.blocked(waiter, holder)
    holder.send("update kaq_private.account_proof_legs set issued_at=clock_timestamp()-interval '2 minutes',expires_at=clock_timestamp()-interval '1 minute' where id=" + quote(initial['value']['leg_id']) + "; commit; select 'expiry_released';"); holder.wait('expiry_released')
    result = s.result(waiter, pending)
    if not result['ok'] or result['value']['attempt'] != 2 or s.sql("select state from kaq_private.account_proof_legs where id=" + quote(initial['value']['leg_id'])) != 'failed': raise RuntimeError('leg expiry after wait failed')
    return {'blocking': blocked, 'expiredOldLeg': True, 'attempt': 2}


def intent_expiry_after_leg_wait(s):
    creator = s.c.open('leg_intent_expiry_creator', s.user); value = s.create(creator); initial = s.result(creator, s.call(creator, s.issue(value, 0, '77777777-7777-7777-7777-777777777777', '77')))
    s.sql("update kaq_private.account_proof_legs set state='exchanged' where id=" + quote(initial['value']['leg_id']) + "; update kaq_private.account_intents set expires_at=clock_timestamp()+interval '3 seconds' where id=" + quote(value['id']))
    holder = s.leg_lock('leg_intent_expiry_lock', initial['value']['leg_id'])
    holder.send("select 'intent_expiry_armed'; do $x$ begin while clock_timestamp() < (select expires_at from kaq_private.account_intents where id=" + quote(value['id']) + ") loop perform 1; end loop; end $x$;")
    holder.wait('intent_expiry_armed'); replay = s.c.open('leg_intent_expiry_replay', s.user)
    pending = s.call(replay, s.issue(value, 0, '77777777-7777-7777-7777-777777777777', '77')); blocked = s.c.blocked(replay, holder)
    pre_expiry = json.loads(s.sql("select jsonb_build_object('active',state='awaiting_source','before',clock_timestamp()<expires_at,'deadline',kaq_private.runtime_epoch_ms(expires_at)) from kaq_private.account_intents where id=" + quote(value['id'])))
    if not pre_expiry['active'] or not pre_expiry['before'] or int(s.user['claims']['exp']) <= int(s.sql('select floor(extract(epoch from clock_timestamp())+10)::bigint')): raise RuntimeError('intent expiry race was not live before release')
    holder.finish('commit')
    replayed = s.result(replay, pending); fresh = s.c.open('leg_intent_expiry_fresh', s.user); terminal = s.result(fresh, s.call(fresh, s.issue(value, 0, '88888888-8888-8888-8888-888888888888', '88')))
    if not replayed['ok'] or replayed['value']['intent_state'] != 'expired' or not terminal['ok'] or terminal['value']['intent_state'] != 'expired' or s.sql('select count(*) from kaq_private.account_proof_legs where intent_id=' + quote(value['id'])) != '1' or s.sql('select state from kaq_private.account_proof_legs where id=' + quote(initial['value']['leg_id'])) != 'exchanged': raise RuntimeError('intent expiry after leg wait failed')
    return {'blocking': blocked, 'preExpiryObserved': True, 'deadlineMs': pre_expiry['deadline'], 'replayExpired': True, 'newKeyTerminal': True, 'exchangedLegRetained': True}


def run(env):
    support, results = Cases(env), {}
    for name, case in [('prepareReplay', same_prepare_replay), ('differentPrepareKeys', different_prepare_keys), ('restartReplay', restart_replay), ('cancelRestart', cancel_precedes_restart), ('expiryAfterLegWait', expiry_after_leg_wait), ('intentExpiryAfterLegWait', intent_expiry_after_leg_wait)]:
        results[name] = case(support); support.clear()
    if len(results) != 6: raise RuntimeError('leg race registry mismatch')
    return results
