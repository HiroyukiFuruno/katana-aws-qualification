import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertDistinctChoices, validateTranslation } from './content-translation-validation';
import {
  fundamentalsTranslationJobs,
  type NarrativeUnit,
  narrativeUnits,
} from './fundamentals-translation-data';
import { runNaturalTranslationAgent } from './natural-translation-agent';
import { targetLocalesFor } from './natural-translation-schema';

export const narrativeRoot = 'output/question-quality/ai/narrative';
export const narrativeLocales = targetLocalesFor('ja');
export type NaturalNarrativeRecord = {
  locales: Record<string, string[]>;
  model: string;
  thread: string;
  usage: unknown;
};
export function validateNarrative(unit: NarrativeUnit, record: NaturalNarrativeRecord) {
  assert(record.thread && record.model, 'Missing natural translation provenance');
  for (const locale of narrativeLocales) {
    const texts = record.locales[locale];
    assert(Array.isArray(texts) && texts.length === unit.fields.length, 'Narrative field count changed');
    for (const [index, field] of unit.fields.entries())
      validateTranslation(
        field.text,
        texts[index],
        locale,
        `${unit.hash}/${locale}/${field.path.join('.')}`,
      );
    const choices = unit.fields.flatMap((field, index) =>
      field.path.length === 3 && field.path[0] === 'choices' && field.path[2] === 'text'
        ? [{ text: texts[index] }]
        : [],
    );
    if (choices.length) assertDistinctChoices(choices, locale, `${unit.hash}/${locale}`);
  }
}
export const readNarrative = async (unit: NarrativeUnit) => {
  const record: NaturalNarrativeRecord = JSON.parse(
    await readFile(join(narrativeRoot, 'cache', `${unit.hash}.json`), 'utf8'),
  );
  validateNarrative(unit, record);
  return record;
};

const instructions = `You are a professional native-language educational editor translating AWS study lessons, questions and teaching slides into nine languages.
Read the full supplied context before translating its requested fields. For questions, use the prompt, ALL options, correct IDs and explanations together. For teaching materials, preserve the logical sequence, misconceptions and corrections. Write fluent natural prose appropriate to learners, not word-for-word machine translation. Preserve every condition, negation, number, quantity, code identifier, IP/CIDR, command, official AWS product name, API action, environment variable, URL and source attribution. Do not add facts or answer clues. Never turn incorrect options or misconceptions into correct statements. Before returning JSON, proofread every locale for grammar, agreement, idiomatic domain wording, and consistent terminology across its complete context. For French, messages is masculine: use tels quels with messages, not telles quelles.
Locales: en=English, zh-CN=Simplified Chinese, zh-TW=Traditional Chinese, ko=Korean, pt=Brazilian Portuguese, fr=French, de=German, es=Spanish, it=Italian.
Output each requested field's translation in exactly the input field order under each locale. Translate the visible English source labels naturally too while retaining official names. Use actual Unicode and proper native punctuation, never literal backslash-x or backslash-u text. Do not use tools, files, delegation, or external translation services. Only transform the supplied text into JSON matching the schema.`;

export async function generateNaturalNarratives() {
  await mkdir(join(narrativeRoot, 'cache'), { recursive: true });
  const schema = {
    type: 'object',
    properties: {
      locales: {
        type: 'object',
        properties: Object.fromEntries(
          narrativeLocales.map((locale) => [locale, { type: 'array', items: { type: 'string' } }]),
        ),
        required: narrativeLocales,
        additionalProperties: false,
      },
    },
    required: ['locales'],
    additionalProperties: false,
  };
  const jobs = await fundamentalsTranslationJobs();
  const unique = new Map(
    jobs.flatMap((job) => narrativeUnits(job.data)).map((unit) => [unit.hash, unit]),
  );
  let completed = 0;
  let generated = 0;
  let stopping = false;
  process.on('SIGINT', () => {
    stopping = true;
  });
  for (const unit of unique.values()) {
    if (stopping) return;
    try {
      await readNarrative(unit);
      completed++;
      continue;
    } catch {
      /* キャッシュは必ず再検証し、欠損・旧版を再生成する。 */
    }
    if (generated >= Number(process.env.NATURAL_NARRATIVE_LIMIT ?? Infinity)) break;
    let failure: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      const directory = join(narrativeRoot, 'batches', `${unit.hash}-${Date.now()}-${attempt}`);
      try {
        await mkdir(directory, { recursive: true });
        const schemaPath = join(directory, 'schema.json');
        const boundedSchema = structuredClone(schema);
        for (const shape of Object.values(boundedSchema.properties.locales.properties))
          Object.assign(shape, { minItems: unit.fields.length, maxItems: unit.fields.length });
        await writeFile(schemaPath, JSON.stringify(boundedSchema));
        const value = await runNaturalTranslationAgent(
          {
            context: unit.context,
            fields: unit.fields,
            validationFeedback: failure ? String(failure) : undefined,
          },
          directory,
          schemaPath,
          attempt,
          instructions,
        );
        const record = {
          ...value.result,
          model: value.model,
          thread: value.thread,
          usage: value.usage,
        } as NaturalNarrativeRecord;
        validateNarrative(unit, record);
        await writeFile(
          join(narrativeRoot, 'cache', `${unit.hash}.json`),
          `${JSON.stringify(record, null, 2)}\n`,
        );
        completed++;
        generated++;
        failure = undefined;
        console.log(`Natural lesson translation ${completed}/${unique.size}; nine locales`);
        break;
      } catch (error) {
        failure = error;
        await writeFile(join(directory, 'validation-error.txt'), String(error));
      }
    }
    if (failure) throw failure;
  }
}
if (import.meta.main) await generateNaturalNarratives();
