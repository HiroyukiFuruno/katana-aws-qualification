import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type Classification = 'auth-only' | 'delete' | 'internal' | 'owner-bound' | 'read' | 'write';
export type TransportCallee = 'request' | 'rpc' | 'write';
export type TransportEntry = {
  name: string;
  kind: 'generic' | 'literal';
  callee: TransportCallee;
  evidence: string;
};
type FunctionEntry = {
  signature: string;
  roles: string[];
  classification: Classification[];
  evidence: string;
};
export type Registry = {
  functions: FunctionEntry[];
  ownerTables: { name: string; evidence: string }[];
  rlsPolicies: { name: string; table: string; evidence: string }[];
  transports: TransportEntry[];
  transportAliases: Omit<TransportEntry, 'kind'>[];
};

const classifications = new Set<Classification>(
  'auth-only delete internal owner-bound read write'.split(' ') as Classification[],
);
const callees = new Set<TransportCallee>(['request', 'rpc', 'write']);
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`invalid manifest ${label}`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`invalid manifest ${label}`);
  return value;
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
    throw new Error(`invalid manifest ${label}`);
  return value;
}

function values(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`invalid manifest ${label}`);
  return value;
}

async function evidenceLine(root: string, evidence: string, transport = false) {
  const pattern = transport ? /^(src\/[a-zA-Z0-9_./-]+):(\d+)$/ : /^([a-zA-Z0-9_]+\.sql):(\d+)$/;
  const match = evidence.match(pattern);
  if (!match) throw new Error(`invalid manifest evidence ${evidence}`);
  const path = transport ? join(root, match[1]) : join(root, 'supabase/migrations', match[1]);
  const line = (await readFile(path, 'utf8')).split('\n')[Number(match[2]) - 1];
  if (!line?.trim()) throw new Error(`missing manifest evidence ${evidence}`);
  return line;
}

async function validateMigrationEntries(root: string, registry: Registry) {
  for (const entry of registry.functions) {
    const line = await evidenceLine(root, entry.evidence);
    if (!line.includes(entry.signature.slice(0, entry.signature.indexOf('('))))
      throw new Error(`invalid function evidence ${entry.signature}`);
  }
  for (const entry of registry.ownerTables) {
    const line = await evidenceLine(root, entry.evidence);
    if (!line.includes(entry.name)) throw new Error(`invalid owner table evidence ${entry.name}`);
  }
  for (const entry of registry.rlsPolicies) {
    const line = await evidenceLine(root, entry.evidence);
    if (!line.includes(entry.name) || !line.includes(entry.table))
      throw new Error(`invalid RLS evidence ${entry.table}:${entry.name}`);
  }
}

async function validateTransportEntries(root: string, entries: TransportEntry[]) {
  for (const entry of entries) {
    const line = await evidenceLine(root, entry.evidence, true);
    if (!line.includes(entry.name)) throw new Error(`invalid transport evidence ${entry.name}`);
  }
}

function transport(value: unknown, label: string): TransportEntry {
  const entry = object(value, label);
  const kind = string(entry.kind, `${label}.kind`);
  const callee = string(entry.callee, `${label}.callee`);
  if (kind !== 'generic' && kind !== 'literal') throw new Error(`invalid manifest ${label}.kind`);
  if (!callees.has(callee as TransportCallee)) throw new Error(`invalid manifest ${label}.callee`);
  return {
    name: string(entry.name, `${label}.name`),
    kind,
    callee: callee as TransportCallee,
    evidence: string(entry.evidence, `${label}.evidence`),
  };
}

export async function readRegistry(evidenceRoot: string): Promise<Registry> {
  const raw = object(
    await Bun.file(new URL('./account-owner-cutover-manifest.json', import.meta.url)).json(),
    'root',
  );
  const functions = values(raw.functions, 'functions').map((value, index) => {
    const entry = object(value, `functions[${index}]`);
    const classification = strings(
      entry.classification,
      `functions[${index}].classification`,
    ) as Classification[];
    if (!classification.length || classification.some((item) => !classifications.has(item)))
      throw new Error(`invalid manifest functions[${index}].classification`);
    return {
      signature: string(entry.signature, `functions[${index}].signature`),
      roles: strings(entry.roles, `functions[${index}].roles`),
      classification,
      evidence: string(entry.evidence, `functions[${index}].evidence`),
    };
  });
  const named = (key: 'ownerTables' | 'rlsPolicies') =>
    values(raw[key], key).map((value, index) => {
      const entry = object(value, `${key}[${index}]`);
      return {
        name: string(entry.name, `${key}[${index}].name`),
        evidence: string(entry.evidence, `${key}[${index}].evidence`),
        ...(key === 'rlsPolicies' ? { table: string(entry.table, `${key}[${index}].table`) } : {}),
      };
    });
  const registry: Registry = {
    functions,
    ownerTables: named('ownerTables'),
    rlsPolicies: named('rlsPolicies') as Registry['rlsPolicies'],
    transports: values(raw.transports, 'transports').map((value, index) =>
      transport(value, `transports[${index}]`),
    ),
    transportAliases: values(raw.transportAliases, 'transportAliases').map((value, index) => {
      const { kind: _kind, ...entry } = transport(
        { ...object(value, `transportAliases[${index}]`), kind: 'literal' },
        `transportAliases[${index}]`,
      );
      return entry;
    }),
  };
  await validateMigrationEntries(evidenceRoot, registry);
  await validateTransportEntries(evidenceRoot, [
    ...registry.transports,
    ...registry.transportAliases.map((entry) => ({ ...entry, kind: 'literal' as const })),
  ]);
  return registry;
}
