import { isAuthRetryableFetchError } from '@supabase/auth-js';
import type { ProgressRpcClient } from './types';

const readableTables: Record<string, string> = {
  learning_events: 'received_at,event_id',
  exam_sessions: 'started_at,exam_id',
  exam_responses: 'exam_id,question_key',
  earned_certifications: 'certification_id',
  assessment_answers: 'assessment_id',
  migration_manifests: 'created_at,manifest_id',
  migration_items: 'manifest_id,source_row_id',
  roadmap_profiles: 'user_id',
  learning_state: 'user_id',
};
const identityFields: Record<string, string[]> = {
  learning_events: ['event_id'],
  exam_sessions: ['exam_id'],
  exam_responses: ['exam_id', 'question_key'],
  earned_certifications: ['certification_id'],
  assessment_answers: ['assessment_id'],
  migration_manifests: ['manifest_id'],
  migration_items: ['manifest_id', 'source_row_id'],
  roadmap_profiles: ['user_id'],
  learning_state: ['user_id'],
};

export class ProgressApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
  ) {
    super('Learning data request failed');
  }
}

export function isTransientProgressReadError(error: unknown) {
  if (error instanceof TypeError) return true;
  if (error instanceof ProgressApiError) return error.status >= 500 && error.status <= 599;
  return (
    isAuthRetryableFetchError(error) &&
    (error.status === 0 || (error.status !== undefined && error.status >= 500 && error.status <= 599))
  );
}

export function createProgressApi(
  configuration: { url: string; key: string },
  authorize: () => Promise<string>,
  isCurrent: () => boolean,
): ProgressRpcClient {
  async function request(path: string, init: RequestInit) {
    if (!isCurrent()) throw new Error('Learning account changed');
    const token = await authorize();
    if (!isCurrent()) throw new Error('Learning account changed');
    const headers = new Headers(init.headers);
    headers.set('apikey', configuration.key);
    headers.set('Authorization', `Bearer ${token}`);
    const result = await fetch(new URL(`/rest/v1/${path}`, configuration.url), { ...init, headers });
    if (!isCurrent()) throw new Error('Learning account changed');
    const body: unknown = result.status === 204 ? null : await result.json();
    if (!isCurrent()) throw new Error('Learning account changed');
    if (!result.ok) {
      const code =
        body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
          ? body.code
          : null;
      throw new ProgressApiError(result.status, code);
    }
    return { body, range: result.headers.get('Content-Range') };
  }

  return {
    async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
      if (!/^[a-z_]+(?:_v[1-9][0-9]*)?$/.test(name)) throw new Error('Invalid learning operation');
      const result = await request(`rpc/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
      return result.body as T;
    },
    async select<T>(table: string, filters: Record<string, string> = {}): Promise<T> {
      if (!Object.hasOwn(readableTables, table)) throw new Error('Invalid learning table');
      const query = new URLSearchParams({ select: '*', order: readableTables[table] });
      for (const [column, value] of Object.entries(filters)) {
        if (
          ![
            'exam_id',
            'certification_id',
            'event_id',
            'manifest_id',
            'question_id',
            'question_revision',
            'state',
            'mode',
          ].includes(column)
        )
          throw new Error('Invalid learning filter');
        query.set(column, value);
      }
      const rows: unknown[] = [];
      const identities = new Set<string>();
      let expectedTotal: number | undefined;
      for (let offset = 0; ; ) {
        const result = await request(`${table}?${query}`, {
          headers: { Range: `${offset}-${offset + 999}`, 'Range-Unit': 'items', Prefer: 'count=exact' },
        });
        const page = result.body;
        if (!Array.isArray(page)) throw new Error('Invalid learning response');
        const total = result.range?.match(/\/(\d+)$/)?.[1];
        if (total === undefined) throw new Error('Learning page count missing');
        const pageTotal = Number(total);
        if (expectedTotal === undefined) expectedTotal = pageTotal;
        else if (expectedTotal !== pageTotal) throw new Error('Learning collection changed during read');
        const fields = identityFields[table];
        for (const row of page) {
          if (!row || typeof row !== 'object') continue;
          const values = fields.map((field) => (row as Record<string, unknown>)[field]);
          if (values.every((value) => typeof value === 'string')) {
            const identity = values.join('\u001f');
            if (identities.has(identity)) throw new Error('Duplicate learning row received');
            identities.add(identity);
          }
        }
        rows.push(...page);
        offset += page.length;
        if (offset >= pageTotal) return rows as T;
        if (!page.length) throw new Error('Learning page incomplete');
      }
    },
  };
}
