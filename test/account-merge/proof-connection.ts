import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { setImmediate } from 'node:timers/promises';
import { sql } from '../account-sdk/sql';
import { compose } from './settings';

type Waiter = { marker: string; complete(): void; reject(error: Error): void };

export class ProofConnection {
  private readonly lines: string[] = [];
  private readonly waiters = new Set<Waiter>();
  private readonly process = spawn('docker', [
    ...compose,
    'exec',
    '-T',
    'database',
    'psql',
    '-q',
    '-XAt',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'supabase_auth_admin',
    '-d',
    'kaq_account_merge',
  ]);
  readonly closed: Promise<number | null>;
  pid = 0;

  constructor() {
    this.closed = new Promise((resolve) => this.process.once('close', resolve));
    createInterface({ input: this.process.stdout }).on('line', (line) => {
      this.lines.push(line);
      for (const waiter of this.waiters) {
        if (line === waiter.marker || line.startsWith(`${waiter.marker}:`)) waiter.complete();
      }
    });
    this.process.stderr.on('data', () => {
      for (const waiter of this.waiters) waiter.reject(new Error('Proof lock connection failed'));
    });
  }

  async open() {
    this.send("begin; set application_name='proof_accept_lock'; select 'pid:'||pg_backend_pid();");
    await this.wait('pid');
    this.pid = Number(this.lines.find((line) => line.startsWith('pid:'))?.slice(4));
    if (!Number.isInteger(this.pid) || this.pid <= 0) throw new Error('Invalid proof lock PID');
    return this;
  }

  send(statement: string) {
    this.process.stdin.write(`${statement}\n`);
  }

  wait(marker: string): Promise<void> {
    if (this.lines.some((line) => line === marker || line.startsWith(`${marker}:`)))
      return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => waiter.reject(new Error('Proof lock marker missing')), 10_000);
      const finish = () => {
        clearTimeout(timer);
        this.waiters.delete(waiter);
      };
      const waiter: Waiter = {
        marker,
        complete: () => {
          finish();
          resolve();
        },
        reject: (error) => {
          finish();
          reject(error);
        },
      };
      this.waiters.add(waiter);
    });
  }

  async blocked(holderPid = this.pid, waiterPid?: number) {
    const deadline = performance.now() + 10_000;
    while (performance.now() < deadline) {
      const value = sql(`select coalesce(json_agg(json_build_object('waiter',pid,
        'holder',${holderPid},'waitType',wait_event_type,'waitEvent',wait_event)),'[]'::json)
        from pg_stat_activity where ${holderPid}=any(pg_blocking_pids(pid))
          ${waiterPid === undefined ? '' : `and pid=${waiterPid}`}`);
      const graph = JSON.parse(value) as { waiter: number; holder: number; waitType: string }[];
      if (graph.length && graph.every((edge) => edge.waitType === 'Lock')) return graph;
      await setImmediate();
    }
    throw new Error('Expected proof DB blocking edge was not observed');
  }

  async finish(commit = false) {
    if (this.process.exitCode !== null) throw new Error('Proof lock connection terminated');
    this.send(`${commit ? 'commit' : 'rollback'}; select 'finished';`);
    await this.wait('finished');
    this.process.stdin.end('\\q\n');
    if ((await this.closed) !== 0) throw new Error('Proof lock connection failed to close');
  }

  async abort() {
    if (this.process.exitCode !== null) return;
    this.process.stdin.end('rollback;\\q\n');
    if ((await this.closed) !== 0) throw new Error('Proof lock cleanup failed');
  }
}
