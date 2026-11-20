import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

function scan(code: string) {
  return checkSources([createSource('/fixture/src/View.tsx', code)], '/fixture');
}

test('machine tokens require both identifier semantics and valid token syntax', () => {
  const result =
    scan(`const data={id:'clf-c02',code:'AWS_S3',slug:'machine-token',label:'show-this-copy'};
    const misleading={id:'Please sign in'};
    export const View=()=><p>{data.id}{data.code}{data.slug}{data.label}{misleading.id}</p>`);
  expect(new Set(result.map((finding) => finding.text))).toEqual(
    new Set(['show-this-copy', 'Please sign in']),
  );
});

test('nested conditions narrow computed dictionary keys without exempting active copies', () => {
  const result = scan(`import {usePreferences} from './preferences';
    const entries={period:['7d','30d'],timezone:['UTC'],choices:['Raw choice']};
    export function View(){const {t}=usePreferences();
      return <>{(['period','timezone','choices'] as const).map((key)=>
        key==='timezone'?<span>{t('timezone')}</span>:key==='period'?<span>{t('period')}</span>:
        entries[key].map((value)=><p>{value}</p>))}</>}`);
  expect(result.map((finding) => finding.text)).toEqual(['Raw choice']);
});

test('catches raw errors under arbitrary catch names and String conversion', () => {
  const result = scan(`import {useState} from 'react';
    export function View(){const [message,setMessage]=useState('');
      const run=()=>{try{save()}catch(e){setMessage(e.message)}};
      return <><p>{message}</p><p>{String(error)}</p></>}`);
  expect(result.map((finding) => finding.rule)).toEqual(['raw-error-message', 'raw-error-message']);
});

test('new Error aliases cannot hide raw messages', () => {
  const result = scan(`const first=new Error('Internal diagnostic'); const second=first;
    export const View=()=><p>{second.message}</p>`);
  expect(result.map((finding) => finding.rule)).toEqual(['raw-error-message']);
});

test('optional error access and error.toString remain untranslated error sinks', () => {
  const result = scan(`export const View=()=><><p>{error?.message}</p><p>{error.toString()}</p></>`);
  expect(result.map((finding) => finding.rule)).toEqual(['raw-error-message', 'raw-error-message']);
});

test('HTML content and native input button values are visible prose', () => {
  const result = scan(`export const View=()=><><input type="submit" value="Sign in" />
    <article dangerouslySetInnerHTML={{__html:'<p>Read help</p>'}}/></>`);
  expect(result.map((finding) => finding.text)).toEqual(['Sign in', '<p>Read help</p>']);
});
