import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { artifacts, compose } from './settings';

export function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  appendFileSync(`${artifacts}/integration.log`, output);
  process.stdout.write(output);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${result.status}: ${output}`);
  return result.stdout;
}

export function databaseArgs(verbose = false) {
  return [
    ...compose,
    'exec',
    '-T',
    'database',
    'psql',
    ...(verbose ? ['--set=VERBOSITY=verbose'] : []),
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'supabase_auth_admin',
    '-d',
    'kaq_account_merge',
    '-At',
    '-f',
    '-',
  ];
}

function databaseQuery(query: string, verbose = false) {
  const result = spawnSync('docker', databaseArgs(verbose), {
    encoding: 'utf8',
    input: query,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Database inspection failed: ${result.stderr}`);
  return result.stdout.trim();
}

export function sql(query: string) {
  return databaseQuery(query);
}

export function sqlVerbose(query: string) {
  return databaseQuery(query, true);
}
