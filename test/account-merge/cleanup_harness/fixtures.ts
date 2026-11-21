import assert from 'node:assert/strict';
import type { RuntimeContext } from '../../../supabase/functions/account-linking/runtime/types.ts';
import { sql } from './runtime-cleanup-sql-adapter.ts';

export type Fixture = RuntimeContext & { intentExpiresAt: number };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function context(value: unknown): Fixture {
  assert(value && typeof value === 'object');
  const item = value as Record<string, unknown>;
  for (const key of ['intentId', 'legId', 'storageKey']) assert(typeof item[key] === 'string');
  assert(typeof item.purpose === 'string' && item.purpose === 'leg');
  assert(Number.isSafeInteger(item.attempt) && item.attempt === 1);
  for (const key of ['issuedAt', 'expiresAt', 'intentExpiresAt'])
    assert(Number.isSafeInteger(item[key]));
  assert(uuid.test(item.intentId as string) && uuid.test(item.legId as string));
  assert((item.storageKey as string).startsWith('kaq-proof:'));
  assert((item.expiresAt as number) > (item.issuedAt as number));
  return item as Fixture;
}

export class Fixtures {
  private readonly created = new Set<string>();

  constructor(private readonly container: string) {}

  create(seconds: 3 | 120, notBefore?: number): Fixture {
    const value = context(
      JSON.parse(sql(this.container, `select cleanup_harness.create_fixture(${seconds});`)),
    );
    assert(!this.created.has(value.intentId));
    if (notBefore !== undefined) assert(value.issuedAt > notBefore);
    this.created.add(value.intentId);
    return value;
  }

  intentIds(): string[] {
    return [...this.created];
  }
}
