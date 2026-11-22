import { expect, test } from '@playwright/test';
import { loginMain, mainSessionSnapshot } from './browser-fixture';
import type { IntentKind } from './control-fixture';
import { closeScopeContext, proveScopeOwners } from './intent-scope-flow';
import { prepareScopePreview } from './intent-scope-http';
import { startSdkAdapter } from './server';
import { json, literal, sql } from './sql';

const previewTables = [
  'account_merge_resolution_choices',
  'account_merge_deferred_rows',
  'account_merge_resume_heads',
  'account_merge_replay_heads',
  'account_merge_lineage_closure',
] as const;
const cases: { name: string; kind: IntentKind; targetExisting: boolean; accounts: number }[] = [
  { name: 'auth-only attach', kind: 'add_existing', targetExisting: false, accounts: 1 },
  {
    name: 'source existing target auth-only',
    kind: 'merge_existing',
    targetExisting: false,
    accounts: 1,
  },
  { name: 'both existing owners', kind: 'merge_existing', targetExisting: true, accounts: 2 },
];

for (const item of cases) {
  test(`preview authority preserves ${item.name} through signed HTTP`, async ({ browser }) => {
    const adapter = await startSdkAdapter({
      intentKind: item.kind,
      targetExisting: item.targetExisting,
      additionalPrivateTables: previewTables,
      cleanupReceiptFilename: `sdk-preview-authority-${item.kind.replace('_', '-')}-${item.targetExisting ? 'two-owner' : 'auth-only'}-cleanup.json`,
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginMain(page);
      await page.goto('/test/account-sdk/browser.html');
      const before = await mainSessionSnapshot(page);
      const target = await proveScopeOwners(page, adapter);
      const { intent, sourceScope } = adapter.intent();
      sql(`create function kaq_private.fixture_preview_private_marker() returns trigger language plpgsql as $$
        begin
          if new.id=${literal(intent.id)}::uuid and new.state='previewed' then
            raise exception using errcode='23514', message='private-preview-marker',
              detail='private-preview-marker', hint='private-preview-marker';
          end if;
          return new;
        end $$;
        revoke all on function kaq_private.fixture_preview_private_marker() from public, anon, authenticated, service_role;
        create trigger fixture_preview_private_marker before update on kaq_private.account_intents
          for each row execute function kaq_private.fixture_preview_private_marker();`);
      try {
        const boundary = await prepareScopePreview(
          page,
          intent.id,
          intent.secret,
          target.revision,
          sourceScope,
        );
        expect(boundary).toEqual({
          status: 500,
          body: { code: 'PT500', details: null, hint: null, message: 'KAQ_PREVIEW_UNEXPECTED' },
        });
        expect(JSON.stringify(boundary)).not.toMatch(
          /private-preview-marker|secret|token|[0-9a-f]{64}/i,
        );
        expect(
          sql(
            `select preview_id is null and preview_digest is null and preview_document is null and preview_expires_at is null and revision=${literal(String(target.revision))}::bigint from kaq_private.account_intents where id=${literal(intent.id)}::uuid`,
          ),
        ).toBe('t');
      } finally {
        sql(`drop trigger if exists fixture_preview_private_marker on kaq_private.account_intents;
          drop function if exists kaq_private.fixture_preview_private_marker();`);
      }
      const stale = await prepareScopePreview(
        page,
        intent.id,
        intent.secret,
        target.revision - 1,
        sourceScope,
      );
      expect(stale).toMatchObject({ status: 409, body: { code: 'PT409', message: 'KAQ_INTENT_STALE' } });
      const accepted = await prepareScopePreview(
        page,
        intent.id,
        intent.secret,
        target.revision,
        sourceScope,
      );
      // fixture wrapper の応答だけを失敗証跡に残す。raw preview や request capability は含めない。
      expect(accepted, JSON.stringify(accepted)).toMatchObject({ status: 200 });
      expect(accepted.body).toMatchObject({
        existing_account_count: item.accounts,
        membership_count: expect.any(Number),
      });
      expect(JSON.stringify(accepted.body)).not.toMatch(
        /document|memberships|uid|fence|secret|nonce|token/i,
      );
      const reply = accepted.body as { preview_id: string; revision: number; digest: string };
      expect(reply.preview_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(reply.digest).toMatch(/^[0-9a-f]{64}$/);
      const stored = json<{
        id: string;
        digest: string;
        document: Record<string, unknown>;
        revision: number;
      }>(
        `select json_build_object('id',preview_id,'digest',encode(preview_digest,'hex'),'document',preview_document,'revision',revision)::text from kaq_private.account_intents where id=${literal(intent.id)}::uuid`,
      );
      expect(stored).toMatchObject({
        id: reply.preview_id,
        digest: reply.digest,
        revision: reply.revision,
      });
      expect(stored.document).toHaveProperty('snapshots.combined.document.algorithm_version', 2);
      const refreshed = await prepareScopePreview(
        page,
        intent.id,
        intent.secret,
        reply.revision,
        sourceScope,
      );
      expect(refreshed, JSON.stringify(refreshed)).toMatchObject({ status: 200 });
      expect(refreshed.body).toMatchObject({ revision: reply.revision + 1 });
      expect(refreshed.body).not.toMatchObject({ preview_id: reply.preview_id });
      expect(await mainSessionSnapshot(page)).toEqual(before);
    } finally {
      await closeScopeContext(context, adapter);
    }
  });
}
