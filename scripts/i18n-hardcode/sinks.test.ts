import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

const hook = `import {usePreferences} from '../../preferences';`;
function scan(code: string) {
  return checkSources([createSource('/fixture/src/account/ui/View.tsx', code)], '/fixture');
}

test('accepts actual preferences translation calls and aliases', () => {
  expect(
    scan(`${hook}
    export function View(){const {t:translate}=usePreferences(); const alias=translate;
      return <input title={translate('accountTitle')} aria-label={alias('accountEmail')}/>}`),
  ).toEqual([]);
});

test('a function merely named t cannot become an arbitrary translation exemption', () => {
  expect(
    scan(`function t(key:string) {return 'Fake translated text'}
    export const View=()=><p>{t('ignored')}</p>`).map((finding) => finding.text),
  ).toEqual(['Fake translated text']);
});

test('translation interpolation cannot hide hardcoded copy', () => {
  const result = scan(`${hook}
    export function View(){const {t}=usePreferences();
      const detail='Please try again';
      return <p>{t('failure',{detail, reason:'Login failed', count:3})}</p>}`);
  expect(new Set(result.map((finding) => finding.text))).toEqual(
    new Set(['Please try again', 'Login failed']),
  );
});

test('translated interpolation, locale formatted numbers and technical format options are accepted', () => {
  expect(
    scan(`${hook}
    export function View(){const {t,locale}=usePreferences();
      return <p>{t('count',{count:42,detail:t('details')})}
      {new Intl.DateTimeFormat(locale,{timeZone:'UTC',month:'long'}).format(new Date())}</p>}`),
  ).toEqual([]);
});

test('checks attributes delivered through object spread', () => {
  const result = scan(`const props={placeholder:'Your address',className:'input-control'};
    export const View=()=><input {...props}/>`);
  expect(result.map((finding) => finding.text)).toEqual(['Your address']);
});

test('checks validation messages, native dialogs and imperative DOM text', () => {
  const result = scan(`const error='Email is invalid';
    input.setCustomValidity(error); alert('Saved changes'); confirm('Delete account?');
    prompt('Your name'); element.textContent='Please sign in';
    element.setAttribute('aria-label','Close dialog'); element.title='Help';
    element.setAttribute('class','panel');`);
  expect(new Set(result.map((finding) => finding.text))).toEqual(
    new Set([
      'Email is invalid',
      'Saved changes',
      'Delete account?',
      'Your name',
      'Please sign in',
      'Close dialog',
      'Help',
    ]),
  );
});

test('detects raw error messages reaching rendered children and state setters', () => {
  const result = scan(`import {useState} from 'react';
    function View(){const [message,setMessage]=useState('');
      const save=()=>{try{submit()}catch(cause){setMessage(cause.message)}};
      return <><p>{error.message}</p><p>{message}</p></>}`);
  expect(result.map((finding) => finding.rule)).toEqual(['raw-error-message', 'raw-error-message']);
});

test('raw errors retained for diagnostics do not become visible-text violations', () => {
  expect(
    scan(`function save(){try {submit()}catch(error){console.error(error.message)}}
    const technical={message:'Unexpected protocol response'};
    export const View=()=><p>{123}</p>`),
  ).toEqual([]);
});

test('reported columns use Unicode characters after byte based AST spans', () => {
  const result = scan('const data="日本語"; export const View=()=><p title="Help">中文</p>');
  expect(result.map(({ line, column, text }) => ({ line, column, text }))).toEqual([
    { line: 1, column: 50, text: 'Help' },
    { line: 1, column: 57, text: '中文' },
  ]);
});
