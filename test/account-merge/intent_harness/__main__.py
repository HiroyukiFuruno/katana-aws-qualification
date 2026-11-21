import argparse
import hashlib
import json
from pathlib import Path

from locking_harness.connections import Connections
from locking_harness.fixture import additional_password_session, apply_private_inputs, context_sql, create_users, prepare, quote, start
from locking_harness.support import Docker, utc_now, write_json

from .controls import install
from .redaction import contains_secret, discover_secrets, redact
from .scenarios import run

DB_NAME = 'kaq-intent-control-harness-db'
AUTH_NAME = 'kaq-intent-control-harness-auth'


def arguments():
    parser = argparse.ArgumentParser(); parser.add_argument('--repo-root', required=True); parser.add_argument('--artifact-dir', required=True)
    return parser.parse_args()


def close(docker, connections, artifacts, secrets):
    errors = connections.close() if connections else []
    transcript = connections.transcript if connections else []
    secrets.update(discover_secrets(transcript))
    (artifacts / 'concurrency.ndjson').write_text(''.join(json.dumps(redact(row, secrets)) + '\n' for row in transcript))
    records = []
    for name, identifier in reversed(docker.owned):
        inspect = docker.run('inspect', identifier); stop = docker.run('stop', identifier); remove = docker.run('container', 'rm', identifier)
        left = docker.run('ps', '-a', '--filter', f'name=^/{name}$', '--format', '{{.ID}}')
        records.append({'name': name, 'id': identifier, 'inspect': inspect.returncode, 'stop': stop.returncode, 'remove': remove.returncode, 'remaining': left.stdout.strip()})
    write_json(artifacts / 'cleanup.json', {'containers': records, 'connectionErrors': redact(errors, secrets), 'volumesCreated': False, 'at': utc_now()})
    if errors or any(row['stop'] or row['remove'] or row['remaining'] for row in records): raise RuntimeError('Intent harness cleanup failed')


def snapshot_install(sql):
    sql("""create function intent_harness.snapshot() returns jsonb language plpgsql as $$
      declare relation_record record; result jsonb := '{}'::jsonb; value jsonb;
      begin
        for relation_record in select schemaname,tablename from pg_tables
          where schemaname in ('auth','public','kaq_private','intent_harness') order by schemaname,tablename loop
          execute format('select jsonb_build_object(''count'',count(*),''sha256'',encode(extensions.digest(
            coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text),''[]''::jsonb)::text,''sha256''),''hex'')) from %I.%I row',
            relation_record.schemaname,relation_record.tablename) into value;
          result := result || jsonb_build_object(relation_record.schemaname || '.' || relation_record.tablename,value);
        end loop;
        return result;
      end $$;""")


def redact_text(value, secrets):
    return redact(value, secrets) if isinstance(value, str) else value


def main():
    args = arguments(); root, artifacts = Path(args.repo_root).resolve(), Path(args.artifact_dir).resolve(); artifacts.mkdir(parents=True, exist_ok=True)
    docker, connections, failure = Docker(), None, None
    secrets = set(); receipt = {'status': 'running', 'observedAt': utc_now(), 'scenarios': {}, 'shortJwtCasesExecuted': False}
    source_paths = [*sorted((root / 'supabase/migrations').glob('*.sql')),
        *(root / 'supabase/account-merge' / name for name in ['session-resolver.sql', 'owner-scope.sql', 'locking-scope.sql', 'intent-control-schema.sql', 'intent-control.sql']),
        root / 'test/account-merge/intent-control.sql', *sorted((root / 'test/account-merge/intent_harness').glob('*.py')),
        *(root / 'test/account-merge/locking_harness' / name for name in ['fixture.py', 'connections.py', 'support.py'])]
    source_hashes = {str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest() for path in source_paths}
    receipt['fixtureSourceInputs'] = source_hashes
    try:
        database = start(docker, DB_NAME, AUTH_NAME); connections = Connections(database, docker, quote, context_sql); sql = connections.sql
        auth, health = prepare(database, docker, sql, root, AUTH_NAME)
        inputs = apply_private_inputs(root, sql, ['intent-control-schema.sql', 'intent-control.sql'], artifacts)
        users, alternate = create_users(docker, auth), None; alternate = additional_password_session(docker, auth, users[1])
        install(sql); snapshot_install(sql)
        statement = (root / 'test/account-merge/intent-control.sql').read_text()
        for index, name in enumerate(['FIRST', 'SECOND', 'THIRD']): statement = statement.replace('__' + name + '_USER__', users[index]['userId']).replace('__' + name + '_SESSION__', users[index]['sessionId'])
        statement = statement.replace('__SECOND_ALT_SESSION__', alternate['sessionId']); output = sql(statement)
        unit = json.loads(next(line for line in output.splitlines() if line.startswith('{')))
        if unit.get('status') != 'passed' or len(unit.get('checks', [])) != 83: raise RuntimeError('Intent unit checks failed')
        first = users[0]
        sql("insert into kaq_private.learning_accounts(id) values(" + quote(first['userId']) + ");"
            "insert into kaq_private.learning_memberships(auth_user_id,account_id) values(" + quote(first['userId']) + ',' + quote(first['userId']) + ");"
            "insert into public.learning_state(user_id) values(" + quote(first['userId']) + ");"
            "insert into kaq_private.learning_session_grants(session_id,auth_user_id,account_id,membership_epoch,reason) values("
            + quote(first['sessionId']) + ',' + quote(first['userId']) + ',' + quote(first['userId']) + ",0,'legacy');")
        baseline = json.loads(sql('select intent_harness.snapshot();'))
        receipt['scenarios'] = run({'connections': connections, 'sql': sql, 'users': users, 'secrets': secrets, 'baseline': baseline,
                                    'snapshot': lambda: json.loads(sql('select intent_harness.snapshot();'))})
        if any('40P01' in line for item in connections.items for line in item.lines): raise RuntimeError('Deadlock observed')
        final_snapshot = json.loads(sql('select intent_harness.snapshot();'))
        if final_snapshot != baseline: raise RuntimeError('Intent fixture final snapshot differs from baseline')
        if any(hashlib.sha256((root / name).read_bytes()).hexdigest() != expected for name, expected in source_hashes.items()):
            raise RuntimeError('Intent harness source changed during verification')
        receipt.update(status='passed', unitChecks=83, sourceInputs=inputs, sourceSha256=inputs, gotrueHealth=health, alternateSecondSessionVerified=True,
          scenarioCount=len(receipt['scenarios']), deadlocks=0, secretsLogged=False, baselineSnapshot=baseline,
          finalSnapshot=final_snapshot, intentDataRestored=True, shortJwtEvidence='intent-control-expiry-green-real.json')
    except Exception as error:
        failure = error
    finally:
        cleanup_error = None
        try: close(docker, connections, artifacts, secrets)
        except Exception as error: cleanup_error = error
        secrets.update(discover_secrets(connections.transcript if connections else []))
        if failure: receipt.update(status='failed', failure=type(failure).__name__, message=redact_text(str(failure), secrets))
        if cleanup_error: receipt.update(status='failed', cleanupFailure=redact_text(str(cleanup_error), secrets))
        write_json(artifacts / 'actual-results.json', receipt)
        for path in artifacts.rglob('*'):
            if path.is_file() and contains_secret(path.read_text(), secrets): raise RuntimeError('Intent artifact redaction failed: ' + path.name)
        if failure: raise RuntimeError(redact_text(str(failure), secrets)) from None
        if cleanup_error: raise RuntimeError(redact_text(str(cleanup_error), secrets)) from None


if __name__ == '__main__': main()
