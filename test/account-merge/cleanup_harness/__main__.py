import argparse, hashlib, json, os, subprocess
from pathlib import Path
from locking_harness.connections import Connections
from locking_harness.fixture import apply_private_inputs, prepare, quote, start
from locking_harness.support import Docker, utc_now, write_json
from .support import has_deadlock, sdk_receipt

DB_NAME='kaq-runtime-cleanup-harness-db'; AUTH_NAME='kaq-runtime-cleanup-harness-auth'

def close(docker, connections, artifacts):
    errors=connections.close() if connections else []; rows=[]
    for name, identifier in reversed(docker.owned):
        inspect=docker.run('inspect',identifier); stop=docker.run('stop',identifier); remove=docker.run('container','rm',identifier)
        left=docker.run('ps','-a','--filter',f'name=^/{name}$','--format','{{.ID}}')
        rows.append({'name':name,'id':identifier,'inspect':inspect.returncode,'stop':stop.returncode,'remove':remove.returncode,'remaining':left.stdout.strip()})
    write_json(artifacts/'cleanup.json',{'containers':rows,'connectionErrors':errors,'volumesCreated':False,'at':utc_now()})
    if errors or any(row['stop'] or row['remove'] or row['remaining'] for row in rows): raise RuntimeError('cleanup failed')

def fixture(sql, seconds):
    result=sql(f"""with clock as (select date_trunc('milliseconds',clock_timestamp()) issued), ids as (select gen_random_uuid() intent_id,gen_random_uuid() leg_id)
      , intent as (insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,expires_at)
        select intent_id,'add_existing',gen_random_uuid(),gen_random_uuid(),decode(repeat('11',32),'hex'),issued+interval '9 minutes' from ids,clock returning id,expires_at)
      , leg as (insert into kaq_private.account_proof_legs(id,intent_id,side,attempt,storage_key,ingest_nonce_hash,issued_at,expires_at)
        select ids.leg_id,intent.id,'source',1,'kaq-proof:'||intent.id||':'||ids.leg_id||':1',decode(repeat('22',32),'hex'),clock.issued,clock.issued+interval '{seconds} seconds' from ids,intent,clock returning id,intent_id,attempt,storage_key,issued_at,expires_at)
      select jsonb_build_object('purpose','leg','intentId',leg.intent_id,'legId',leg.id,'attempt',leg.attempt,'storageKey',leg.storage_key,
        'issuedAt',kaq_private.runtime_epoch_ms(leg.issued_at),'expiresAt',kaq_private.runtime_epoch_ms(leg.expires_at),'intentExpiresAt',kaq_private.runtime_epoch_ms(intent.expires_at)) from leg join intent on intent.id=leg.intent_id;""")
    return json.loads(result)

def snapshot_install(sql):
    sql("""create schema cleanup_harness; create function cleanup_harness.snapshot() returns jsonb language plpgsql as $$
      declare relation_record record; result jsonb := '{}'::jsonb; value jsonb;
      begin for relation_record in select schemaname,tablename from pg_tables where schemaname in ('auth','public','kaq_private') order by schemaname,tablename loop
        execute format('select jsonb_build_object(''count'',count(*),''sha256'',encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text),''[]''::jsonb)::text,''sha256''),''hex'')) from %I.%I row',relation_record.schemaname,relation_record.tablename) into value;
        result := result || jsonb_build_object(relation_record.schemaname || '.' || relation_record.tablename,value); end loop; return result; end $$;""")

def preserve_previous(artifacts):
    previous=artifacts/'actual-results.json'
    if previous.exists():
        value=json.loads(previous.read_text())
        if value.get('status')=='passed': write_json(artifacts/'history'/(hashlib.sha256(previous.read_bytes()).hexdigest()[:16]+'.json'),value)

def legacy_red(sql):
    value=fixture(sql,120); guard=json.dumps({key:value[key] for key in ['purpose','intentId','legId','attempt','storageKey','issuedAt','expiresAt']})
    record=json.dumps({'revision':0,'keyVersion':'v1','nonce':'ab'*12,'ciphertext':'cd'*16,'expiresAt':value['expiresAt']})
    if sql(f"select kaq_private.runtime_compare_and_swap('{value['legId']}'::uuid,null,'{record}'::jsonb,'{guard}'::jsonb);")!='t': raise RuntimeError('legacy setup failed')
    sql(f"update kaq_private.account_intents set state='cancelled' where id='{value['intentId']}'::uuid;")
    return value['intentId'],{'normalReadIsNull':sql(f"select kaq_private.runtime_read('{value['legId']}'::uuid,'{guard}'::jsonb) is null;")=='t',
      'nullRevisionDelete':sql(f"select kaq_private.runtime_delete_if_revision('{value['legId']}'::uuid,null,'{guard}'::jsonb);")}

