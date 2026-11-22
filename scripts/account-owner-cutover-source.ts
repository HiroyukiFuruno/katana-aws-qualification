import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type FunctionSurface = { signature: string; roles: string[]; source: string };
export type SourceAudit = {
  functions: FunctionSurface[];
  ownerTables: string[];
  rlsPolicies: string[];
  definitionCount: number;
};

function splitTopLevel(value: string) {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let quote = '';
  for (const character of value) {
    if (quote) {
      if (character === quote) quote = '';
    } else if (character === "'" || character === '"') quote = character;
    else if ('([{'.includes(character)) depth++;
    else if (')]}'.includes(character)) depth--;
    if (character === ',' && !quote && depth === 0) {
      parts.push(current);
      current = '';
    } else current += character;
  }
  return [...parts, current].map((part) => part.trim()).filter(Boolean);
}

function signature(name: string, parameters: string) {
  const types = splitTopLevel(parameters).map((parameter) =>
    parameter
      .replace(/\s+default\s+[\s\S]*/i, '')
      .trim()
      .split(/\s+/)
      .slice(1)
      .join(''),
  );
  return `${name}(${types.join(',')})`;
}

function definitions(source: string, file: string) {
  const result: FunctionSurface[] = [];
  const pattern = /create(?:\s+or\s+replace)?\s+function\s+public\.([a-z_][a-z0-9_]*)\s*\(/gi;
  for (const match of source.matchAll(pattern)) {
    let depth = 1;
    let end = match.index + match[0].length;
    while (depth && end < source.length) {
      const character = source[end++];
      if (character === '(') depth++;
      if (character === ')') depth--;
    }
    result.push({
      signature: signature(match[1], source.slice(match.index + match[0].length, end - 1)),
      roles: ['public'],
      source: file,
    });
  }
  return result;
}

function rejectUnsupportedPublicFunctions(source: string, file: string) {
  const pattern = /create(?:\s+or\s+replace)?\s+function\s+([\s\S]*?)\(/gi;
  for (const match of source.matchAll(pattern)) {
    const target = match[1].trim();
    if (/^(?:"public"|public)\s*\./i.test(target) && !/^public\.[a-z_][a-z0-9_]*$/i.test(target))
      throw new Error(`unsupported public function declaration ${file}:${target}`);
  }
}

function applyAcl(source: string, functions: Map<string, FunctionSurface>) {
  const pattern =
    /\b(grant|revoke)\s+(?:all(?:\s+privileges)?|execute)\s+on\s+function\s+([\s\S]*?)\s+(?:to|from)\s+([^;]+);/gi;
  for (const match of source.matchAll(pattern))
    for (const item of splitTopLevel(match[2])) {
      const target = functions.get(
        item
          .replace(/^public\./i, '')
          .replace(/\s+/g, '')
          .toLowerCase(),
      );
      if (!target) continue;
      const roles = match[3].split(',').map((role) => role.trim().replace(/^"|"$/g, '').toLowerCase());
      target.roles =
        match[1].toLowerCase() === 'grant'
          ? [...new Set([...target.roles, ...roles])]
          : target.roles.filter((role) => !roles.includes(role));
    }
}

export async function readSourceAudit(root: string): Promise<SourceAudit> {
  const directory = join(root, 'supabase/migrations');
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
  const functions = new Map<string, FunctionSurface>();
  const ownerTables = new Set<string>();
  const rlsPolicies = new Set<string>();
  let definitionCount = 0;
  for (const file of files) {
    const source = await readFile(join(directory, file), 'utf8');
    rejectUnsupportedPublicFunctions(source, file);
    const entries = definitions(source, file);
    definitionCount += entries.length;
    for (const entry of entries) {
      const previous = functions.get(entry.signature);
      functions.set(entry.signature, { ...entry, roles: previous?.roles ?? entry.roles });
    }
    applyAcl(source, functions);
    for (const match of source.matchAll(/create table public\.([a-z_][a-z0-9_]*)[\s\S]*?;/gi))
      if (/\buser_id\b/i.test(match[0])) ownerTables.add(match[1]);
    for (const match of source.matchAll(
      /create policy ([a-z_][a-z0-9_]*) on public\.([a-z_][a-z0-9_]*)/gi,
    ))
      rlsPolicies.add(`${match[2]}:${match[1]}`);
  }
  return {
    functions: [...functions.values()].sort((left, right) =>
      left.signature.localeCompare(right.signature),
    ),
    ownerTables: [...ownerTables].sort(),
    rlsPolicies: [...rlsPolicies].sort(),
    definitionCount,
  };
}
