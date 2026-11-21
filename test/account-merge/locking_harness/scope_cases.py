from .scenarios import assert_snapshot, planned_write, reject_without_write


def candidate_cases(env):
    c, sql, snapshot, quote = env['connections'], env['sql'], env['snapshot'], env['quote']
    users, lock, baseline = env['users'], env['lock'], env['baseline']
    first, _, third = users; first_id = quote(first['userId']); cases = {}
    for change in ['add', 'remove', 'revision']:
        if change == 'remove': sql(f"insert into kaq_private.learning_memberships(auth_user_id,account_id) values({quote(third['userId'])},{first_id})")
        blocker, actor = c.open('candidate_' + change + '_blocker'), c.open('candidate_' + change + '_actor', first)
        guard = None
        if change == 'add':
            guard = c.open('new_uid_share_guard')
            guard.send(f"begin; select 1 from auth.users where id={quote(third['userId'])} for no key update; select 'new_uid_guard_held';"); guard.wait('new_uid_guard_held')
        blocker.send(f"begin; select 1 from public.learning_state where user_id={first_id} for update; select 'candidate_state_held';"); blocker.wait('candidate_state_held')
        actor.send('begin;' + lock(first) + planned_write(quote, 'stale_candidate_' + change)); observed = c.blocked(actor, blocker)
        if change == 'add': blocker.send(f"insert into kaq_private.learning_memberships(auth_user_id,account_id) values({quote(third['userId'])},{first_id}); select 'candidate_changed';")
        elif change == 'remove': blocker.send(f"delete from kaq_private.learning_memberships where auth_user_id={quote(third['userId'])}; select 'candidate_changed';")
        else: blocker.send(f"update kaq_private.learning_accounts set membership_revision=1 where id={first_id}; select 'candidate_changed';")
        blocker.wait('candidate_changed'); blocker.finish('commit'); reject_without_write(sql, actor, quote, 'stale_candidate_' + change, 'PT409', 'KAQ_SCOPE_RETRY')
        held = False
        if guard:
            held = True; guard.send("select 'guard_remains_until_rejection';"); guard.wait('guard_remains_until_rejection'); guard.finish()
        if change == 'add': sql(f"delete from kaq_private.learning_memberships where auth_user_id={quote(third['userId'])}")
        if change == 'revision': sql(f'update kaq_private.learning_accounts set membership_revision=0 where id={first_id}')
        assert_snapshot(snapshot, baseline)
        cases['candidate_' + change] = {'blocking': observed, 'staleRejected': 'KAQ_SCOPE_RETRY', 'newUidShareBlockedUntilAfterRejection': held, 'unintendedWrites': 0, 'snapshotRestored': True}
    return cases


def contract_cases(env):
    c, sql, snapshot, quote = env['connections'], env['sql'], env['snapshot'], env['quote']
    users, lock, baseline = env['users'], env['lock'], env['baseline']; first = users[0]; cases = {}
    isolation = c.open('unsupported_isolation', first)
    isolation.send('begin isolation level repeatable read;' + lock(first) + planned_write(quote, 'unsupported_isolation'))
    reject_without_write(sql, isolation, quote, 'unsupported_isolation', 'PT400', 'KAQ_SCOPE_ISOLATION_UNSUPPORTED'); assert_snapshot(snapshot, baseline)
    cases['unsupported_isolation'] = {'rejected': 'KAQ_SCOPE_ISOLATION_UNSUPPORTED', 'unintendedWrites': 0}
    reentry = c.open('reentry_upgrade_refused', first)
    reentry.send('begin;' + lock(first) + "select 'reentry_writer_locked';"); reentry.wait('reentry_writer_locked')
    reentry.send(lock(first, 'reset') + planned_write(quote, 'reentry_upgrade'))
    reject_without_write(sql, reentry, quote, 'reentry_upgrade', 'PT409', 'KAQ_SCOPE_REENTRY'); assert_snapshot(snapshot, baseline)
    cases['reentry_upgrade'] = {'rejected': 'KAQ_SCOPE_REENTRY', 'unintendedWrites': 0}
    return cases
