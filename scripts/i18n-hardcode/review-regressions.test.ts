import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

const cases: [string, string, Record<string, string>?][] = [
  [
    'default helper',
    `import copy from './copy'; export const View=()=> <p>{copy()}</p>`,
    { 'copy.ts': `export default function copy(){return 'Please sign in'}` },
  ],
  [
    'default constant',
    `import copy from './copy'; export const View=()=> <p>{copy}</p>`,
    { 'copy.ts': `export default 'Please sign in'` },
  ],
  [
    'named barrel',
    `import {copy} from './barrel'; export const View=()=> <p>{copy}</p>`,
    { 'barrel.ts': `export {copy} from './copy'`, 'copy.ts': `export const copy='Please sign in'` },
  ],
  [
    'namespace constant',
    `import * as copy from './copy'; export const View=()=> <p>{copy.label}</p>`,
    { 'copy.ts': `export const label='Please sign in'` },
  ],
  [
    'custom prop spread',
    `function Box({content}:{content:string}) {return <p>{content}</p>}
    const props={content:'Please sign in'}; export const View=()=> <Box {...props}/>`,
  ],
  [
    'destructure default',
    `const props={}; const {label='Please sign in'}=props;
    export const View=()=> <p>{label}</p>`,
  ],
  [
    'helper default',
    `function format(label='Please sign in'){return label}
    export const View=()=> <p>{format()}</p>`,
  ],
  [
    'member state',
    `import React from 'react'; export function View(){
    const [text,setText]=React.useState(''); const save=()=>setText('Please sign in');
    return <p onClick={save}>{text}</p>}`,
  ],
  [
    'plain interpolation',
    `import {usePreferences} from './preferences'; export function View(){
    const {t}=usePreferences();return <p>{t('hello','Please sign in')}</p>}`,
  ],
  ['textarea default', `export const View=()=> <textarea defaultValue='Please sign in'/>`],
  [
    'memoized string',
    `import {useMemo} from 'react';export function View(){
    const text=useMemo(()=>'Please sign in',[]); return <p>{text}</p>}`,
  ],
  ['String constructor', `export const View=()=> <p>{String('Please sign in')}</p>`],
  [
    'simple member assignment',
    `const data={};data.label='Please sign in';
    export const View=()=> <p>{data.label}</p>`,
  ],
];

for (const [label, code, extras = {}] of cases) {
  test(`review regression: ${label}`, () => {
    const sources = [
      createSource('/fixture/View.tsx', code),
      ...Object.entries(extras).map(([path, text]) => createSource(`/fixture/${path}`, text)),
    ];
    expect(checkSources(sources, '/fixture').map((finding) => finding.text)).toEqual(['Please sign in']);
  });
}

test('helper calls retain their own arguments rather than unrelated diagnostic arguments', () => {
  const code = `function format(label:string){return label};const debug=format('Protocol debug');
    export const View=()=> <p>{format('Visible caption')}</p>`;
  const result = checkSources([createSource('/fixture/View.tsx', code)], '/fixture');
  expect(result.map((finding) => finding.text)).toEqual(['Visible caption']);
});

test('a translated message property is permitted even when its container is called error', () => {
  const code = `import {usePreferences} from './preferences';export function View(){
    const {t}=usePreferences();const error={message:t('failure')};return <p>{error.message}</p>}`;
  expect(checkSources([createSource('/fixture/View.tsx', code)], '/fixture')).toEqual([]);
});

test('forwarded translators still check visible interpolation values', () => {
  const code = `import {usePreferences} from './preferences';
    function format(translate){return translate('failure',{detail:'Please sign in'})}
    export function View(){const {t}=usePreferences();return <p>{format(t)}</p>}`;
  expect(
    checkSources([createSource('/fixture/View.tsx', code)], '/fixture').map((finding) => finding.text),
  ).toEqual(['Please sign in']);
});

test('forwarded raw error values remain errors under neutral helper parameter names', () => {
  const code = `function format(value){return value.message}
    export const View=()=> <p>{format(error)}</p>`;
  expect(
    checkSources([createSource('/fixture/View.tsx', code)], '/fixture').map((finding) => finding.rule),
  ).toEqual(['raw-error-message']);
});
