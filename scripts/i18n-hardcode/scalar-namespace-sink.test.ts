import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

test('resolves namespace helper attributes without inferring string transforms', () => {
  const sources = [
    createSource('/fixture/src/names.ts', "export const attribute=()=> 'aria-label';"),
    createSource(
      '/fixture/src/View.tsx',
      `import * as names from './names';
       element.setAttribute(names.attribute(), 'Close dialog');
       element.setAttribute(('aria-label').replace('label','ledby'), 'Heading id');`,
    ),
  ];
  expect(checkSources(sources, '/fixture').map((finding) => finding.text)).toEqual(['Close dialog']);
});
