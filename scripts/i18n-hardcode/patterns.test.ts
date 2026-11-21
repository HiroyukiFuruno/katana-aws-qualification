import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

const exported = [
  [`export const {caption}={caption:'Pattern copy'}`, 'caption'],
  [`export const {value:caption}={value:'Pattern copy'}`, 'caption'],
  [`export const {caption='Pattern copy'}={}`, 'caption'],
  [`export const {value:caption='Pattern copy'}={}`, 'caption'],
  [`export const {data:{caption}}={data:{caption:'Pattern copy'}}`, 'caption'],
  [`export const [,caption]=[0,'Pattern copy']`, 'caption'],
  [`export const [,caption='Pattern copy']=[]`, 'caption'],
  [`export const [skip,...captions]=['Ignored copy','Pattern copy']`, 'captions[0]'],
  [`export const {skip,...captions}={skip:'Ignored copy',caption:'Pattern copy'}`, 'captions.caption'],
  [`export const {skip,...captions}={skip:'Ignored copy',caption:'Pattern copy'}`, 'captions[selected]'],
] as const;

for (const [definition, expression] of exported) {
  test(`export binding pattern ${definition}`, () => {
    const imported = expression.startsWith('captions') ? 'captions' : 'caption';
    const sources = [
      createSource('/fixture/copy.ts', definition),
      createSource(
        '/fixture/View.tsx',
        `import {${imported}} from './copy';
        export const View=()=> <p>{${expression}}</p>`,
      ),
    ];
    expect(checkSources(sources, '/fixture').map((finding) => finding.text)).toEqual(['Pattern copy']);
  });
}

test('export patterns register only binding identifiers, including aliases and rest', () => {
  const source = createSource(
    '/fixture/copy.ts',
    `export const {source:caption,...rest}: {source:string;extra:number}={source:'copy',extra:1};
    export const [,second,...others]=[0,1,2]`,
  );
  expect([...source.exports.keys()].sort()).toEqual(['caption', 'others', 'rest', 'second']);
});

const callbacks = [
  [`[{caption:'Pattern copy'}]`, `function(item){return <p>{item.caption}</p>}`],
  [`[{caption:'Pattern copy'}]`, `function({caption}){return <p>{caption}</p>}`],
  [`[{value:'Pattern copy'}]`, `function({value:caption}){return <p>{caption}</p>}`],
  [`[{}]`, `function({caption='Pattern copy'}){return <p>{caption}</p>}`],
  [
    `[{skip:'Ignored copy',caption:'Pattern copy'}]`,
    `function({skip,...item}){return <p>{item.caption}</p>}`,
  ],
  [`[[0,'Pattern copy']]`, `function([,caption]){return <p>{caption}</p>}`],
  [`[['Ignored copy','Pattern copy']]`, `function([skip,...items]){return <p>{items[0]}</p>}`],
  [
    `[['Ignored copy','Pattern copy']]`,
    `function([skip,...items]){return <>{items.map(function(caption){return <p>{caption}</p>})}</>}`,
  ],
] as const;

for (const [data, callback] of callbacks)
  test(`ordinary callback binding ${callback}`, () => {
    const source = createSource(
      '/fixture/View.tsx',
      `const items=${data};export const View=()=> <>{items.map(${callback})}</>`,
    );
    expect(checkSources([source], '/fixture').map((finding) => finding.text)).toEqual(['Pattern copy']);
  });

test('local array binding holes preserve their source positions', () => {
  const source = createSource(
    '/fixture/View.tsx',
    `const [,caption]=['Ignored copy','Pattern copy'];
    export const View=()=> <p>{caption}</p>`,
  );
  expect(checkSources([source], '/fixture').map((finding) => finding.text)).toEqual(['Pattern copy']);
});
