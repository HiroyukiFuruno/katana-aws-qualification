import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { FundamentalsContent } from '../../src/fundamentals/types';
import { archivedLessonEditions } from '../../src/fundamentals/delivery/editions';
import { buildDelivery } from './build';
import type { CheckpointDocument } from './source';

const root = process.cwd();
const checkpointPath = join(root, 'public/fundamentals/checkpoints.json');
const deliveryPath = join(root, 'public/fundamentals/delivery');
const sourceManifestPath = join(root, 'src/fundamentals/delivery/routeManifest.json');

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function artifacts() {
  const [content, checkpoints] = await Promise.all([
    readFile(join(root, 'public/fundamentals/content.json'), 'utf8'),
    readFile(checkpointPath, 'utf8'),
  ]);
  const bundle = buildDelivery(
    JSON.parse(content) as FundamentalsContent,
    JSON.parse(checkpoints) as CheckpointDocument,
  );
  const editions = await Promise.all(
    archivedLessonEditions.map(
      async (edition) =>
        JSON.parse(
          await readFile(join(deliveryPath, 'history', edition, 'routeManifest.json'), 'utf8'),
        ) as unknown,
    ),
  );
  return new Map<string, string>([
    [
      checkpointPath,
      json({
        schemaVersion: 1,
        units: bundle.units.map((unit) => ({ checkpoints: unit.checkpoints, unitId: unit.unit.id })),
      }),
    ],
    [join(deliveryPath, 'index.json'), json(bundle.index)],
    [join(deliveryPath, 'routeManifest.json'), json(bundle.routeManifest)],
    [sourceManifestPath, json(bundle.routeManifest)],
    [
      join(root, 'src/fundamentals/delivery/archivedRouteManifest.json'),
      json({ schemaVersion: 1, editions }),
    ],
    [join(deliveryPath, 'trustedCatalog.json'), json(bundle.trustedCatalog)],
    ...bundle.units.map(
      (unit) =>
        [join(deliveryPath, `${unit.unit.id.replace(/^fundamentals\./, '')}.json`), json(unit)] as const,
    ),
  ]);
}

export async function generateDelivery(mode: '--check' | '--write') {
  const expected = await artifacts();
  for (const [path, value] of expected) {
    if (mode === '--write') {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, value);
    } else if ((await readFile(path, 'utf8').catch(() => '')) !== value) {
      throw new Error(`Generated delivery artifact is stale: ${path}`);
    }
  }
}

const mode = process.argv[2];
if (mode === '--check' || mode === '--write') await generateDelivery(mode);
else throw new Error('Usage: bun scripts/fundamentals-delivery/generate.ts --check|--write');
