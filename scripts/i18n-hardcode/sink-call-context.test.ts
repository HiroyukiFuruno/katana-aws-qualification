import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

function scan(code: string) {
  return checkSources([createSource('/fixture/View.tsx', code)], '/fixture').map(
    (finding) => finding.text,
  );
}

test('traces caller values through native and DOM helper sinks', () => {
  expect(
    scan(`
      function notify(message:string){alert(message)}
      function invalid(message:string){input.setCustomValidity(message)}
      function copy(message:string){element.textContent=message}
      notify('Please sign in');invalid('Enter a valid email');copy('Saved changes');
    `),
  ).toEqual(['Please sign in', 'Enter a valid email', 'Saved changes']);
});

test('binds member, template, destructured, default and rest sink expressions', () => {
  expect(
    new Set(
      scan(`
        function member(message:{caption:string}){alert(message.caption)}
        function template(message:string){alert(\`\${message}\`)}
        function destructured({caption}:{caption:string}){alert(caption)}
        function fallback(message='Default copy'){alert(message)}
        function rest(...messages:string[]){alert(messages[0])}
        member({caption:'Member copy'});template('Template copy');destructured({caption:'Destructured copy'});fallback();rest('Rest copy');
      `),
    ),
  ).toEqual(new Set(['Member copy', 'Template copy', 'Destructured copy', 'Default copy', 'Rest copy']));
});

test('keeps aliases and deferred callback literals while ignoring non-UI helpers', () => {
  expect(
    new Set(
      scan(`
        function notify(message:string){const text=message;alert(text)}
        function direct(message:string){alert(message)}
        function internal(message:string){console.log(message)}
        const callback=direct;
        notify('Alias copy');callback?.('Optional callback copy');
        export const View=()=> <button onClick={()=>direct('Event handler copy')}/>;
        internal('Internal diagnostic');
      `),
    ),
  ).toEqual(new Set(['Alias copy', 'Optional callback copy', 'Event handler copy']));
});

test('keeps nested caller context bounded and lexical', () => {
  expect(
    new Set(
      scan(`
      function notify(message:string){alert(message)}
      function nested(message:string){notify(message)}
      function loop(message:string){alert(message);loop(message)}
      function shadow(notify:(message:string)=>void){notify('Internal diagnostic')}
      function unused(message:string){alert(message)}
      function literal(){alert('Direct displayed message')}
      nested('Nested help');loop('Recursive help');notify('Visible help');literal();
    `),
    ),
  ).toEqual(new Set(['Nested help', 'Recursive help', 'Visible help', 'Direct displayed message']));
});
