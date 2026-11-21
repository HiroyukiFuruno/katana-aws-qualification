import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

function scan(files: Record<string, string>) {
  return checkSources(
    Object.entries(files).map(([path, text]) => createSource(`/fixture/${path}`, text)),
    '/fixture',
  ).map((finding) => finding.text);
}

test('keeps nested imported alias arguments distinct in a named map callback', () => {
  expect(
    scan({
      'View.tsx': `import {identity as imported} from './identity';const identity=imported;
        const render=(item:{caption:string})=>identity(identity(item.caption));const items=[{caption:'Please sign in'}];export const View=()=> <p>{items.map(render)}</p>;`,
      'identity.ts': `export const identity=(value:string)=>value;`,
    }),
  ).toEqual(['Please sign in']);
});

test('stops actual recursion without suppressing a later argument context', () => {
  expect(
    scan({
      'View.tsx': `const loop=(value:string)=>loop(value);const identity=(value:string)=>value;export const View=()=> <><p>{loop('Diagnostic copy')}</p><p>{identity(identity('Visible copy'))}</p></>;`,
    }),
  ).toEqual(['Visible copy']);
});

test('stops path-growing self and mutual recursion', () => {
  expect(
    scan({
      'View.tsx': `const loop=(value)=>loop(value).caption;const left=(value)=>right(value).caption;const right=(value)=>left(value).caption;export const View=()=> <><p>{loop({caption:'Visible copy'})}</p><p>{left({caption:'Also visible'})}</p></>;`,
    }),
  ).toEqual([]);
});

test('keeps a nonrecursive helper distinct for requested member paths', () => {
  expect(
    scan({
      'View.tsx': `const identity=<Value,>(value:Value)=>value;const copy={caption:'Caption copy',label:'Label copy'};export const View=()=> <p>{identity(copy).caption}{identity(copy).label}</p>;`,
    }),
  ).toEqual(['Caption copy', 'Label copy']);
});

test('traces contextual textarea and button input direct, spread, and prop values', () => {
  const items = `const items=[{kind:'button',text:'Textarea copy',fallback:'Textarea default',spread:'Spread textarea copy',spreadFallback:'Spread textarea default',button:'Button copy',buttonFallback:'Button default',hidden:'Diagnostic copy'}];`;
  expect(
    scan({
      'View.tsx': `${items}const localKind='submit';const Button=({kind,value,fallback}:{kind:string;value:string;fallback:string})=><input type={kind} value={value} defaultValue={fallback}/>;const render=(item:typeof items[number])=> <><textarea value={item.text} defaultValue={item.fallback}/><textarea {...{value:item.spread,defaultValue:item.spreadFallback}}/><input type={item.kind} value={item.button} defaultValue={item.buttonFallback}/><input type={localKind} value={item.button}/><Button kind={item.kind} value={item.button} fallback={item.buttonFallback}/><input type="text" value={item.hidden}/><input type="hidden" value={item.hidden}/></>;export const View=()=> <>{items.map(render)}</>;`,
    }),
  ).toEqual([
    'Textarea copy',
    'Textarea default',
    'Spread textarea copy',
    'Spread textarea default',
    'Button copy',
    'Button default',
  ]);
});

test('keeps translated and diagnostic contextual values out of textarea and input findings', () => {
  expect(
    scan({
      'View.tsx': `import {usePreferences} from './preferences';const {t}=usePreferences();const render=(item:{kind:string;copy:string})=><><textarea {...{value:t(item.copy),defaultValue:t(item.copy)}}/><input type={item.kind} {...{value:t(item.copy),defaultValue:t(item.copy)}}/></>;const diagnostic=[{kind:'button',copy:'Diagnostic copy'}].map(render);export const View=()=> <><input type="text" value="Diagnostic copy"/><input type="hidden" value="Diagnostic copy"/>{[{kind:'submit',copy:'Visible copy'}].map(render)}</>;`,
    }),
  ).toEqual([]);
});

test('traces direct and spread HTML through named map and custom component contexts', () => {
  expect(
    scan({
      'View.tsx': `const items=[{direct:'Direct HTML copy',spread:{dangerouslySetInnerHTML:{__html:'Spread HTML copy'}},component:'Component HTML copy'}];const Html=({content}:{content:{__html:string}})=><div dangerouslySetInnerHTML={content}/>;const render=(item:typeof items[number])=><><div dangerouslySetInnerHTML={{__html:item.direct}}/><div {...item.spread}/><Html content={{__html:item.component}}/></>;export const View=()=> <>{items.map(render)}</>;`,
    }),
  ).toEqual(['Direct HTML copy', 'Spread HTML copy', 'Component HTML copy']);
});

test('keeps translated and diagnostic spread HTML out of findings', () => {
  expect(
    scan({
      'View.tsx': `import {usePreferences} from './preferences';const {t}=usePreferences();const render=(item:{copy:string})=><div {...{dangerouslySetInnerHTML:{__html:t(item.copy)}}}/>;const diagnostic=[{copy:'Diagnostic HTML copy'}].map(render);export const View=()=> <>{[{copy:'Visible HTML copy'}].map(render)}</>;`,
    }),
  ).toEqual([]);
});
