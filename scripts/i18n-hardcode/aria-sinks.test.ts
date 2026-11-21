import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

function scan(code: string) {
  return checkSources([createSource('/fixture/src/account/ui/View.tsx', code)], '/fixture');
}

test('checks textual ARIA attributes through JSX, spreads and setAttribute', () => {
  const result = scan(`
    const props = {
      'aria-placeholder': 'Enter a label',
      'aria-roledescription': 'Chart',
      'aria-valuetext': 'Half complete',
    };
    export const View = () => <div {...props}
      aria-placeholder="Enter a name"
      aria-roledescription="Graph"
      aria-valuetext="Fully complete" />;
    element.setAttribute('aria-placeholder', 'Enter a value');
    element.setAttribute('aria-roledescription', 'Diagram');
    element.setAttribute('aria-valuetext', 'Complete');
  `);

  expect(result.map((finding) => finding.text)).toEqual([
    'Enter a label',
    'Chart',
    'Half complete',
    'Enter a name',
    'Graph',
    'Fully complete',
    'Enter a value',
    'Diagram',
    'Complete',
  ]);
});

test('checks textual DOM accessibility properties and preserves translated aliases', () => {
  const result = scan(`
    import {usePreferences} from '../../preferences';
    export function View(){
      const {t:translate}=usePreferences();
      element.alt = 'Company logo';
      element.ariaLabel = 'Close dialog';
      element.ariaDescription = 'Dialog description';
      element.ariaPlaceholder = 'Enter a label';
      element.ariaRoleDescription = 'Chart';
      element.ariaValueText = 'Half complete';
      element.title = translate('accountTitle');
      return <img alt={translate('logoAlt')} />;
    }
  `);

  expect(result.map((finding) => finding.text)).toEqual([
    'Company logo',
    'Close dialog',
    'Dialog description',
    'Enter a label',
    'Chart',
    'Half complete',
  ]);
});

test('retains raw error findings in ARIA sinks', () => {
  const result = scan(`
    function save(){
      try { submit(); } catch (cause) {
        element.setAttribute('aria-valuetext', cause.message);
      }
    }
  `);
  expect(result).toEqual([
    expect.objectContaining({
      rule: 'raw-error-message',
      text: 'Untranslated error.message',
      sink: 'setAttribute aria-valuetext',
    }),
  ]);
});

test('accepts translated textual ARIA values and keeps nontextual attributes as data', () => {
  expect(
    scan(`
    import {usePreferences} from '../../preferences';
    export function View(){
      const {t:translate}=usePreferences();
      const props={'aria-roledescription':translate('accountTitle')};
      element.ariaValueText=translate('accountTitle');
      element.ariaLive='polite'; element.ariaHidden='true'; element.role='button';
      element.src='https://assets.example/logo.svg';
      return <div {...props} role="region" aria-live="polite" aria-hidden="true"
        aria-controls="learning-panel" aria-valuenow={50}
        aria-placeholder={translate('accountTitle')}
        aria-valuetext={translate('accountTitle')}/>;
    }
  `),
  ).toEqual([]);
});

test('traces imported copy into the new accessibility sinks', () => {
  const sources = [
    createSource('/fixture/src/labels.ts', "export const label='Learning progress';"),
    createSource(
      '/fixture/src/account/ui/View.tsx',
      `
      import {label} from '../../labels';
      export const View=()=> <div aria-valuetext={label}/>;
    `,
    ),
  ];
  expect(checkSources(sources, '/fixture').map((finding) => finding.text)).toEqual([
    'Learning progress',
  ]);
});

test('traces constant and imported sink names without treating enum values as copy', () => {
  const sources = [
    createSource(
      '/fixture/src/labels.ts',
      "export const attr='aria-valuetext'; export const key='ariaLabel';",
    ),
    createSource(
      '/fixture/src/account/ui/View.tsx',
      `
      import {attr, key} from '../../labels';
      const localAttr='aria-placeholder';
      const localKey='ariaDescription';
      export function View(){
        element.setAttribute(localAttr, 'Enter a label');
        element.setAttribute(attr, 'Learning progress');
        element[key] = 'Close dialog';
        element[localKey] = 'Dialog description';
        element['aria-hidden'] = 'true';
        element.ariaHidden = 'true';
        element.setAttribute('aria-hidden', 'true');
        const src='ariaLabel';
        element.src='logo.svg';
        const ariaLabel='src';
        element[ariaLabel]='logo.svg';
      }
    `,
    ),
  ];
  expect(checkSources(sources, '/fixture').map((finding) => finding.text)).toEqual([
    'Enter a label',
    'Learning progress',
    'Close dialog',
    'Dialog description',
  ]);
});
