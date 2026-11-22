import argparse, hashlib, json
from pathlib import Path

from intent_harness.redaction import contains_secret, discover_secrets, redact
from locking_harness.connections import Connections
from locking_harness.fixture import additional_password_session, apply_private_inputs, context_sql, create_users, migration_inventory, prepare, quote, start
from locking_harness.support import Docker, utc_now, write_json
from .scenarios import run

DB_NAME='kaq-exchange-control-harness-db'; AUTH_NAME='kaq-exchange-control-harness-auth'


def close(docker, connections, artifacts, secrets):
    errors=connections.close() if connections else []
    if connections: secrets.update(discover_secrets(connections.transcript))
    rows=[]
    for name, identifier in reversed(docker.owned):
        inspect=docker.run('inspect',identifier); stop=docker.run('stop',identifier); remove=docker.run('container','rm',identifier)
        left=docker.run('ps','-a','--filter',f'name=^/{name}$','--format','{{.ID}}')
        rows.append({'name':name,'id':identifier,'inspect':inspect.returncode,'stop':stop.returncode,'remove':remove.returncode,'remaining':left.stdout.strip()})
    write_json(artifacts/'cleanup.json',{'containers':rows,'connectionErrors':redact(errors,secrets),'volumesCreated':False,'at':utc_now()})
    if errors or any(row['stop'] or row['remove'] or row['remaining'] for row in rows): raise RuntimeError('exchange harness cleanup failed')


def install(sql):
    sql("""create schema exchange_harness;
    create function exchange_harness.snapshot() returns jsonb language plpgsql as $$ declare r record; result jsonb:='{}'; value jsonb; begin
      for r in select schemaname,tablename from pg_tables where schemaname in ('auth','public','kaq_private') order by schemaname,tablename loop
        execute format('select jsonb_build_object(''count'',count(*),''sha256'',encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb)::text,''sha256''),''hex'')) from %I.%I x',r.schemaname,r.tablename) into value;
        result:=result||jsonb_build_object(r.schemaname||'.'||r.tablename,value); end loop; return result; end $$;
    create function exchange_harness.capture(operation text,p_intent uuid default null,p_secret text default null,p_leg uuid default null,p_revision bigint default null,p_runtime bigint default null,p_claim uuid default null,p_unknown boolean default null) returns jsonb language plpgsql as $$
      declare value jsonb; i kaq_private.account_intents%rowtype; l kaq_private.account_proof_legs%rowtype; leg_guard jsonb; proof_guard jsonb; state text; reason text;
      begin begin
        if operation='begin' then value:=kaq_private.begin_account_intent('add_existing',gen_random_uuid());
        elsif operation='issue' then value:=kaq_private.issue_account_leg(p_intent,p_secret,'source',p_revision,gen_random_uuid(),decode(repeat('11',32),'hex'));
        elsif operation='runtime' then select * into i from kaq_private.account_intents where id=p_intent; select * into l from kaq_private.account_proof_legs where id=p_leg;
          leg_guard:=kaq_private.leg_control_result(i,l)->'guard'; value:=to_jsonb(kaq_private.runtime_compare_and_swap(p_leg,null,jsonb_build_object('revision',0,'keyVersion','v1','nonce',repeat('ab',12),'ciphertext',repeat('cd',16),'expiresAt',leg_guard->'expiresAt'),leg_guard));
        elsif operation='claim' then value:=kaq_private.claim_authorization(p_intent,p_secret,p_leg,p_revision,p_runtime,decode(repeat('12',32),'hex'));
        elsif operation='complete' then value:=kaq_private.complete_authorization(p_intent,p_secret,p_leg,p_claim,p_revision,p_runtime);
        elsif operation='exchange' then value:=kaq_private.claim_exchange(p_intent,p_secret,p_leg,p_revision);
        elsif operation='cancel' then value:=kaq_private.cancel_account_intent(p_intent,p_secret,p_revision);
        elsif operation='fail' then value:=kaq_private.fail_leg(p_intent,p_secret,p_leg,p_claim,p_revision,p_unknown);
        elsif operation='promote' then select * into i from kaq_private.account_intents where id=p_intent; select * into l from kaq_private.account_proof_legs where id=p_leg;
          leg_guard:=kaq_private.leg_control_result(i,l)->'guard'; proof_guard:=jsonb_set(leg_guard,'{purpose}','"proof"'::jsonb)||jsonb_build_object('expiresAt',kaq_private.runtime_epoch_ms(i.expires_at));
          value:=to_jsonb(kaq_private.runtime_promote_proof(p_leg,p_revision,leg_guard,proof_guard,jsonb_build_object('revision',1,'keyVersion','v1','nonce',repeat('ef',12),'ciphertext',repeat('cd',16),'expiresAt',proof_guard->'expiresAt')));
        elsif operation='promote_diagnose' then select * into i from kaq_private.account_intents where id=p_intent; select * into l from kaq_private.account_proof_legs where id=p_leg;
          leg_guard:=kaq_private.leg_control_result(i,l)->'guard'; proof_guard:=jsonb_set(leg_guard,'{purpose}','"proof"'::jsonb)||jsonb_build_object('expiresAt',kaq_private.runtime_epoch_ms(i.expires_at));
          value:=jsonb_build_object('legGuard',kaq_private.runtime_guard_matches(leg_guard,i,l,'leg'),'proofGuard',kaq_private.runtime_guard_matches(proof_guard,i,l,'proof'),'record',kaq_private.runtime_next_valid(jsonb_build_object('revision',1,'keyVersion','v1','nonce',repeat('ef',12),'ciphertext',repeat('cd',16),'expiresAt',proof_guard->'expiresAt'),1,i.expires_at));
        else raise exception using errcode='PT400',message='EXCHANGE_HARNESS_OPERATION_INVALID'; end if;
        return jsonb_build_object('ok',true,'value',value);
      exception when others then get stacked diagnostics state=returned_sqlstate,reason=message_text; return jsonb_build_object('ok',false,'sqlstate',state,'reason',reason); end; end $$;""")


