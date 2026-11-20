import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalJson, sha256 } from './fundamentals-delivery/hash';

type Unit = {
  contentHash: string;
  contentVersion: string;
  finalPolicy: { attemptScope: string; passCorrect: number; questionCount: number; ratio: number };
  finalQuestions: { position: number; questionId: string }[] & Record<string, unknown>[];
  plan: { id: string; kind: string; position: number }[];
  unitId: string;
};

type Catalog = { schemaVersion: number; units: Unit[] };

const root = process.cwd();

async function json(path: string) {
  return JSON.parse(await readFile(join(root, path), 'utf8')) as unknown;
}

function fail(message: string): never {
  throw new Error(`Invalid fundamentals seed input: ${message}`);
}

function dollar(value: unknown, name: string) {
  const body = JSON.stringify(value, null, 2);
  for (let index = 0; ; index += 1) {
    const tag = `$kaq_${name}_${index}$`;
    if (!body.includes(tag)) return `${tag}${body}${tag}`;
  }
}

function text(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function seedSql() {
  const trusted = (await json('public/fundamentals/delivery/trustedCatalog.json')) as Catalog;
  const index = (await json('public/fundamentals/delivery/index.json')) as { units: Unit[] };
  const manifest = (await json('src/fundamentals/delivery/routeManifest.json')) as {
    units: {
      contentVersion: string;
      finalQuestions: { position: number; questionId: string }[];
      nonFinalSteps: { id: string; kind: string; globalPosition: number }[];
      unitId: string;
    }[];
  };
  if (
    trusted.schemaVersion !== 1 ||
    trusted.units.length !== 12 ||
    index.units.length !== 12 ||
    manifest.units.length !== 12
  )
    fail('expected exactly twelve units in all artifacts');
  const ids = new Set<string>();
  const rows = trusted.units.map((unit) => {
    if (!ids.add(unit.unitId)) fail(`duplicate unit ${unit.unitId}`);
    const indexUnit = index.units.find((item) => item.unitId === unit.unitId);
    const route = manifest.units.find((item) => item.unitId === unit.unitId);
    if (
      !indexUnit ||
      !route ||
      indexUnit.contentVersion !== unit.contentVersion ||
      route.contentVersion !== unit.contentVersion
    )
      fail(`version mismatch for ${unit.unitId}`);
    if (
      unit.finalQuestions.length !== 12 ||
      unit.finalPolicy.questionCount !== 12 ||
      unit.finalPolicy.passCorrect !== 10 ||
      unit.finalPolicy.ratio !== 0.8 ||
      unit.finalPolicy.attemptScope !== 'current-attempt-only'
    )
      fail(`invalid final policy for ${unit.unitId}`);
    if (
      unit.plan.filter((step) => step.kind === 'checkpoint').length !== 4 ||
      unit.plan.some((step, offset) => step.position !== offset + 1) ||
      new Set(unit.plan.map((step) => step.id)).size !== unit.plan.length
    )
      fail(`invalid non-final plan for ${unit.unitId}`);
    if (
      route.nonFinalSteps.length !== unit.plan.length ||
      route.nonFinalSteps.some(
        (step, offset) =>
          step.id !== unit.plan[offset]?.id ||
          step.kind !== unit.plan[offset]?.kind ||
          step.globalPosition !== unit.plan[offset]?.position,
      )
    )
      fail(`route manifest mismatch for ${unit.unitId}`);
    if (
      route.finalQuestions.some(
        (question, offset) =>
          question.questionId !== unit.finalQuestions[offset]?.questionId ||
          question.position !== offset + 1,
      ) ||
      unit.finalQuestions.some((question, offset) => question.position !== offset)
    )
      fail(`final question order mismatch for ${unit.unitId}`);
    const calculated = sha256({
      contentVersion: unit.contentVersion,
      finalPolicy: unit.finalPolicy,
      finalQuestions: unit.finalQuestions,
      plan: unit.plan,
      unitId: unit.unitId,
    });
    if (calculated !== unit.contentHash || !/^[0-9a-f]{64}$/.test(unit.contentHash))
      fail(`content hash mismatch for ${unit.unitId}`);
    return `  (${text(unit.unitId)}, ${text(unit.contentVersion)}, decode(${text(unit.contentHash)}, 'hex'),\n    ${dollar(unit.plan, `plan_${ids.size}`)}::jsonb,\n    ${dollar(unit.finalQuestions, `final_${ids.size}`)}::jsonb)`;
  });
  return `-- Generated from public/fundamentals/delivery/trustedCatalog.json. Do not edit manually.\n-- The hash is Node canonical JSON SHA-256, stored as decode(hex, 'hex').\nbegin;\n\ninsert into public.published_fundamentals_catalogs (\n  unit_id, content_version, content_hash, plan, final_questions\n) values\n${rows.join(',\n')}\n;\n\ncommit;\n`;
}

export { canonicalJson };
