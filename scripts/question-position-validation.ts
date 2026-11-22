import assert from 'node:assert/strict';

const references = [
  // 中国語の「每次問題」「此次問題」「這次問題」「目前問題」と、観測済みの「先前問過的問題」は隣接設問の参照ではない。
  /(?<![每此這])次問|(?<!目)前問(?!過的問題)|選択肢\s*[A-EＡ-Ｅ]|[A-EＡ-Ｅ](?:と[A-EＡ-Ｅ])?が正解/u,
  /\b(?:[Oo]ption|[Cc]hoice|[Aa]nswer)\s+[A-E]\b|\bthe (?:next|previous) question\b/u,
  /(?:选项|選項|선택지|[Aa]lternativa|[Oo]pción|[Oo]pzione|[Aa]ntwort)\s*[A-E]\b/u,
];

export function assertPositionIndependentText(text: string, context: string) {
  assert(
    !references.some((pattern) => pattern.test(text)),
    `${context}: displayed question text depends on shuffled positions`,
  );
}

export function assertPositionIndependentQuestion(value: unknown, context: string) {
  if (typeof value === 'string') assertPositionIndependentText(value, context);
  else if (Array.isArray(value))
    for (const [index, item] of value.entries())
      assertPositionIndependentQuestion(item, `${context}[${index}]`);
  else if (value && typeof value === 'object')
    for (const [key, item] of Object.entries(value))
      assertPositionIndependentQuestion(item, `${context}.${key}`);
}
