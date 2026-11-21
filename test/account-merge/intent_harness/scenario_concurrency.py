from .controls import quote


def same_key(s):
    holder = s.gate('intent_same_key_gate'); left, right, key = s.c.open('intent_same_key_a', s.second), s.c.open('intent_same_key_b', s.second), s.uuid()
    a, b = s.call(left, s.begin(key)), s.call(right, s.begin(key)); observed = s.c.blocked(left, holder); holder.finish()
    first, second = s.response(left, a), s.response(right, b)
    if not first['ok'] or not second['ok'] or first['value']['id'] != second['value']['id']: raise RuntimeError('Same key idempotency failed')
    for value in [first, second]: s.remember(value)
    if sum('secret' in value['value'] for value in [first, second]) != 1 or s.sql('select count(*) from kaq_private.account_intents where actor_uid=' + quote(s.second['userId'])) != '1': raise RuntimeError('Same key secret or row count failed')
    return {'blocking': observed, 'sameId': True, 'secretResponses': 1, 'rows': 1}


def different_key(s):
    holder = s.gate('intent_different_key_gate'); left, right = s.c.open('intent_different_key_a', s.second), s.c.open('intent_different_key_b', s.second)
    a, b = s.call(left, s.begin(s.uuid())), s.call(right, s.begin(s.uuid())); observed = s.c.blocked(left, holder); holder.finish()
    values = [s.response(left, a), s.response(right, b)]
    if sum(value['ok'] for value in values) != 1 or not any(value.get('reason') == 'KAQ_INTENT_ACTIVE' for value in values): raise RuntimeError('Different key active guard failed')
    for value in values: s.remember(value)
    if s.sql("select count(*) from kaq_private.account_intents where actor_uid=" + quote(s.second['userId']) + " and state='awaiting_source'") != '1': raise RuntimeError('Different key active row missing')
    return {'blocking': observed, 'created': 1, 'otherRejected': 'KAQ_INTENT_ACTIVE'}


def parallel_cancel(s):
    creator = s.c.open('intent_cancel_creator', s.second); created = s.response(creator, s.call(creator, s.begin(s.uuid())))['value']; s.remember({'ok': True, 'value': created})
    holder, left, right = s.row('intent_cancel_row', created), s.c.open('intent_cancel_a', s.second), s.c.open('intent_cancel_b', s.second)
    for connection in [left, right]: s.configure(connection, created)
    a = s.call(left, s.control('cancel')); first_wait = s.c.blocked(left, holder); b = s.call(right, s.control('cancel')); second_wait = s.c.blocked(right, left); holder.finish()
    values = [s.response(left, a), s.response(right, b)]
    if not all(value['ok'] and value['value']['state'] == 'cancelled' and value['value']['version'] == 1 for value in values): raise RuntimeError('Parallel cancel failed')
    return {'firstWait': first_wait, 'secondWait': second_wait, 'state': 'cancelled', 'revision': 1}


def cancel_before_restart(s):
    creator = s.c.open('intent_restart_creator', s.second); created = s.response(creator, s.call(creator, s.begin(s.uuid())))['value']; s.remember({'ok': True, 'value': created})
    canceller = s.c.open('intent_cancel_before_restart', s.second); s.configure(canceller, created)
    canceller.send('begin; select ' + s.control('cancel') + "; select 'cancel_pending';"); canceller.wait('cancel_pending')
    restarter = s.c.open('intent_restart_waits_cancel', s.second); pending = s.call(restarter, s.begin(s.uuid(), True)); observed = s.c.blocked(restarter, canceller)
    canceller.finish('commit'); restarted = s.response(restarter, pending)
    if not restarted['ok'] or restarted['value']['id'] == created['id'] or restarted['value']['state'] != 'awaiting_source' or s.sql('select state from kaq_private.account_intents where id=' + quote(created['id'])) != 'cancelled': raise RuntimeError('Restart crossed pending cancel')
    s.remember(restarted); return {'blocking': observed, 'old': 'cancelled', 'new': 'awaiting_source'}


def rate_limit(s):
    creator = s.c.open('intent_rate_creator', s.second)
    for _ in range(4):
        if not s.response(creator, s.call(creator, s.begin_and_cancel(s.uuid())))['ok']: raise RuntimeError('Rate setup failed')
    holder, left, right = s.gate('intent_rate_gate'), s.c.open('intent_rate_a', s.second), s.c.open('intent_rate_b', s.second)
    a, b = s.call(left, s.begin_and_cancel(s.uuid())), s.call(right, s.begin_and_cancel(s.uuid())); observed = s.c.blocked(left, holder); holder.finish()
    values = [s.response(left, a), s.response(right, b)]
    if sum(value['ok'] for value in values) != 1 or not any(value.get('sqlstate') == 'PT429' and value.get('reason') == 'KAQ_INTENT_RATE_LIMITED' for value in values): raise RuntimeError('Parallel rate limit failed')
    if s.sql('select count(*) from kaq_private.account_intents where actor_uid=' + quote(s.second['userId'])) != '5': raise RuntimeError('Rate count mismatch')
    if s.sql("select count(*) from kaq_private.account_intents where actor_uid=" + quote(s.second['userId']) + " and state='cancelled'") != '5': raise RuntimeError('Rate terminal count mismatch')
    return {'blocking': observed, 'starts': 5, 'cancelledCounted': True, 'rejected': 'KAQ_INTENT_RATE_LIMITED'}


def commit_precedes_cancel(s):
    creator = s.c.open('intent_terminal_creator', s.second); created = s.response(creator, s.call(creator, s.begin(s.uuid())))['value']; s.remember({'ok': True, 'value': created})
    committer, receipt_id = s.row('intent_terminal_holder', created), s.uuid()
    committer.send("select kaq_private.assert_live_session(" + quote(s.second['userId']) + ',' + quote(s.second['sessionId']) + ",false); update kaq_private.account_intents set state='committed',revision=9 where id=" + quote(created['id']) + "; insert into kaq_private.account_merge_receipts(id,intent_id,canonical_account_id,algorithm_version,consent_hash,before_scopes,choices,result) values(" + quote(receipt_id) + ',' + quote(created['id']) + ',' + quote(s.users[0]['userId']) + ",1,decode(repeat('ab',32),'hex'),'[]','{}','{}'); select 'terminal_pending';")
    committer.wait('terminal_pending'); canceller = s.c.open('intent_cancel_after_terminal', s.second); s.configure(canceller, created)
    pending = s.call(canceller, s.control('cancel')); observed = s.c.blocked(canceller, committer); committer.finish('commit'); terminal = s.response(canceller, pending)
    if not terminal['ok'] or terminal['value']['state'] != 'committed' or terminal['value']['version'] != 9 or terminal['value']['commit_receipt_id'] != receipt_id: raise RuntimeError('Commit terminal state overwritten')
    return {'blocking': observed, 'state': 'committed', 'revision': 9, 'receiptPreserved': True, 'realMergeImplemented': False}
