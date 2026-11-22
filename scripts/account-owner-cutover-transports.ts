import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { TransportCallee } from './account-owner-cutover-registry.ts';

export type TransportCallsite = {
  name: string;
  callee: TransportCallee;
  evidence: string;
};

const callees: TransportCallee[] = ['rpc', 'request', 'write'];

function lineAt(source: string, offset: number) {
  return source.slice(0, offset).split('\n').length;
}

function callsites(source: string, path: string) {
  const result: TransportCallsite[] = [];
  for (const callee of callees) {
    const pattern = new RegExp(`\\b${callee}(?:<[^()]*?>)?\\s*\\(\\s*['"]([a-z_][a-z0-9_]*)`, 'g');
    for (const match of source.matchAll(pattern)) {
      const argument = match.index + match[0].lastIndexOf(match[1]);
      result.push({ name: match[1], callee, evidence: `${path}:${lineAt(source, argument)}` });
    }
  }
  return result;
}

export async function readTransportCallsites(root: string): Promise<TransportCallsite[]> {
  const result: TransportCallsite[] = [];
  const walk = async (path: string): Promise<void> => {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const next = join(path, entry.name);
      if (entry.isDirectory()) await walk(next);
      else if (/\.tsx?$/.test(entry.name)) {
        const source = await readFile(next, 'utf8');
        const sourcePath = relative(root, next).replaceAll('\\', '/');
        result.push(...callsites(source, sourcePath));
      }
    }
  };
  await walk(join(root, 'src'));
  return result;
}
