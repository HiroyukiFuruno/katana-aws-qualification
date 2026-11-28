import type { Locale } from '../locales.ts';
import slideCopy from './slide-copy.json' with { type: 'json' };
import type { AppliedCaseContent } from './types.ts';

const reflectionSections: Readonly<Record<string, string>> = {
  'private-app-s3': 'verify',
  'checkout-deployment-recovery': 'changed-condition',
};

export function appliedSlideCopy(locale: Locale) {
  return slideCopy[locale];
}

export function appliedReflection(lessonId: string, section: AppliedCaseContent['sections'][number]) {
  if (Object.hasOwn(reflectionSections, lessonId) && reflectionSections[lessonId] === section.id) {
    const [scenario, explanation] = section.blocks;
    if (
      section.blocks.length !== 2 ||
      scenario?.kind !== 'paragraph' ||
      explanation?.kind !== 'paragraph'
    )
      throw new Error(`Invalid applied reflection: ${lessonId}/${section.id}`);
    return { scenario: scenario.text, explanation: explanation.text };
  }
  return undefined;
}
