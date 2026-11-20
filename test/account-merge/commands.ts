import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { artifacts, compose } from './settings';

export function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  appendFileSync(`${artifacts}/integration.log`, output);
  process.stdout.write(output);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${result.status}`);
  return result.stdout;
}

export function sql(query: string) {
  const result = spawnSync(
    'docker',
    [
      ...compose,
      'exec',
      '-T',
      'database',
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'supabase_auth_admin',
      '-d',
      'kaq_account_merge',
      '-At',
      '-c',
      query,
    ],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Database inspection failed: ${result.stderr}`);
  return result.stdout.trim();
}
