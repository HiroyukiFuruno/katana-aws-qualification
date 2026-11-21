import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

function scan(code: string) {
  return checkSources([createSource('/fixture/src/account/ui/View.tsx', code)], '/fixture');
}

test('resolves complete computed names and preserves unknown or padded names', () => {
  const result = scan(`
    const prefix = 'aria-';
    const concatenated = prefix + 'label';
    const templated = \`aria-\${'valuetext'}\`;
    const conditional = true ? 'aria-label' : 'aria-valuetext';
    const unknownSuffix = getSuffix();
    const unknownProperty = getProperty();
    element.setAttribute(concatenated, 'Close dialog');
    element.setAttribute(templated, 'Half complete');
    element.setAttribute(conditional, 'Description');
    element.setAttribute('aria-label' + 'ledby', 'heading-id');
    element.setAttribute(\`aria-\${'label'}ledby\`, 'heading-id');
    element.setAttribute('aria-' + unknownSuffix, 'Unknown sink');
    element[unknownProperty] = 'Unknown DOM property';
    element['aria' + 'ValueText'] = 'Complete';
    element['aria-' + unknownSuffix] = 'Unknown computed property';
    element.setAttribute(' aria-label ', 'Padded attribute');
    element['ariaLabel '] = 'Padded DOM property';
  `);

  expect(result.map((finding) => finding.text)).toEqual([
    'Close dialog',
    'Half complete',
    'Description',
    'Complete',
  ]);
});

test('does not infer names from unresolved string transforms', () => {
  const result = scan(`
    element.setAttribute(('aria-label').replace('label', 'labelledby'), 'heading-id');
    element.setAttribute(['aria', 'label'].join('-'), 'Joined heading');
    element.setAttribute(['aria-', 'label'].concat('ledby').join(''), 'Concatenated heading');
    element.setAttribute(('ARIA-LABEL').toLowerCase(), 'Lowercase heading');
  `);
  expect(result).toEqual([]);
});

test('keeps known helper returns and imported concatenated names traceable', () => {
  const sources = [
    createSource('/fixture/src/labels.ts', "export const prefix='aria-';"),
    createSource(
      '/fixture/src/account/ui/View.tsx',
      `
      import {prefix} from '../../labels';
      const helper=()=> 'aria-' + 'description';
      const imported=prefix + 'valuetext';
      element.setAttribute(helper(), 'Dialog description');
      element.setAttribute(imported, 'Half complete');
    `,
    ),
  ];
  expect(checkSources(sources, '/fixture').map((finding) => finding.text)).toEqual([
    'Dialog description',
    'Half complete',
  ]);
});
