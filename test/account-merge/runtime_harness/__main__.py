import argparse, hashlib, json
from pathlib import Path
from locking_harness.connections import Connections
from locking_harness.fixture import apply_private_inputs, create_users, prepare, quote, start
from locking_harness.support import Docker, utc_now, write_json
from .scenarios import concurrent_initial, revision_race
from .phase_races import cleanup_after_promotion, promotion_once, stale_context_race

DB_NAME='kaq-runtime-storage-harness-db'; AUTH_NAME='kaq-runtime-storage-harness-auth'

def close(docker, connections, artifacts):
    errors=connections.close() if connections else []; rows=[]
    for name, identifier in reversed(docker.owned):
        inspect=docker.run('inspect',identifier); stop=docker.run('stop',identifier); remove=docker.run('container','rm',identifier)
        left=docker.run('ps','-a','--filter',f'name=^/{name}$','--format','{{.ID}}')
        rows.append({'name':name,'id':identifier,'inspect':inspect.returncode,'stop':stop.returncode,'remove':remove.returncode,'remaining':left.stdout.strip()})
    write_json(artifacts/'cleanup.json',{'containers':rows,'connectionErrors':errors,'volumesCreated':False,'at':utc_now()})
    if errors or any(r['stop'] or r['remove'] or r['remaining'] for r in rows): raise RuntimeError('runtime harness cleanup failed')

def snapshot_install(sql):
    sql("""create schema runtime_harness; create function runtime_harness.snapshot() returns jsonb language plpgsql as $$
      declare relation_record record; result jsonb := '{}'::jsonb; value jsonb;
      begin for relation_record in select schemaname,tablename from pg_tables where schemaname in ('auth','public','kaq_private') order by schemaname,tablename loop
        execute format('select jsonb_build_object(''count'',count(*),''sha256'',encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text),''[]''::jsonb)::text,''sha256''),''hex'')) from %I.%I row',relation_record.schemaname,relation_record.tablename) into value;
        result := result || jsonb_build_object(relation_record.schemaname || '.' || relation_record.tablename,value); end loop; return result; end $$;""")

def main():
    p=argparse.ArgumentParser(); p.add_argument('--repo-root',required=True); p.add_argument('--artifact-dir',required=True); a=p.parse_args(); root=Path(a.repo_root).resolve(); artifacts=Path(a.artifact_dir).resolve(); artifacts.mkdir(parents=True,exist_ok=True)
    docker= Docker(); connections=None; receipt={'status':'running','observedAt':utc_now(),'shortJwtCasesExecuted':False}; failure=None
    paths=[*sorted((root/'supabase/migrations').glob('*.sql')),*(root/'supabase/account-merge'/n for n in ['session-resolver.sql','owner-scope.sql','locking-scope.sql','runtime-schema.sql','runtime-storage.sql']),root/'test/account-merge/runtime-storage.sql',*sorted((root/'test/account-merge/runtime_harness').glob('*.py')),
        *(root/'test/account-merge/locking_harness'/name for name in ['fixture.py','connections.py','support.py']),
        root/'test/account-merge/runtime-harness.ts',root/'scripts/run-account-merge-integration.ts']
    receipt['sourceSha256']={str(x.relative_to(root)):hashlib.sha256(x.read_bytes()).hexdigest() for x in paths}
    try:
        database=start(docker,DB_NAME,AUTH_NAME); connections=Connections(database,docker,quote,lambda *_:''); auth, health=prepare(database,docker,connections.sql,root,AUTH_NAME)
        receipt['sourceInputs']=apply_private_inputs(root,connections.sql,['runtime-schema.sql','runtime-storage.sql'],artifacts); receipt['gotrueHealth']=health
        receipt['postgresVersion']=connections.sql('select version()'); users=create_users(docker,auth)
        receipt['realSessionChecks']={'users':len(users),'signatureAndGetUserVerified':True}
        snapshot_install(connections.sql); baseline=json.loads(connections.sql('select runtime_harness.snapshot();'))
        result=json.loads(next(x for x in connections.sql((root/'test/account-merge/runtime-storage.sql').read_text()).splitlines() if x.startswith('{')))
        if result.get('status')!='passed' or result.get('checks')!=121: raise RuntimeError('runtime SQL regression checks failed')
        env={'sql':connections.sql,'connections':connections}; receipt['unit']=result; receipt['scenarios']={'concurrentInitial':concurrent_initial(env),'revisionRace':revision_race(env),'promotionOnce':promotion_once(env),'cleanupAfterPromotion':cleanup_after_promotion(env),'staleContextRace':stale_context_race(env)}; final=json.loads(connections.sql('select runtime_harness.snapshot();'))
        if final != baseline: raise RuntimeError('runtime harness baseline differs after scenarios')
        if any('40P01' in line for item in connections.items for line in item.lines): raise RuntimeError('Runtime harness observed a deadlock')
        receipt.update(status='passed',opaqueFixtureOnly=True,deadlockErrors=0,baselineSnapshot=baseline,finalSnapshot=final,baselineRestored=True)
        if any(hashlib.sha256(root.joinpath(name).read_bytes()).hexdigest()!=digest for name,digest in receipt['sourceSha256'].items()): raise RuntimeError('source changed during verification')
    except Exception as error: failure=error
    finally:
        try: close(docker,connections,artifacts)
        except Exception as error: failure=error
        if failure: receipt.update(status='failed',failure=type(failure).__name__,message=str(failure))
        write_json(artifacts/'actual-results.json',receipt)
        if failure: raise RuntimeError(str(failure))

if __name__=='__main__': main()