def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--repo-root',required=True); parser.add_argument('--artifact-dir',required=True); args=parser.parse_args()
    root,artifacts=Path(args.repo_root).resolve(),Path(args.artifact_dir).resolve(); artifacts.mkdir(parents=True,exist_ok=True)
    docker,connections,secrets,failure=Docker(),None,set(),None
    paths=[*migration_inventory(root),*(root/'supabase/account-merge'/x for x in ['session-resolver.sql','owner-scope.sql','locking-scope.sql','intent-control-schema.sql','intent-control.sql','runtime-schema.sql','runtime-storage.sql','leg-schema.sql','leg-control.sql','exchange-control-schema.sql','authorization-control.sql','exchange-control.sql']),root/'test/account-merge/exchange-control.sql',root/'test/account-merge/exchange-boundaries.sql',root/'test/account-merge/exchange-harness.ts',root/'scripts/run-account-merge-integration.ts',*sorted((root/'test/account-merge/exchange_harness').glob('*.py')),* (root/'test/account-merge/locking_harness'/x for x in ['fixture.py','connections.py','support.py']),root/'test/account-merge/intent_harness/redaction.py']
    receipt={'status':'running','observedAt':utc_now(),'sourceSha256':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths},'shortJwtCasesExecuted':False}
    try:
        database=start(docker,DB_NAME,AUTH_NAME); connections=Connections(database,docker,quote,context_sql); sql=connections.sql; auth,health=prepare(database,docker,sql,root,AUTH_NAME)
        receipt['sourceInputs']=apply_private_inputs(root,sql,['intent-control-schema.sql','intent-control.sql','runtime-schema.sql','runtime-storage.sql','leg-schema.sql','leg-control.sql','exchange-control-schema.sql','authorization-control.sql','exchange-control.sql'],artifacts)
        users=create_users(docker,auth); alternate=additional_password_session(docker,auth,users[1]); install(sql)
        statement=((root/'test/account-merge/exchange-control.sql').read_text()+'\n'+(root/'test/account-merge/exchange-boundaries.sql').read_text()).replace('__FIRST_USER__',users[1]['userId']).replace('__FIRST_SESSION__',users[1]['sessionId']).replace('__SECOND_USER__',users[0]['userId']).replace('__SECOND_SESSION__',users[0]['sessionId']).replace('__FIRST_ALT_SESSION__',alternate['sessionId'])
        unit=json.loads(next(x for x in sql(statement).splitlines() if x.startswith('{'))); receipt['unit']=unit
        if unit.get('status')!='passed' or unit.get('checks')!=125 or len(set(unit.get('names',[])))!=125: raise RuntimeError('exchange SQL regression checks failed')
        baseline=json.loads(sql('select exchange_harness.snapshot();')); receipt['scenarios']=run({'connections':connections,'sql':sql,'user':users[1],'baseline':baseline})
        final=json.loads(sql('select exchange_harness.snapshot();'))
        if final != baseline: raise RuntimeError('exchange snapshot not restored')
        if any('40P01' in line for item in connections.items for line in item.lines): raise RuntimeError('exchange harness deadlock')
        if any(hashlib.sha256(root.joinpath(name).read_bytes()).hexdigest()!=digest for name,digest in receipt['sourceSha256'].items()): raise RuntimeError('source changed during verification')
        receipt.update(status='passed',gotrueHealth=health,realSessionChecks={'users':len(users),'sessions':4,'signatureAndGetUserVerified':True},baselineSnapshot=baseline,finalSnapshot=final,baselineRestored=True,deadlocks=0)
    except Exception as error: failure=error
    finally:
        cleanup=None
        try: close(docker,connections,artifacts,secrets)
        except Exception as error: cleanup=error
        if connections: secrets.update(discover_secrets(connections.transcript))
        if failure: receipt.update(status='failed',failure=type(failure).__name__,message=redact(str(failure),secrets))
        if cleanup: receipt.update(status='failed',cleanupFailure=redact(str(cleanup),secrets))
        write_json(artifacts/'actual-results.json',receipt)
        for path in artifacts.rglob('*'):
            if path.is_file() and contains_secret(path.read_text(),secrets): raise RuntimeError('exchange artifact secret: '+path.name)
        if failure: raise RuntimeError(redact(str(failure),secrets)) from None
        if cleanup: raise RuntimeError(redact(str(cleanup),secrets)) from None


if __name__=='__main__': main()
