import { spawnSync } from 'node:child_process';
import type {
  RuntimeRecord,
  RuntimeRepository,
  RuntimeWriteGuard,
} from '../../../supabase/functions/account-linking/runtime/types.ts';

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function bytes(hex: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error('invalid database record');
  const parts = hex.match(/.{2}/g);
  if (!parts) throw new Error('invalid database record');
  return Uint8Array.from(parts.map((part) => Number.parseInt(part, 16)));
}

function record(value: unknown): RuntimeRecord {
  if (!value || typeof value !== 'object') throw new Error('invalid database record');
  const item = value as Record<string, unknown>;
  if (
    typeof item.revision !== 'number' ||
    !Number.isSafeInteger(item.revision) ||
    typeof item.keyVersion !== 'string' ||
    typeof item.nonce !== 'string' ||
    typeof item.ciphertext !== 'string' ||
    typeof item.expiresAt !== 'number' ||
    !Number.isSafeInteger(item.expiresAt)
  )
    throw new Error('invalid database record');
  return {
    revision: item.revision,
    keyVersion: item.keyVersion,
    nonce: bytes(item.nonce),
    ciphertext: bytes(item.ciphertext),
    expiresAt: item.expiresAt,
  };
}

export function sql(container: string, statement: string): string {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'sh',
      '-ec',
      'exec psql -h 127.0.0.1 -U supabase_auth_admin -d kaq_account_merge -XAt -v ON_ERROR_STOP=1',
    ],
    {
      encoding: 'utf8',
      input: statement,
    },
  );
  if (result.status !== 0) throw new Error('database command failed');
  return result.stdout.trim();
}

function json(value: string): RuntimeRecord | null {
  if (!value || value === 'null') return null;
  return record(JSON.parse(value) as unknown);
}

function next(record: RuntimeRecord): string {
  return JSON.stringify({
    revision: record.revision,
    keyVersion: record.keyVersion,
    nonce: Buffer.from(record.nonce).toString('hex'),
    ciphertext: Buffer.from(record.ciphertext).toString('hex'),
    expiresAt: record.expiresAt,
  });
}

export class CleanupSqlRepository implements RuntimeRepository {
  private readonly guardJson: string;

  constructor(
    private readonly container: string,
    guard: RuntimeWriteGuard,
  ) {
    this.guardJson = literal(JSON.stringify(guard));
  }

  async read(legId: string): Promise<RuntimeRecord | null> {
    return json(
      sql(
        this.container,
        `select coalesce(kaq_private.runtime_read(${literal(legId)}::uuid,${this.guardJson})::text,'null');`,
      ),
    );
  }

  async readRevisionForCleanup(legId: string, guard: RuntimeWriteGuard): Promise<number | null> {
    const value = sql(
      this.container,
      `select coalesce(kaq_private.runtime_cleanup_revision(${literal(legId)}::uuid,${literal(JSON.stringify(guard))})::text,'');`,
    );
    return value ? Number.parseInt(value, 10) : null;
  }

  async compareAndSwap(
    legId: string,
    revision: number | null,
    value: RuntimeRecord,
    guard: RuntimeWriteGuard,
  ): Promise<boolean> {
    const expected = revision === null ? 'null' : String(revision);
    return (
      sql(
        this.container,
        `select kaq_private.runtime_compare_and_swap(${literal(legId)}::uuid,${expected},${literal(next(value))},${literal(JSON.stringify(guard))});`,
      ) === 't'
    );
  }

  async deleteIfRevision(
    legId: string,
    revision: number | null,
    guard: RuntimeWriteGuard,
  ): Promise<'deleted' | 'missing' | 'conflict'> {
    const expected = revision === null ? 'null' : String(revision);
    const value = sql(
      this.container,
      `select kaq_private.runtime_delete_if_revision(${literal(legId)}::uuid,${expected},${literal(JSON.stringify(guard))});`,
    );
    if (value === 'deleted' || value === 'missing' || value === 'conflict') return value;
    throw new Error('invalid database response');
  }

  async isTerminal(legId: string): Promise<boolean> {
    return (
      sql(
        this.container,
        `select kaq_private.runtime_is_terminal(${literal(legId)}::uuid,${this.guardJson});`,
      ) === 't'
    );
  }
}
