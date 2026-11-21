import json
import threading
import time

from .fixture import refresh_probe
from .refresh_contract import verify_refresh_contract
from .scenarios import planned_write, reject_without_write
from .support import write_json


def refresh_graph(sql, barrier_pid):
    deadline = time.monotonic() + 10
    while True:
        rows = json.loads(sql("""select coalesce(jsonb_agg(jsonb_build_object('pid',pid,'blockers',pg_blocking_pids(pid),
          'waitEventType',wait_event_type,'waitEvent',wait_event) order by pid),'[]'::jsonb) from pg_stat_activity
          where datname=current_database() and pid <> pg_backend_pid();"""))
        if any(barrier_pid in row['blockers'] for row in rows): return rows
        if time.monotonic() >= deadline: raise RuntimeError('Actual GoTrue refresh did not reach the refresh-token barrier')


def run_refresh(docker, auth, refresh_token, result):
    try:
        result.update(refresh_probe(docker, auth, refresh_token))
    except Exception:
        result['outcome'] = 'failed'


def auth_user_evidence(sql, users):
    identifiers = ','.join("'" + user['userId'] + "'::uuid" for user in users)
    return json.loads(sql(f"""select coalesce(jsonb_object_agg(u.id::text,jsonb_build_object(
      'timestamps',jsonb_build_object('last_sign_in_at',u.last_sign_in_at,'updated_at',u.updated_at),
      'columnHashes',(select coalesce(jsonb_object_agg(key,encode(extensions.digest(value::text,'sha256'),'hex')),'{{}}'::jsonb)
        from jsonb_each(to_jsonb(u)) where key not in ('last_sign_in_at','updated_at')),
      'protectedHash',encode(extensions.digest((to_jsonb(u)-'last_sign_in_at'-'updated_at')::text,'sha256'),'hex')))
      ,'{{}}'::jsonb) from auth.users u where u.id in ({identifiers});"""))


def audit_evidence(sql):
    return json.loads(sql("""select jsonb_build_object(
      'hashes',coalesce((select jsonb_object_agg(a.id::text,encode(extensions.digest(to_jsonb(a)::text,'sha256'),'hex'))
        from auth.audit_log_entries a),'{}'::jsonb),
      'metadata',coalesce((select jsonb_object_agg(a.id::text,jsonb_build_object('action',a.payload->>'action',
        'actorId',a.payload->>'actor_id','createdAt',a.created_at)) from auth.audit_log_entries a),'{}'::jsonb));"""))


def failure_evidence(before, after, users_before, users_after, audit_before, audit_after):
    tables = {name: {'before': before[name], 'after': after[name]} for name in before if before[name] != after[name]}
    user_changes = {}
    for user_id, prior in users_before.items():
        current = users_after[user_id]
        columns = [name for name in prior['timestamps'] if prior['timestamps'][name] != current['timestamps'][name]]
        columns += [name for name in prior['columnHashes'] if prior['columnHashes'][name] != current['columnHashes'][name]]
        user_changes[user_id] = {'changedColumns': sorted(columns), 'before': prior, 'after': current}
    added = {row_id: audit_after['metadata'][row_id] for row_id in audit_after['hashes'] if row_id not in audit_before['hashes']}
    return {'changedTables': tables, 'authUsers': user_changes, 'audit': {'beforeRowHashes': audit_before['hashes'],
        'afterRowHashes': audit_after['hashes'], 'addedRows': added}}


def refresh_conflict_case(env):
    c, sql, snapshot, quote = env['connections'], env['sql'], env['snapshot'], env['quote']
    docker, auth, users = env['docker'], env['auth'], env['users']; first, _, third = users
    sql("""create schema locking_scope_refresh_probe; create table locking_scope_refresh_probe.barrier(id integer primary key);
      insert into locking_scope_refresh_probe.barrier values(1); create function auth.locking_scope_refresh_hold() returns trigger
      language plpgsql security definer set search_path = pg_catalog, locking_scope_refresh_probe as $$ begin
      perform 1 from locking_scope_refresh_probe.barrier where id=1 for update; return new; end $$;
      create trigger locking_scope_refresh_hold before update on auth.refresh_tokens for each row execute function auth.locking_scope_refresh_hold();""")
    before = snapshot(); users_before = auth_user_evidence(sql, users); audit_before = audit_evidence(sql)
    refresh_started = sql('select clock_timestamp()'); barrier = c.open('refresh_trigger_holder')
    barrier.send("begin; select 1 from locking_scope_refresh_probe.barrier where id=1 for update; select 'refresh_barrier_held';"); barrier.wait('refresh_barrier_held')
    result = {}; thread = threading.Thread(target=run_refresh, args=(docker, auth, first['refreshToken'], result)); thread.start()
    observed = refresh_graph(sql, barrier.pid); actor = c.open('refresh_scope_actor', first)
    actor.send('begin;' + env['lock'](first) + planned_write(quote, 'refresh_scope_after_refresh'))
    reject_without_write(sql, actor, quote, 'refresh_scope_after_refresh', 'PT409', 'KAQ_SCOPE_RETRY'); barrier.finish(); thread.join(timeout=10)
    if thread.is_alive() or result.get('outcome') != 'success' or result.get('httpStatus') != 200: raise RuntimeError('Refresh did not complete after KAQ retry')
    resolver_barrier = c.open('refresh_resolver_trigger_holder')
    resolver_barrier.send("begin; select 1 from locking_scope_refresh_probe.barrier where id=1 for update; select 'resolver_refresh_barrier_held';"); resolver_barrier.wait('resolver_refresh_barrier_held')
    resolver_result = {}; resolver = threading.Thread(target=run_refresh, args=(docker, auth, third['refreshToken'], resolver_result)); resolver.start()
    refresh_graph(sql, resolver_barrier.pid); direct = c.open('refresh_direct_session_resolver')
    direct.send('begin; select (kaq_private.assert_live_session(' + quote(third['userId']) + '::uuid,' + quote(third['sessionId']) + '::uuid,false)).id;')
    direct.error('PT409', 'KAQ_SCOPE_RETRY'); direct.finish(); resolver_barrier.finish(); resolver.join(timeout=10)
    if resolver.is_alive() or resolver_result.get('outcome') != 'success' or resolver_result.get('httpStatus') != 200: raise RuntimeError('Refresh did not complete after direct resolver retry')
    refresh_finished = sql('select clock_timestamp()'); after = snapshot(); users_after = auth_user_evidence(sql, users); audit_after = audit_evidence(sql)
    evidence = failure_evidence(before, after, users_before, users_after, audit_before, audit_after)
    try:
        verify_refresh_contract(before, after, users_before, users_after, audit_before, audit_after,
            first['userId'], third['userId'], refresh_started, refresh_finished)
    except AssertionError as error:
        write_json(env['artifacts'] / 'refresh-failure.json', evidence)
        raise RuntimeError(str(error)) from error
    if int(sql("select deadlocks from pg_stat_database where datname=current_database()")) != 0: raise RuntimeError('Deadlock remained after NOWAIT retry')
    return {'actualGoTrueRefresh': True, 'kaqRejected': 'KAQ_SCOPE_RETRY', 'refreshOutcome': 'success', 'refreshHttpStatus': 200,
            'deadlocks': 0, 'refreshBarrier': observed, 'directResolverRejected': 'KAQ_SCOPE_RETRY', 'unintendedWrites': 0,
            'onlyExpectedGoTrueRowsChanged': True}
