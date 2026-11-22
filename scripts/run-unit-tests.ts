import { readdir } from 'node:fs/promises';

const roots = ['scripts', 'test'];
const paths = (
  await Promise.all(
    roots.map(async (root) =>
      (
        await readdir(root, { recursive: true })
      )
        .filter((path) => path.endsWith('.test.ts'))
        .map((path) => `./${root}/${path}`),
    ),
  )
)
  .flat()
  .sort();
if (!paths.length) throw new Error('No unit tests found');
const child = Bun.spawn([process.execPath, 'test', ...paths], {
  stdout: 'inherit',
  stderr: 'inherit',
});
process.exitCode = await child.exited;
