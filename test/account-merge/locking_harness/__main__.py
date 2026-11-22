"""Run the isolated private locking-scope integration fixture."""
import argparse
import hashlib
import json
from pathlib import Path

from .connections import Connections
from .fixture import AUTH_NAME, DATABASE_NAME, context_sql, create_users, lock_sql, migration_inventory, prepare, quote, start
from .refresh_case import refresh_conflict_case
from .scenarios import core_cases, expiry_cases
from .scope_cases import candidate_cases, contract_cases
from .support import DEFAULT_ARTIFACTS, Docker, utc_now, write_json


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repo-root', required=True)
    parser.add_argument('--artifact-dir', default=str(DEFAULT_ARTIFACTS))
    return parser.parse_args()


def cleanup(docker, connections, artifacts):
    errors = connections.close() if connections else []
    transcript = artifacts / 'concurrency.ndjson'
    transcript.write_text(''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in connections.transcript) if connections else '')
    containers = []
    for name, identifier in reversed(docker.owned):
        metadata = docker.run('inspect', identifier)
        stopped = docker.run('stop', identifier); removed = docker.run('container', 'rm', identifier)
        remaining = docker.run('ps', '-a', '--filter', f'name=^/{name}$', '--format', '{{.ID}} {{.Names}}')
        containers.append({'name': name, 'id': identifier, 'stopExitCode': stopped.returncode, 'removeExitCode': removed.returncode,
            'remaining': remaining.stdout.strip(), 'mounts': json.loads(metadata.stdout)[0]['Mounts'] if metadata.returncode == 0 else None})
    value = {'containers': containers, 'connectionErrors': errors, 'volumesCreated': False, 'at': utc_now()}
    write_json(artifacts / 'cleanup.json', value)
    if errors or any(item['stopExitCode'] or item['removeExitCode'] or item['remaining'] for item in containers):
        raise RuntimeError('Dedicated locking-scope cleanup failed')


