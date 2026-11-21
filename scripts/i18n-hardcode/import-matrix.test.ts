import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { forms, importFixture, paths, values } from './import-matrix-fixture.ts';
import { createSource } from './sources.ts';

for (const form of forms)
  for (const path of paths)
    for (const value of values) {
      for (const visible of [true, false]) {
        test(`import matrix ${form}/${path}/${value}/${visible ? 'visible' : 'diagnostic only'}`, () => {
          const fixture = importFixture(form, path, value, visible);
          const sources = [
            createSource('/fixture/View.tsx', fixture.code),
            ...Object.entries(fixture.extras).map(([path, text]) =>
              createSource(`/fixture/${path}`, text),
            ),
          ];
          expect(checkSources(sources, '/fixture').map((finding) => finding.text)).toEqual(
            visible ? ['Matrix copy'] : [],
          );
        });
      }
    }
