import {
  type Classification,
  type Registry,
  readRegistry,
  type TransportEntry,
} from './account-owner-cutover-registry.ts';
import { type FunctionSurface, readSourceAudit } from './account-owner-cutover-source.ts';
import { readTransportCallsites, type TransportCallsite } from './account-owner-cutover-transports.ts';

type ClassifiedFunction = FunctionSurface & { classification?: Classification[] };
export type CutoverAudit = {
  functions: ClassifiedFunction[];
  ownerTables: string[];
  rlsPolicies: string[];
  transports: TransportEntry[];
  definitionCount: number;
  functionCount: number;
  ownerTableCount: number;
  rlsPolicyCount: number;
  transportCount: number;
  transportNameCount: number;
};

function assertUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error(`duplicate manifest ${label}`);
}

function assertSet(actual: string[], expected: string[], label: string) {
  for (const value of actual)
    if (!expected.includes(value)) throw new Error(`unclassified ${label} ${value}`);
  for (const value of expected) if (!actual.includes(value)) throw new Error(`stale ${label} ${value}`);
}

function transportKey(entry: Pick<TransportEntry, 'name' | 'callee' | 'evidence'>) {
  return `${entry.evidence}:${entry.callee}:${entry.name}`;
}

function transportRecords(callsites: TransportCallsite[], registry: Registry): TransportEntry[] {
  const expected = registry.transports;
  const aliases = new Set(registry.transportAliases.map(transportKey));
  for (const callsite of callsites) {
    const key = transportKey(callsite);
    if (!expected.some((entry) => transportKey(entry) === key) && !aliases.has(key))
      throw new Error(`unclassified transport callsite ${key}`);
  }
  for (const entry of expected)
    if (!callsites.some((callsite) => transportKey(callsite) === transportKey(entry)))
      throw new Error(`stale transport callsite ${transportKey(entry)}`);
  for (const key of aliases)
    if (!callsites.some((callsite) => transportKey(callsite) === key))
      throw new Error(`stale transport alias ${key}`);
  return callsites
    .flatMap((callsite) => expected.filter((entry) => transportKey(entry) === transportKey(callsite)))
    .sort((left, right) => transportKey(left).localeCompare(transportKey(right)));
}

export function assertCompleteManifest(registry: Registry, audit: CutoverAudit) {
  assertUnique(
    registry.functions.map((entry) => entry.signature),
    'function',
  );
  assertUnique(
    registry.ownerTables.map((entry) => entry.name),
    'owner table',
  );
  assertUnique(
    registry.rlsPolicies.map((entry) => `${entry.table}:${entry.name}`),
    'RLS policy',
  );
  assertUnique(
    registry.transports.map((entry) => `${entry.kind}:${transportKey(entry)}`),
    'transport',
  );
  assertUnique(registry.transportAliases.map(transportKey), 'transport alias');
  assertSet(
    audit.functions.map((entry) => entry.signature),
    registry.functions.map((entry) => entry.signature),
    'function',
  );
  for (const entry of audit.functions) {
    const expected = registry.functions.find((item) => item.signature === entry.signature);
    if (expected && expected.roles.join(',') !== [...entry.roles].sort().join(','))
      throw new Error(`ACL drift ${entry.signature}`);
  }
  assertSet(
    audit.ownerTables,
    registry.ownerTables.map((entry) => entry.name),
    'owner table',
  );
  assertSet(
    audit.rlsPolicies,
    registry.rlsPolicies.map((entry) => `${entry.table}:${entry.name}`),
    'RLS policy',
  );
  assertSet(audit.transports.map(transportKey), registry.transports.map(transportKey), 'transport');
}

export async function auditOwnerCutoverManifest(root: string): Promise<CutoverAudit> {
  const [registry, migration, callsites] = await Promise.all([
    readRegistry(root),
    readSourceAudit(root),
    readTransportCallsites(root),
  ]);
  const transports = transportRecords(callsites, registry);
  const functions = migration.functions.map((entry) => ({
    ...entry,
    classification: registry.functions.find((item) => item.signature === entry.signature)
      ?.classification,
  }));
  const audit = {
    ...migration,
    functions,
    transports,
    functionCount: migration.functions.length,
    ownerTableCount: migration.ownerTables.length,
    rlsPolicyCount: migration.rlsPolicies.length,
    transportCount: transports.length,
    transportNameCount: new Set(transports.map((entry) => entry.name)).size,
  };
  assertCompleteManifest(registry, audit);
  return audit;
}
