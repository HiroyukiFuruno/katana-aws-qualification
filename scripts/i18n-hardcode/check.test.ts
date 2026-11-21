import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

function findings(code: string, extra: Record<string, string> = {}) {
  return checkSources(
    [
      createSource('/fixture/src/nested/View.tsx', code),
      ...Object.entries(extra).map(([path, text]) => createSource(`/fixture/src/${path}`, text)),
    ],
    '/fixture',
  );
}

test('detects English and non-Latin JSX prose, literal expressions and accessibility copy', () => {
  const result = findings(`export const View = () => <>
    <p>Hello world</p><span>日本語</span><span>{'English'}</span>
    <input placeholder="Enter email" aria-label="Email address" title={'Help text'} />
    <img alt="Account logo" /><div aria-description="Extra description" />
  </>`);
  expect(result.map((finding) => finding.text)).toEqual([
    'Hello world',
    '日本語',
    'English',
    'Enter email',
    'Email address',
    'Help text',
    'Account logo',
    'Extra description',
  ]);
  expect(result[0]).toMatchObject({ file: 'src/nested/View.tsx', line: 2, rule: 'hardcoded-ui-text' });
});

test('technical literals, protocols, CSS, enum comparisons, numbers and punctuation are not prose sinks', () => {
  expect(
    findings(`const state = 'pending'; const url = 'https://example.com';
    const protocol = 'oauth'; const label = 'Invisible configuration';
    export const View = () => <div className="layout-stack" id="account" data-state="loading"
      role="status" lang="en" aria-live="polite" style={{color: 'red'}}>
      {state === 'pending' && <a href={url}>{42} / {7} {'·'}</a>}
      <input type="email" name="address" value="someone@example.com" />
      <code>{url}</code>
    </div>`),
  ).toEqual([]);
});

test('resolves aliases, conditional branches, concatenation and interpolated constants', () => {
  const result = findings(
    `const suffix = "items"; const first = "Saved"; const second = first;
      export const View = () => <p>{ready ? second : "Failed"}{"Total: " + \`\${count} \${suffix}\`}</p>`,
  );
  expect(new Set(result.map((finding) => finding.text))).toEqual(
    new Set(['items', 'Saved', 'Failed', 'Total:']),
  );
});

test('follows nested arrays, computed member selection, map bindings and destructuring', () => {
  const result = findings(`const entries = [{id:'internal-id', info:{label:'Account settings'}}];
    const labels = {first: 'First choice', second: 'Second choice'} as const;
    export const View = () => <>{entries.map(({info}) => <p>{info.label}</p>)}
      <p>{labels[selected]}</p></>`);
  expect(new Set(result.map((finding) => finding.text))).toEqual(
    new Set(['Account settings', 'First choice', 'Second choice']),
  );
});

test('follows custom component props, imported constants, helper parameters and return values', () => {
  const result = findings(
    `import {data, message} from '../copy';
    function Box({content}: {content:string}) {return <p>{content}</p>}
    const format = (value:string) => value;
    export const View = () => <><Box content={data.caption} /><p>{format(message())}</p></>`,
    {
      'copy.ts': `export const data = {caption:'Imported caption', id:'protocol-token'};
      export function message() {return 'Helper returned copy'}`,
    },
  );
  expect(new Set(result.map((finding) => finding.text))).toEqual(
    new Set(['Imported caption', 'Helper returned copy']),
  );
});

test('tracks setter values and reassigned UI variables without flagging technical states', () => {
  const result = findings(`import {useState} from 'react';
    export function View() {const [error,setError] = useState('');
      const [state,setState] = useState('pending');
      let label='First caption'; label='Changed caption';
      const save=() => {setError('Cannot save changes');setState('failed')};
      return <p onClick={save} data-state={state}>{error}{label}</p>}`);
  expect(new Set(result.map((finding) => finding.text))).toEqual(
    new Set(['First caption', 'Changed caption', 'Cannot save changes']),
  );
});

test('honors lexical scopes instead of conflating identical variable names', () => {
  const result = findings(`const label='Not displayed';
    function View() {const label='Visible caption'; return <p>{label}</p>}`);
  expect(result.map((finding) => finding.text)).toEqual(['Visible caption']);
});

test('translate=no and disable comments cannot hide literal UI text', () => {
  const result = findings(`// i18n-disable
    export const View=()=><div translate="no">Brand name</div>`);
  expect(result.map((finding) => finding.text)).toEqual(['Brand name']);
});
