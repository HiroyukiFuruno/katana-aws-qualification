const technicalTokens =
  /\b(?:Lustre|ECS|ETL|Kinesis Data Streams)\b|https?:\/\/[^\s。、「」\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]+|arn:[\w:*./-]+|\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?|::\/\d{1,3}|\/(?:ping|invocations)\b|\b[A-Za-z][\w-]*:[A-Za-z][\w*]*|\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b|\b[a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*)+\b|\b(?=[A-Za-z0-9]*[a-z][A-Z])[A-Za-z][A-Za-z0-9]*\b|\b[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+\b/gu;

export function translationIdentifiers(source: string): string[] {
  const tokens: string[] = source.match(technicalTokens) ?? [];
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(source) || /\bDynamoDB\b/u.test(source))
    tokens.push(...(source.match(/\b(?:Query|Scan)\b/gu) ?? []));
  return [...new Set(tokens)];
}
