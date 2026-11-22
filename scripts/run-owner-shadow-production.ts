import { spawnSync } from 'node:child_process';
import {
  ledgerState,
  migrationFrame,
  projectRef,
  readOnlyPreflightFrame,
  readSource,
  rows,
} from './owner-shadow-production';
import { contract, contractMatches } from './owner-shadow-production-contract';
import { parseProductionArgs } from './owner-shadow-production-options';
import { applyWithRecovery } from './owner-shadow-production-transport';

type Json = Record<string, unknown> | unknown[];
type Reply = { body: Json | null; status: number };
const service = 'KAQ Supabase Management Token';

function token() {
  const result = spawnSync('security', ['find-generic-password', '-s', service, '-w'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) throw new Error('Management Keychain credential is unavailable');
  const value = result.stdout.trim();
  if (!value) throw new Error('Management Keychain credential is empty');
  return value;
}

async function request(
  path: string,
  payload: Record<string, unknown>,
  credential: string,
): Promise<Reply> {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { body: await response.json().catch(() => null), status: response.status };
}

function result(body: Json | null) {
  const candidates = Array.isArray(body) ? body : [body];
  const row = [...candidates]
    .reverse()
    .find((entry) => !!entry && typeof entry === 'object' && !Array.isArray(entry) && 'result' in entry);
  if (!row || typeof row !== 'object' || Array.isArray(row))
    throw new Error('Preflight returned no row');
  const value = (row as Record<string, unknown>).result;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Preflight result is invalid');
  return value as Record<string, unknown>;
}

function code(body: Json | null) {
  if (!body || typeof body !== 'object') return null;
  const error = Array.isArray(body) ? body[0] : body;
  if (!error || typeof error !== 'object') return null;
  const value = error as Record<string, unknown>;
  return typeof value.code === 'string' ? value.code : null;
}

function privilege(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (entry) =>
      !!entry &&
      typeof entry === 'object' &&
      !Array.isArray(entry) &&
      Object.values(entry as Record<string, unknown>).every((allowed) => allowed === true),
  );
}

async function preflight(credential: string, sourceHash: string) {
  const reply = await request('/database/query', { query: readOnlyPreflightFrame() }, credential);
  if (reply.status !== 201) throw new Error(`Preflight failed: HTTP ${reply.status}`);
  const value = result(reply.body);
  const role = value.role;
  if (
    !role ||
    typeof role !== 'object' ||
    Array.isArray(role) ||
    (role as Record<string, unknown>).currentUser !== 'postgres'
  )
    throw new Error('Preflight role is not postgres');
  const flags = role as Record<string, unknown>;
  if (
    flags.superuser !== false ||
    flags.bypassRls !== true ||
    flags.inherit !== true ||
    flags.createDb !== true ||
    flags.createRole !== true
  )
    throw new Error('Preflight role flags differ from the production contract');
  if (!privilege(value.privileges)) throw new Error('Preflight privileges are insufficient');
  if (typeof value.contractFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(value.contractFingerprint))
    throw new Error('Preflight fingerprint is invalid');
  if (!contractMatches(value.contract, contract()))
    throw new Error('Preflight contract inventory differs from source');
  const transaction = value.transaction;
  if (!transaction || typeof transaction !== 'object' || Array.isArray(transaction))
    throw new Error('Preflight transaction evidence is absent');
  if (
    (transaction as Record<string, unknown>).isolation !== 'serializable' ||
    (transaction as Record<string, unknown>).readOnly !== 'on'
  )
    throw new Error('Preflight transaction framing differs from the required contract');
  const state = ledgerState(rows(value.ledger), sourceHash);
  return { fingerprint: value.contractFingerprint, state };
}

const options = parseProductionArgs(process.argv.slice(2));
const source = readSource();
const credential = token();
const before = await preflight(credential, source.sourceHash);
if (options.apply && options.sourceHash !== source.sourceHash)
  throw new Error('Verified source SHA-256 differs from the current source');
if (!options.apply || before.state === 'applied') {
  console.log(
    JSON.stringify({
      mode: options.apply ? 'noop' : 'dry-run',
      projectRef,
      state: before.state,
      sourceHash: source.sourceHash,
    }),
  );
  process.exit(0);
}
const outcome = await applyWithRecovery(
  () => preflight(credential, source.sourceHash),
  async (fingerprint) => {
    const reply = await request(
      '/database/query',
      { query: migrationFrame(source, fingerprint) },
      credential,
    );
    if (reply.status === 201) return;
    throw Object.assign(new Error(`Apply rejected: HTTP ${reply.status}`), { code: code(reply.body) });
  },
);
console.log(JSON.stringify({ mode: outcome, projectRef, sourceHash: source.sourceHash }));
