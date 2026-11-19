import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { awsSource, examSources, readAwsSource } from './aws-research-source.ts';

type Reference = { url: string; fingerprint: string; file: string };
type Snapshot = { sources: Reference[]; supplements: string[] };

async function previousSnapshot(path: string): Promise<Snapshot> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Snapshot;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { sources: [], supplements: [] };
    }
    throw error;
  }
}

async function collect(sources: URL[], guide: URL, guideText: string, directory: string) {
  const references: Reference[] = [];
  for (let start = 0; start < sources.length; start += 4) {
    const batch = await Promise.all(
      sources.slice(start, start + 4).map(async (source) => {
        const body = source.href === guide.href ? guideText : await readAwsSource(source);
        const fingerprint = createHash('sha256').update(body).digest('hex');
        const file = join(
          'content',
          `${fingerprint}.${source.hostname === 'aws.amazon.com' ? 'txt' : 'md'}`,
        );
        await writeFile(join(directory, file), body);
        return { url: source.href, fingerprint, file };
      }),
    );
    references.push(...batch);
  }
  return references;
}

const [guideArgument, ...additional] = process.argv.slice(2);
if (!guideArgument) {
  throw new Error(
    '使い方: bun run research:aws <AWS試験ガイドURL> [--replace-supplements] [追加出典URL ...]',
  );
}
const guide = awsSource(guideArgument);
const [, locale, edition] =
  guide.pathname.match(/^\/(?:(\w{2}_\w{2})\/)?aws-certification\/[^/]+\/([\w-]+)\/[\w-]+\.html$/) ?? [];
if (guide.hostname !== 'docs.aws.amazon.com' || !edition) {
  throw new Error('最初に docs.aws.amazon.com の AWS認定試験ガイドを指定してください');
}
const directory = join('test-results', 'aws-research', locale ? `${edition}-${locale}` : edition);
const latest = join(directory, 'latest.json');
const previous = await previousSnapshot(latest);
const prior = new Map(previous.sources.map(({ url, fingerprint }) => [url, fingerprint]));
const replaceSupplements = additional[0] === '--replace-supplements';
const supplements = [
  ...new Set([
    ...(replaceSupplements ? [] : previous.supplements),
    ...additional.slice(Number(replaceSupplements)).map((url) => awsSource(url).href),
  ]),
];
const guideText = await readAwsSource(guide);
const urls = [
  ...new Set([guide, ...examSources(guide, guideText)].map(({ href }) => href).concat(supplements)),
];
await Promise.all([
  mkdir(join(directory, 'content'), { recursive: true }),
  mkdir(join(directory, 'runs'), { recursive: true }),
]);
const sources = await collect(urls.map(awsSource), guide, guideText, directory);
const added = sources.filter(({ url }) => !prior.has(url)).map(({ url }) => url);
const changed = sources
  .filter(({ url, fingerprint }) => prior.has(url) && prior.get(url) !== fingerprint)
  .map(({ url }) => ({ url, before: prior.get(url) }));
const active = new Set(urls);
const removed = [...prior.keys()].filter((url) => !active.has(url));
const collectedAt = new Date().toISOString();
const diff = { added, changed, removed };
const report = JSON.stringify({ guide: guide.href, collectedAt, sources, supplements, diff }, null, 2);
const run = `${collectedAt.replace(/[:.]/g, '-')}-${randomUUID()}`;
await writeFile(join(directory, 'runs', `${run}.json`), `${report}\n`);
const pending = join(directory, `${run}.tmp`);
await writeFile(pending, `${report}\n`);
await rename(pending, latest);
console.log(JSON.stringify({ manifest: latest, sources: sources.length, diff }, null, 2));
