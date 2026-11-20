import { expect, test } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

type Definition = { name: string; signature: string; text: string };
type Migration = { name: string; source: string };

const directory = resolve(import.meta.dir, '../supabase/migrations');
const targetNames = [
  'save_exam_response',
  'finalize_exam_session',
  'replace_roadmap_profile',
  'import_roadmap_profile',
];

function definitions(source: string) {
  const markers = [...source.matchAll(/create or replace function public\.(\w+)\(/gi)];
  const matches = [
    ...source.matchAll(
      /create or replace function public\.(\w+)\(([\s\S]*?)\)\s*returns[\s\S]*?\bas\s+\$\$[\s\S]*?\$\$;/gi,
    ),
  ];
  if (markers.length !== matches.length) throw new Error('incomplete public function parser');
  const result = matches.map(([text, name, arguments_]) => ({
    name,
    signature: arguments_.replaceAll(/\s+/g, ' ').trim(),
    text,
  }));
  if (new Set(result.map((entry) => entry.name)).size !== result.length)
    throw new Error('public function overloads are not supported by this migration verifier');
  return result;
}

function effective(migrations: Migration[]) {
  const result = new Map<string, Definition>();
  for (const migration of migrations) {
    for (const definition of definitions(migration.source)) {
      const prior = result.get(definition.name);
      if (prior && prior.signature !== definition.signature)
        throw new Error(`public function overload detected: ${definition.name}`);
      result.set(definition.name, definition);
    }
  }
  return result;
}

async function migrations() {
  const names = (await readdir(directory)).filter((name) => /^\d{12}_[a-z_]+\.sql$/.test(name)).sort();
  return Promise.all(
    names.map(async (name) => ({ name, source: await Bun.file(resolve(directory, name)).text() })),
  );
}

function requireDefinition(values: Map<string, Definition>, name: string) {
  const definition = values.get(name);
  if (!definition) throw new Error(`missing ${name} definition`);
  return definition.text;
}

test('006 changes only four effective revision-conflict SQLSTATEs', async () => {
  const all = await migrations();
  const index = all.findIndex((migration) => migration.name === '202611200006_revision_conflicts.sql');
  expect(index).toBeGreaterThan(0);
  const before = effective(all.slice(0, index));
  const through006 = effective(all.slice(0, index + 1));
  for (const name of targetNames) {
    const prior = requireDefinition(before, name);
    expect((prior.match(/using errcode = '40001'/g) ?? []).length).toBe(1);
    expect(requireDefinition(through006, name)).toBe(
      prior.replace("using errcode = '40001'", "using errcode = 'PT412'"),
    );
  }
  for (const name of [
    'load_roadmap_profile_snapshot',
    'read_learning_clock',
    'save_exam_response_confirmed',
  ])
    expect(requireDefinition(through006, name)).toBe(requireDefinition(before, name));
});

test('no latest effective public function raises custom 40001', async () => {
  for (const definition of effective(await migrations()).values())
    expect(definition.text).not.toContain("using errcode = '40001'");
});
