const text = { type: 'string' };
const object = (properties: Record<string, unknown>, nullable = false) => ({
  type: nullable ? ['object', 'null'] : 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const array = (items: unknown, nullable = false) => ({
  type: nullable ? ['array', 'null'] : 'array',
  items,
});
const check = object({ prompt: text, answer: text }, true);
const question = object({
  id: text,
  title: text,
  prompt: text,
  choices: array(object({ id: text, text, explanation: text })),
  learning: object({ reason: text, concept: text, check }, true),
  prompts: array(object({ id: text, text }), true),
  references: array(object({ url: text, label: text }), true),
  categoryLabel: text,
  examDomainLabel: text,
  versionLabel: text,
  sourceLabel: text,
});

export const translationLocales = [
  'ja',
  'en',
  'zh-CN',
  'zh-TW',
  'ko',
  'pt',
  'fr',
  'de',
  'es',
  'it',
] as const;
export const targetLocalesFor = (sourceLocale: string) =>
  translationLocales.filter((locale) => locale !== sourceLocale);
export const schemaFor = (
  sourceLocale: string,
  count?: number,
  includeTranslations = true,
  hasReferences = true,
) =>
  object({
    reviews: {
      ...array(
        object({
          id: text,
          status: { type: 'string', enum: ['pass', 'needs-review'] },
          rationale: text,
          issues: array(text),
        }),
      ),
      ...(count === undefined ? {} : { minItems: count, maxItems: count }),
    },
    locales: object(
      Object.fromEntries(
        (includeTranslations ? targetLocalesFor(sourceLocale) : []).map((locale) => [
          locale,
          {
            ...array(
              hasReferences
                ? question
                : { ...question, properties: { ...question.properties, references: { type: 'null' } } },
            ),
            ...(count === undefined ? {} : { minItems: count, maxItems: count }),
          },
        ]),
      ),
    ),
  });
export const targetLocales = targetLocalesFor('ja');
export const naturalTranslationSchema = schemaFor('ja');

export const naturalTranslationInstructions = `You are a professional multilingual technical editor translating original AWS certification study materials.
Translate each complete source question naturally into ALL requested target languages. The input specifies sourceLocale, targetLocales, and questions. Read its prompt, EVERY option, correct-answer IDs, explanations and learning notes together before translating. This context is essential: avoid literal fragments, unsupported first-person narration, unnatural word order, or terminology that changes the technical meaning.
Before translating, review EACH question's technical premises, answer uniqueness, number of selections, correct-answer IDs, distractors, explanations and learning notes. Return one reviews entry per question in source order, with a specific Japanese rationale explaining why its answer follows from its conditions. Never use a generic checked/passed template. If ambiguous, technically questionable, outdated, contradictory, or requiring a source check, set status=needs-review and describe actionable issues in Japanese. Do not silently fix the source or change grading while translating; unresolved issues will block publication for the main agent to investigate.
Assess an architecture option at the level the question asks: it need not list every API or console step when it already specifies the required behavior. A stated recovery goal is a design target, not automatically a claim of an AWS SLA guarantee. Flag actual feasibility or guarantee errors, not merely omitted implementation details. Check that displayed prose does not rely on original answer letters or positions that would become misleading after shuffling.
Locales: ja=Japanese, en=English, zh-CN=Simplified Chinese, zh-TW=Traditional Chinese, ko=Korean, pt=Brazilian Portuguese, fr=French, de=German, es=Spanish, it=Italian.
Use fluent native educational prose, consistent AWS terminology, concise but complete explanations, and natural punctuation. Preserve all conditions, negation, numeric limits, quantities, units and the distinction between correct answers and distractors. Do not make distractors true or add clues. Preserve official AWS product names, API actions, code identifiers, ARNs, URLs and environment variables EXACTLY. Do not translate canonical IDs.
Before returning JSON, proofread every complete locale for grammar, agreement, idiomatic domain terms, and consistent operation names across the prompt, options, explanations and learning notes. Use the full domain context for titles instead of literal calques: in a WAF question, natural equivalents of WAF rules are clearer than generic defense rules. For French, messages is masculine, so use tels quels with messages, not telles quelles. Describe what rules do rather than awkwardly saying that rules become detections.
If validationFeedback is supplied, the previous attempt failed a strict check. Correct the reported omission or structure in the complete output while preserving the source meaning; never remove or alter source facts to evade validation.
Output each locale's questions in the source order. Copy id and choice/prompts IDs exactly; never reorder them. Translate categoryLabel, examDomainLabel, versionLabel and sourceLabel from their source fields. Translate references labels while copying their URLs exactly. Retain official product names in names of sources. If learning, prompts or references are absent use null. If learning.check is absent use null. Do not invent fields or omit source explanations.
Return only JSON matching the schema. Use actual Unicode text, never literal backslash-x or backslash-u escape strings. Do not use tools, read files, edit files, delegate, or contact translation services: this is a self-contained text transformation of the supplied JSON.`;
