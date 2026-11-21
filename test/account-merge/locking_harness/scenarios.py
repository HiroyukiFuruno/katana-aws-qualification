import time


def planned_write(quote, label):
    return f"insert into locking_scope_probe.writes values({quote(label)});"


def reject_without_write(sql, connection, quote, label, state, message):
    connection.error(state, message)
    connection.finish()
    if sql(f'select count(*) from locking_scope_probe.writes where label={quote(label)}') != '0':
        raise AssertionError(f'Unexpected write for {label}')


def assert_snapshot(snapshot, baseline):
    if snapshot() != baseline:
        raise AssertionError('Fixture snapshot was not restored')


def core_cases(env):
    c, sql, snapshot, quote = env['connections'], env['sql'], env['snapshot'], env['quote']
    users, lock, baseline = env['users'], env['lock'], env['baseline']
    first, _, _ = users; first_id = quote(first['userId']); cases = {}
    writer, merge = c.open('writer_holds_share', first), c.open('merge_waits_writer', first)
    writer.send('begin;' + lock(first) + "select 'writer_locked';"); writer.wait('writer_locked')
    merge.send('begin;' + lock(first, 'merge') + "select 'merge_locked';"); observed = c.blocked(merge, writer)
    writer.finish(); merge.wait('merge_locked'); merge.finish(); assert_snapshot(snapshot, baseline)
    cases['writer_vs_merge'] = {'blocking': observed, 'bothComplete': True, 'snapshotRestored': True}
    reset, stale = c.open('reset_holds_update', first), c.open('writer_after_reset', first)
    reset.send('begin;' + lock(first, 'reset') + f"update public.learning_state set generation=1 where user_id={first_id}; select 'reset_changed';")
    reset.wait('reset_changed'); stale.send('begin;' + lock(first) + planned_write(quote, 'stale_reset_writer')); observed = c.blocked(stale, reset)
    reset.finish('commit'); reject_without_write(sql, stale, quote, 'stale_reset_writer', 'PT409', 'KAQ_GENERATION_STALE')
    sql(f'update public.learning_state set generation=0 where user_id={first_id}'); assert_snapshot(snapshot, baseline)
    cases['writer_vs_reset'] = {'blocking': observed, 'staleRejected': 'KAQ_GENERATION_STALE', 'unintendedWrites': 0}
    merger, stale = c.open('merge_changes_revision', first), c.open('writer_after_merge', first)
    merger.send('begin;' + lock(first, 'merge') + f"update kaq_private.learning_accounts set membership_revision=1 where id={first_id}; select 'merge_changed';")
    merger.wait('merge_changed'); stale.send('begin;' + lock(first) + planned_write(quote, 'stale_merge_writer')); observed = c.blocked(stale, merger)
    merger.finish('commit'); reject_without_write(sql, stale, quote, 'stale_merge_writer', 'PT409', 'KAQ_SCOPE_RETRY')
    sql(f'update kaq_private.learning_accounts set membership_revision=0 where id={first_id}'); assert_snapshot(snapshot, baseline)
    cases['writer_vs_merge_revision'] = {'blocking': observed, 'staleRejected': 'KAQ_SCOPE_RETRY', 'unintendedWrites': 0}
    live, deletion = c.open('writer_blocks_auth_delete', first), c.open('auth_delete_waits_user')
    live.send('begin;' + lock(first) + "select 'writer_protected';"); live.wait('writer_protected')
    deletion.send(f"begin; delete from auth.users where id={first_id}; select 'auth_deleted_pending';"); observed = c.blocked(deletion, live)
    live.send("select 'writer_can_finish';"); live.wait('writer_can_finish'); live.finish(); deletion.wait('auth_deleted_pending'); deletion.finish(); assert_snapshot(snapshot, baseline)
    cases['writer_vs_auth_delete'] = {'blocking': observed, 'noCycle': True, 'bothComplete': True, 'snapshotRestored': True}
    return cases


def expiry_cases(env):
    c, sql, snapshot, quote = env['connections'], env['sql'], env['snapshot'], env['quote']
    users, lock, baseline, context = env['users'], env['lock'], env['baseline'], env['context']
    first = users[0]; first_id = quote(first['userId']); cases = {}
    for kind in ['claim', 'session']:
        blocker, actor = c.open('expiry_' + kind + '_blocker'), c.open('expiry_' + kind + '_actor', first)
        cutoff = int(sql('select floor(extract(epoch from clock_timestamp()))::bigint')) + 2
        if kind == 'claim':
            actor.send(context(first, dict(first['claims'], exp=cutoff)) + "select 'short_exp_ready';"); actor.wait('short_exp_ready')
        else: sql(f"update auth.sessions set not_after=to_timestamp({cutoff}) where id={quote(first['sessionId'])}")
        blocker.send(f"begin; select 1 from public.learning_state where user_id={first_id} for update; select 'expiry_state_held';"); blocker.wait('expiry_state_held')
        actor.send('begin;' + lock(first) + planned_write(quote, 'expired_' + kind)); observed = c.blocked(actor, blocker)
        deadline = time.monotonic() + 8
        while sql(f'select clock_timestamp() >= to_timestamp({cutoff})') != 't':
            if time.monotonic() >= deadline: raise RuntimeError('DB clock cutoff was not observed')
        blocker.finish(); code = 'KAQ_AUTH_CONTEXT_INVALID' if kind == 'claim' else 'KAQ_SESSION_INVALID'
        reject_without_write(sql, actor, quote, 'expired_' + kind, '28000', code)
        if kind == 'session': sql(f"update auth.sessions set not_after=null where id={quote(first['sessionId'])}")
        assert_snapshot(snapshot, baseline)
        cases['wait_then_expired_' + kind] = {'blocking': observed, 'clockCutoffObserved': cutoff, 'rejected': code, 'unintendedWrites': 0}
    return cases
