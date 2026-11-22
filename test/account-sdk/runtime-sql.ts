import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { RuntimeMutationQueue } from '../../supabase/functions/account-linking/runtime/serial.ts';
import { compose } from '../account-merge/settings';
import { type Actor, actorStatement } from './sql';

type Pending = {
  marker: string;
  rows: string[];
  failed: boolean;
  resolve(value: string): void;
  reject(error: Error): void;
};

class RuntimeSqlSession {
  private readonly queue = new RuntimeMutationQueue();
  private readonly process = spawn('docker', [
    ...compose,
    'exec',
    '-T',
    'database',
    'sh',
    '-ec',
    'exec psql -q -XAt -v ON_ERROR_STOP=0 -U supabase_auth_admin -d kaq_account_merge 2>&1',
  ]);
  private pending: Pending | null = null;
  private dead = false;
  private readonly closed: Promise<number | null>;
  private readonly ready: Promise<string>;

  constructor() {
    this.closed = new Promise((resolve) => this.process.once('close', resolve));
    createInterface({ input: this.process.stdout }).on('line', (line) => this.receive(line));
    createInterface({ input: this.process.stderr }).on('line', () => {
      if (this.pending) this.pending.failed = true;
    });
    this.process.once('error', () => this.fail());
    this.process.stdin.on('error', () => this.fail());
    this.process.once('close', () => this.fail());
    this.ready = this.request('\\set VERBOSITY sqlstate\nset client_min_messages=error;');
  }

  private fail() {
    this.dead = true;
    this.pending?.reject(new Error('Runtime SQL connection unavailable'));
    this.pending = null;
  }

  private receive(line: string) {
    const pending = this.pending;
    if (!pending) return;
    if (/^(?:ERROR|FATAL|PANIC):/.test(line)) {
      pending.failed = true;
      return;
    }
    if (line !== pending.marker) {
      pending.rows.push(line);
      return;
    }
    this.pending = null;
    if (pending.failed) pending.reject(new Error('Runtime SQL query rejected'));
    else pending.resolve(pending.rows.join('\n').trim());
  }

  private request(statement: string): Promise<string> {
    if (this.dead || this.pending) return Promise.reject(new Error('Runtime SQL channel unavailable'));
    return new Promise((resolve, reject) => {
      const marker = `runtime_sql_${randomUUID()}`;
      this.pending = { marker, rows: [], failed: false, resolve, reject };
      this.process.stdin.write(`${statement}\nselect '${marker}';\n`);
    });
  }

  query(actor: Actor, statement: string): Promise<string> {
    return this.queue.run(async () => {
      await this.ready;
      return this.request(actorStatement(actor, statement));
    });
  }

  close(): Promise<void> {
    return this.queue.run(async () => {
      let startupFailed = false;
      try {
        await this.ready;
      } catch {
        startupFailed = true;
      }
      if (!this.dead) this.process.stdin.end('\\q\n');
      if ((await this.closed) !== 0 || startupFailed)
        throw new Error('Runtime SQL connection cleanup failed');
    });
  }
}

let current: RuntimeSqlSession | null = null;

export function runtimeSql(actor: Actor, statement: string): Promise<string> {
  current ??= new RuntimeSqlSession();
  return current.query(actor, statement);
}

export async function closeRuntimeSql() {
  const session = current;
  current = null;
  await session?.close();
}