def main():
    args = parse_args(); root = Path(args.repo_root).resolve(); artifacts = Path(args.artifact_dir).resolve()
    if not (root / 'supabase/migrations').is_dir(): raise RuntimeError('repo-root does not contain supabase/migrations')
    artifacts.mkdir(parents=True, exist_ok=True)
    docker, connections = Docker(), None
    receipt = {'status': 'running', 'observedAt': utc_now(), 'fixture': {'database': DATABASE_NAME, 'auth': AUTH_NAME, 'portsPublished': False, 'tmpfs': True}, 'scenarios': {}}
    migrations = migration_inventory(root)
    has_committed_bindings = any(path.name == '202611220003_learning_session_grants.sql' for path in migrations)
    has_creation_receipts = any(path.name == '202611220004_learning_account_creation.sql' for path in migrations)
    # migration 17 binding と migration 18 receipt は rollback 後の全行不変を各1件追加する。
    expected_unit_checks = 110 if has_creation_receipts else (109 if has_committed_bindings else 108)
    inputs = [*migrations,
        *(root / 'supabase/account-merge' / name for name in ['session-resolver.sql', 'owner-scope.sql', 'locking-scope.sql']),
        root / 'test/account-merge/locking-scope.sql']
    source_hashes = {str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest() for path in inputs}
    receipt['sourceInputs'] = source_hashes
    try:
        database = start(docker); connections = Connections(database, docker, quote, context_sql)
        sql = connections.sql; auth, health = prepare(database, docker, sql, root)
        receipt['gotrueHealth'] = health; receipt['postgresVersion'] = sql('select version()')
        receipt['defaultTimeouts'] = json.loads(sql("select jsonb_build_object('deadlock_timeout',current_setting('deadlock_timeout'),'lock_timeout',current_setting('lock_timeout'),'statement_timeout',current_setting('statement_timeout'))"))
        users = create_users(docker, auth); receipt['realSessionChecks'] = {'passwordUsers': len(users), 'signatureVerified': True, 'getUserVerified': True}
        sql("""create schema locking_scope_probe; create table locking_scope_probe.writes(label text primary key);
          create function locking_scope_probe.snapshot() returns jsonb language plpgsql as $$ declare r record; value jsonb; result jsonb := '{}'; begin
          for r in select schemaname,tablename from pg_tables where schemaname in ('auth','public','kaq_private','locking_scope_probe') order by schemaname,tablename loop
          execute format('select jsonb_build_object(''count'',count(*),''sha256'',encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text),''[]''::jsonb)::text,''sha256''),''hex'')) from %I.%I row',r.schemaname,r.tablename) into value;
          result := result || jsonb_build_object(r.schemaname || '.' || r.tablename,value); end loop; return result; end $$;""")
        unit = (root / 'test/account-merge/locking-scope.sql').read_text()
        for index, name in enumerate(['FIRST', 'SECOND', 'THIRD']): unit = unit.replace('__' + name + '_USER__', users[index]['userId']).replace('__' + name + '_SESSION__', users[index]['sessionId'])
        before = json.loads(sql('select locking_scope_probe.snapshot();')); output = sql(unit); result = json.loads(next(line for line in output.splitlines() if line.startswith('{')))
        checks = result.get('checks', [])
        binding_protected = not has_committed_bindings or 'unchanged_kaq_private_account_committed_proof_bindings' in checks
        receipt_protected = not has_creation_receipts or 'unchanged_kaq_private_learning_account_creation_receipts' in checks
        state_unchanged = json.loads(sql('select locking_scope_probe.snapshot();')) == before
        if result.get('status') != 'passed' or len(checks) != expected_unit_checks or not binding_protected or not receipt_protected or not state_unchanged:
            raise RuntimeError(f'{expected_unit_checks} locking SQL checks, protected rollback rows, or fixture state verification failed')
        for actor in users[:2]: sql(f"insert into kaq_private.learning_accounts(id) values({quote(actor['userId'])}); insert into kaq_private.learning_memberships(auth_user_id,account_id) values({quote(actor['userId'])},{quote(actor['userId'])}); insert into public.learning_state(user_id) values({quote(actor['userId'])}); insert into kaq_private.learning_session_grants(session_id,auth_user_id,account_id,membership_epoch,reason) values({quote(actor['sessionId'])},{quote(actor['userId'])},{quote(actor['userId'])},0,'legacy');")
        baseline = json.loads(sql('select locking_scope_probe.snapshot();'))
        env = {'connections': connections, 'sql': sql, 'snapshot': lambda: json.loads(sql('select locking_scope_probe.snapshot();')), 'quote': quote, 'users': users, 'baseline': baseline, 'context': context_sql, 'lock': lambda actor, mode='writer': lock_sql(users, actor, mode), 'docker': docker, 'auth': auth, 'artifacts': artifacts}
        for group in [core_cases, expiry_cases, candidate_cases, contract_cases]: receipt['scenarios'].update(group(env))
        receipt['scenarios']['gotrue_refresh_session_conflict'] = refresh_conflict_case(env)
        if any('40P01' in line for item in connections.items for line in item.lines) or sql('select count(*) from locking_scope_probe.writes') != '0': raise RuntimeError('Deadlock or unintended write observed')
        receipt.update(status='passed', unitChecks=expected_unit_checks, scenarioCount=len(receipt['scenarios']), deadlockErrors=0, unintendedWrites=0, baselineSnapshot=baseline, finalSnapshot=env['snapshot']())
        if receipt['scenarioCount'] != 12: raise RuntimeError('Expected 12 concurrency scenarios')
        if any(hashlib.sha256((root / name).read_bytes()).hexdigest() != expected for name, expected in source_hashes.items()):
            raise RuntimeError('Locking harness source changed during verification')
    except Exception as error:
        receipt.update(status='failed', failure=type(error).__name__, message=str(error)); raise
    finally:
        cleanup_error = None
        try:
            cleanup(docker, connections, artifacts)
        except Exception as error:
            receipt.update(status='failed', cleanupFailure=type(error).__name__, cleanupMessage=str(error))
            cleanup_error = error
        write_json(artifacts / 'actual-results.json', receipt)
        if cleanup_error: raise cleanup_error
    print(json.dumps({'status': receipt['status'], 'unitChecks': receipt['unitChecks'], 'concurrencyScenarios': receipt['scenarioCount']}))


if __name__ == '__main__': main()
