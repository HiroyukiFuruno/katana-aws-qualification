import argparse
import hashlib
import json
from pathlib import Path

from locking_harness.connections import Connections
from locking_harness.fixture import additional_password_session, apply_private_inputs, context_sql, create_users, prepare, quote, start
from locking_harness.support import Docker, utc_now, write_json
from intent_harness.redaction import contains_secret, discover_secrets, redact
from .scenarios import run

DB_NAME = 'kaq-leg-control-harness-db'
AUTH_NAME = 'kaq-leg-control-harness-auth'


def close(docker, connections, artifacts, secrets):
    errors = connections.close() if connections else []
    if connections: secrets.update(discover_secrets(connections.transcript))
    rows = []
    for name, identifier in reversed(docker.owned):
        inspect = docker.run('inspect', identifier); stop = docker.run('stop', identifier)
        remove = docker.run('container', 'rm', identifier)
        left = docker.run('ps', '-a', '--filter', f'name=^/{name}$', '--format', '{{.ID}}')
        rows.append({'name': name, 'id': identifier, 'inspect': inspect.returncode, 'stop': stop.returncode,
                     'remove': remove.returncode, 'remaining': left.stdout.strip()})
    write_json(artifacts / 'cleanup.json', {'containers': rows, 'connectionErrors': redact(errors, secrets), 'volumesCreated': False, 'at': utc_now()})
    if errors or any(row['stop'] or row['remove'] or row['remaining'] for row in rows):
        raise RuntimeError('leg harness cleanup failed')


def snapshot_install(sql):
    sql("""create schema leg_harness; create function leg_harness.snapshot() returns jsonb language plpgsql as $$
      declare record_row record; result jsonb := '{}'::jsonb; value jsonb;
      begin for record_row in select schemaname,tablename from pg_tables where schemaname in ('auth','public','kaq_private') order by schemaname,tablename loop
        execute format('select jsonb_build_object(''count'',count(*),''sha256'',encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text),''[]''::jsonb)::text,''sha256''),''hex'')) from %I.%I row',record_row.schemaname,record_row.tablename) into value;
        result := result || jsonb_build_object(record_row.schemaname || '.' || record_row.tablename,value); end loop; return result; end $$;""")


def install(sql):
    sql("""create function leg_harness.capture(operation text, intent_id uuid, intent_secret text, expected_revision bigint,
      idempotency_key uuid, nonce_hex text, replace_active boolean) returns jsonb language plpgsql as $$
      declare value jsonb; state text; reason text; begin
        begin
          if operation='issue' then value:=kaq_private.issue_account_leg(intent_id,intent_secret,'source',expected_revision,idempotency_key,decode(repeat(nonce_hex,32),'hex'),replace_active);
          elsif operation='cancel' then value:=kaq_private.cancel_account_intent(intent_id,intent_secret,expected_revision);
          else raise exception using errcode='PT400',message='LEG_HARNESS_OPERATION_INVALID'; end if;
          return jsonb_build_object('ok',true,'value',value);
        exception when others then get stacked diagnostics state=returned_sqlstate,reason=message_text;
          return jsonb_build_object('ok',false,'sqlstate',state,'reason',reason); end;
      end $$;""")


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--repo-root', required=True); parser.add_argument('--artifact-dir', required=True)
    args = parser.parse_args(); root = Path(args.repo_root).resolve(); artifacts = Path(args.artifact_dir).resolve(); artifacts.mkdir(parents=True, exist_ok=True)
    docker, connections, failure, secrets = Docker(), None, None, set()
    paths = [*sorted((root / 'supabase/migrations').glob('*.sql')),
             *(root / 'supabase/account-merge' / name for name in ['session-resolver.sql', 'owner-scope.sql', 'locking-scope.sql', 'intent-control-schema.sql', 'intent-control.sql', 'runtime-schema.sql', 'runtime-storage.sql', 'leg-schema.sql', 'leg-control.sql']),
             root / 'test/account-merge/leg-control.sql', *sorted((root / 'test/account-merge/leg_harness').glob('*.py')),
             root / 'test/account-merge/leg-harness.ts', root / 'scripts/run-account-merge-integration.ts',
             root / 'test/account-merge/intent_harness/redaction.py',
             *(root / 'test/account-merge/locking_harness' / name for name in ['fixture.py', 'connections.py', 'support.py'])]
    receipt = {'status': 'running', 'observedAt': utc_now(), 'sourceSha256': {str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}, 'shortJwtCasesExecuted': False}
    try:
        database = start(docker, DB_NAME, AUTH_NAME); connections = Connections(database, docker, quote, context_sql)
        auth, health = prepare(database, docker, connections.sql, root, AUTH_NAME)
        receipt['sourceInputs'] = apply_private_inputs(root, connections.sql, ['intent-control-schema.sql', 'intent-control.sql', 'runtime-schema.sql', 'runtime-storage.sql', 'leg-schema.sql', 'leg-control.sql'], artifacts)
        users = create_users(docker, auth); alternate = additional_password_session(docker, auth, users[1]); snapshot_install(connections.sql); install(connections.sql); baseline = json.loads(connections.sql('select leg_harness.snapshot();'))
        statement = (root / 'test/account-merge/leg-control.sql').read_text()
        statement = statement.replace('__FIRST_USER__', users[0]['userId']).replace('__FIRST_SESSION__', users[0]['sessionId'])
        statement = statement.replace('__SECOND_USER__', users[1]['userId']).replace('__SECOND_SESSION__', users[1]['sessionId']).replace('__SECOND_ALT_SESSION__', alternate['sessionId'])
        unit = json.loads(next(line for line in connections.sql(statement).splitlines() if line.startswith('{')))
        if unit.get('status') != 'passed' or unit.get('checks') != 40: raise RuntimeError('leg SQL regression checks failed')
        receipt['scenarios'] = run({'connections': connections, 'sql': connections.sql, 'user': users[1], 'baseline': baseline})
        final = json.loads(connections.sql('select leg_harness.snapshot();'))
        if final != baseline: raise RuntimeError('leg fixture baseline differs after rollback')
        if any('40P01' in line for item in connections.items for line in item.lines): raise RuntimeError('leg harness observed a deadlock')
        if any(hashlib.sha256(root.joinpath(name).read_bytes()).hexdigest() != digest for name, digest in receipt['sourceSha256'].items()):
            raise RuntimeError('source changed during verification')
        receipt.update(status='passed', unit=unit, gotrueHealth=health, realSessionChecks={'users': len(users), 'sessions': 4, 'signatureAndGetUserVerified': True}, baselineSnapshot=baseline, finalSnapshot=final, baselineRestored=True, deadlocks=0)
    except Exception as error:
        failure = error
    finally:
        cleanup_failure = None
        try: close(docker, connections, artifacts, secrets)
        except Exception as error: cleanup_failure = error
        if connections: secrets.update(discover_secrets(connections.transcript))
        if failure: receipt.update(status='failed', failure=type(failure).__name__, message=redact(str(failure), secrets))
        if cleanup_failure: receipt.update(status='failed', cleanupFailure=redact(str(cleanup_failure), secrets))
        write_json(artifacts / 'actual-results.json', receipt)
        for path in artifacts.rglob('*'):
            if path.is_file() and contains_secret(path.read_text(), secrets): raise RuntimeError('leg artifact redaction failed: ' + path.name)
        if failure: raise RuntimeError(redact(str(failure), secrets)) from None
        if cleanup_failure: raise RuntimeError(redact(str(cleanup_failure), secrets)) from None


if __name__ == '__main__':
    main()
