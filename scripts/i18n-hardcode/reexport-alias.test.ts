import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

for (const kind of ['default', 'named'] as const)
  for (const reversed of [false, true]) {
    for (const namespace of [false, true])
      for (const form of ['named', 'namespace'] as const) {
        for (const mode of ['visible', 'debug', 'translated'] as const) {
          test(`separate reexports ${kind}/${reversed}/${namespace}/${form}/${mode}`, () => {
            const symbol = kind === 'default' ? 'default' : 'value';
            const exports = [
              `export {${symbol} as caption} from './copy';`,
              `export {${symbol} as count} from './count';`,
            ];
            if (namespace)
              exports.push(
                `export * as bundle from './namespace';export * as default from './namespace';`,
              );
            if (reversed) exports.reverse();
            const copy = mode === 'translated' ? 'save' : 'Please sign in';
            const files: Record<string, string> = {
              'copy.ts':
                kind === 'default' ? `export default '${copy}';` : `export const value='${copy}';`,
              'count.ts': kind === 'default' ? `export default 42;` : `export const value=42;`,
              'namespace.ts': `export const value=42;`,
              'metadata.ts': `export const value=42;`,
              'barrel.ts': `import {value} from './metadata';export {value as metadata};${exports.join('')}`,
            };
            const imported =
              form === 'named'
                ? `import {caption,count} from './barrel';`
                : `import * as copy from './barrel';`;
            const caption = form === 'named' ? 'caption' : 'copy.caption';
            const count = form === 'named' ? 'count' : 'copy.count';
            const content =
              mode === 'visible'
                ? `<p>{${caption}}{${count}}</p>`
                : mode === 'translated'
                  ? `<p>{t(${caption})}{${count}}</p>`
                  : '<p>{42}</p>';
            const debug = mode === 'debug' ? `const debug=${caption};` : '';
            const extraImport = namespace
              ? `import bundle from './barrel';const namespaceValue=bundle.value;`
              : '';
            files['View.tsx'] = `import {usePreferences} from './preferences';${imported}${extraImport}
          export function View(){const {t}=usePreferences();${debug}return ${content}}`;
            const sources = Object.entries(files).map(([path, text]) =>
              createSource(`/fixture/${path}`, text),
            );
            const findings = checkSources(sources, '/fixture').map((finding) => finding.text);
            expect(findings).toEqual(mode === 'visible' ? ['Please sign in'] : []);
          });
        }
      }
  }