def remove_fixtures(sql, intent_ids):
    sql('delete from kaq_private.account_intents where id in ('+','.join(quote(value)+'::uuid' for value in intent_ids)+');')

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--repo-root',required=True); parser.add_argument('--artifact-dir',required=True); args=parser.parse_args()
    root=Path(args.repo_root).resolve(); artifacts=Path(args.artifact_dir).resolve(); artifacts.mkdir(parents=True,exist_ok=True); preserve_previous(artifacts)
    docker=Docker(); connections=None; receipt={'status':'running','observedAt':utc_now(),'realWebCrypto':True,'memoryRepositoryUsed':False}; failure=None
    paths=[*sorted((root/'supabase/migrations').glob('*.sql')),*(root/'supabase/account-merge'/name for name in ['session-resolver.sql','owner-scope.sql','locking-scope.sql','runtime-schema.sql','runtime-storage.sql','runtime-cleanup.sql']),*sorted((root/'supabase/functions/account-linking/runtime').glob('*.ts')),root/'scripts/account-linking-runtime-fixture.ts',root/'scripts/account-linking-runtime.cleanup-revision.test.ts',root/'scripts/run-account-merge-integration.ts',root/'test/account-merge/runtime-cleanup.sql',root/'test/account-merge/cleanup-harness.ts',*(root/'test/account-merge/locking_harness'/name for name in ['fixture.py','connections.py','support.py']),*(path for path in sorted((root/'test/account-merge/cleanup_harness').glob('*')) if path.is_file())]
    receipt['sourceSha256']={str(path.relative_to(root)):hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}
    try:
        database=start(docker,DB_NAME,AUTH_NAME); connections=Connections(database,docker,quote,lambda *_:'')
        _, health=prepare(database,docker,connections.sql,root,AUTH_NAME)
        receipt['gotrueBootstrapOnly']=bool(health)
        receipt['sourceInputs']=apply_private_inputs(root,connections.sql,['runtime-schema.sql','runtime-storage.sql'],artifacts)
        snapshot_install(connections.sql); baseline=json.loads(connections.sql('select cleanup_harness.snapshot();'))
        red_intent,red=legacy_red(connections.sql)
        if red != {'normalReadIsNull':True,'nullRevisionDelete':'conflict'}: raise RuntimeError('legacy mismatch did not reproduce')
        write_json(artifacts/'old-read-null-delete-conflict.json',red)
        receipt['legacyRed']=red
        receipt['sourceInputs'].update(apply_private_inputs(root,connections.sql,['runtime-cleanup.sql'],artifacts))
        result=json.loads(next(line for line in connections.sql((root/'test/account-merge/runtime-cleanup.sql').read_text()).splitlines() if line.startswith('{')))
        if result.get('status')!='passed' or result.get('checks')!=19: raise RuntimeError('cleanup SQL assertions failed')
        fixtures=[fixture(connections.sql,120),fixture(connections.sql,3),fixture(connections.sql,120)]
        env={**os.environ,'CLEANUP_CONTAINER':database,'CLEANUP_FIXTURES':json.dumps(fixtures)}
        process=subprocess.run(['bun',str(root/'test/account-merge/cleanup_harness/runtime-cleanup-sdk.ts')],cwd=root,env=env,capture_output=True,text=True)
        if has_deadlock(process,connections): raise RuntimeError('cleanup harness observed deadlock')
        if process.returncode: raise RuntimeError('SDK cleanup verification failed')
        sdk=sdk_receipt(process.stdout); remove_fixtures(connections.sql,[red_intent,*(value['intentId'] for value in fixtures)])
        final=json.loads(connections.sql('select cleanup_harness.snapshot();'))
        if final!=baseline: raise RuntimeError('cleanup fixture state was not restored')
        receipt.update(sqlUnit=result,sdk=sdk,deadlockErrors=0,baselineSnapshot=baseline,finalSnapshot=final,baselineRestored=True,status='passed')
        if any(hashlib.sha256(root.joinpath(name).read_bytes()).hexdigest()!=digest for name,digest in receipt['sourceSha256'].items()): raise RuntimeError('source changed during verification')
    except Exception as error: failure=error
    finally:
        try: close(docker,connections,artifacts)
        except Exception as error: failure=error
        if failure: receipt.update(status='failed',failure=type(failure).__name__)
        write_json(artifacts/'actual-results.json',receipt)
        if failure: raise RuntimeError(type(failure).__name__)

if __name__=='__main__': main()
