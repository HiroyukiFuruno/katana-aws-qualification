import assert from 'node:assert/strict';
import { json, literal, requiredUuid, sql } from '../account-sdk/sql';

export type ProofRacePort = {
  intentId: string;
  legId: string;
  side: 'source' | 'target';
  proofSessionId: string;
  accept(): Promise<void>;
};

export function snapshot(excludedIntent?: string): string {
  const ownIntent = excludedIntent ? literal(requiredUuid(excludedIntent)) : 'null';
  return sql(`do $$ declare entry record; table_hashes jsonb:='{}'; digest text; clause text; begin
    for entry in select schemaname,tablename from pg_tables
      where schemaname in ('public','auth','kaq_private') order by schemaname,tablename loop
      clause:='';
      if ${ownIntent} is not null and entry.schemaname='kaq_private' then
        if entry.tablename='account_intents' then clause:=format(' where id<>%L',${ownIntent});
        elsif entry.tablename in ('account_proof_legs','account_proofs') then
          clause:=format(' where intent_id<>%L',${ownIntent}); end if;
      end if;
      execute format('select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(row)
        order by to_jsonb(row)::text),''[]''::jsonb)::text,''sha256''),''hex'') from %I.%I row%s',
        entry.schemaname,entry.tablename,clause) into digest;
      table_hashes:=table_hashes||jsonb_build_object(entry.schemaname||'.'||entry.tablename,digest);
    end loop;
    perform set_config('kaq.proof_race_snapshot',table_hashes::text,false);
  end $$; select current_setting('kaq.proof_race_snapshot');`);
}

export function identifiers(port: ProofRacePort) {
  return {
    intent: `${literal(requiredUuid(port.intentId))}::uuid`,
    leg: `${literal(requiredUuid(port.legId))}::uuid`,
    session: `${literal(requiredUuid(port.proofSessionId))}::uuid`,
  };
}

export function assertRejected(result: { ok: boolean; error?: unknown }) {
  assert.equal(result.ok, false, 'An invalidated proof was accepted');
  assert(result.error && typeof result.error === 'object');
  const error = result.error as { status?: unknown; code?: unknown };
  assert.equal(typeof error.status, 'number');
  assert(Number(error.status) >= 400 && Number(error.status) < 500);
  assert.equal(typeof error.code, 'string');
  assert(/^(?:PT4\d\d|28000|P0001)$/.test(String(error.code)));
  return { status: error.status, code: error.code };
}

export function intentState(intent: string) {
  return json<{ state: string; revision: string }>(`select json_build_object(
    'state',state,'revision',revision::text) from kaq_private.account_intents where id=${intent}`);
}

export function restoreIntent(intent: string, prior: ReturnType<typeof intentState>) {
  sql(`update kaq_private.account_intents set state=${literal(prior.state)},
    revision=${literal(prior.revision)}::bigint where id=${intent}`);
}
