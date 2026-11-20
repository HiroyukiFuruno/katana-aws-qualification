import { timestamp } from './codecPrimitives';

export function lessonInstant(value: string) {
  const valid = timestamp(value, 'lessonInstant');
  const fraction = valid.match(/\.(\d{1,6})(?:Z|[+-]\d\d:\d\d)$/)?.[1] ?? '';
  const withoutFraction = valid.replace(/\.\d{1,6}(?=Z|[+-]\d\d:\d\d$)/, '');
  return BigInt(Date.parse(withoutFraction)) * 1000n + BigInt(fraction.padEnd(6, '0'));
}

export function sameLessonInstant(left: string, right: string) {
  return lessonInstant(left) === lessonInstant(right);
}
