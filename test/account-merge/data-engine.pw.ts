import { expect, test } from '@playwright/test';
import { sql } from './commands';
import { verifyDataEngine } from './data-engine';
import { verifyDataEngineLineage } from './data-engine-lineage';
import { createNonLegacyGuestVariants } from './data-engine-native-nonlegacy-payload';
import { createGuestVariants } from './data-engine-native-payload';
import { cleanupRealOwners, literal, login, unrelatedOwnerRows } from './data-engine-native-support';
import { quoted } from './owner-shadow-support';
import { publicState } from './public-state';

test('real OIDC, GoTrue, PostgREST, and Postgres preserve the complete data-engine fixture', async ({
  browser,
}) => {
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const ownerIds: string[] = [];
  let receipt: string | null = null;
  let intent: string | null = null;
  let unrelatedBefore: string | null = null;
  let schemaBefore: string | null = null;
  try {
    expect(verifyDataEngine()).toMatchObject({ status: 'source-ready' });
    const first = await login(await firstContext.newPage(), 'First issuer', 'sdk-first');
    const second = await login(await secondContext.newPage(), 'Second issuer', 'sdk-second');
    expect(first.userId).not.toBe(second.userId);
    ownerIds.push(first.userId, second.userId);
    unrelatedBefore = unrelatedOwnerRows(ownerIds);
    schemaBefore = publicState().schemaDigest;

    const variants = await createGuestVariants(first, second);
    const nonLegacy = await createNonLegacyGuestVariants(first, second, variants.manifests);
    verifyDataEngineLineage(first);
    const [source, canonical] = ownerIds;
    if (!source || !canonical) throw new Error('Missing real OAuth owners');
    receipt = sql('select gen_random_uuid()');
    intent = sql('select gen_random_uuid()');
    const choices = JSON.stringify({
      version: 1,
      assessment: {},
      dashboard: { '*': 'canonical' },
      roadmap: { '*': 'canonical' },
      final_resume: {},
      manifest_head: {
        [`history-local-storage:${variants.fingerprint}`]: `canonical:${variants.manifests[1]}`,
      },
    });
    sql(`
      insert into kaq_private.learning_accounts(id) values (${quoted(source)}),(${quoted(canonical)});
      insert into kaq_private.learning_memberships(auth_user_id,account_id) values
        (${quoted(source)},${quoted(source)}),(${quoted(canonical)},${quoted(canonical)});
      insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,source_account_id,source_membership_epoch,state,expires_at)
      select ${quoted(intent)},'merge_existing',${quoted(source)},id,decode(repeat('ab',32),'hex'),${quoted(source)},0,'committed',clock_timestamp()+interval '5 minutes'
      from auth.sessions where user_id=${quoted(source)} limit 1;
    `);
    const digest = sql(
      `select kaq_private.capture_merge_snapshot_v2(array[${quoted(source)},${quoted(canonical)}],null)->>'digest'`,
    );
    sql(`
      insert into kaq_private.account_merge_receipts(id,intent_id,canonical_account_id,algorithm_version,consent_hash,before_scopes,choices,result)
      values(${quoted(receipt)},${quoted(intent)},${quoted(canonical)},2,decode(repeat('ab',32),'hex'),'[]',${literal(choices)}::jsonb,'{}');
      select kaq_private.apply_merge_data_engine(${quoted(receipt)},${quoted(source)},${quoted(canonical)},${literal(digest)},
        (select generation from public.learning_state where user_id=${quoted(canonical)}),${literal(choices)}::jsonb);
    `);
    expect(variants.manifests).toHaveLength(2);
    expect(
      sql(`select count(*) from kaq_private.account_merge_archives where receipt_id=${quoted(receipt)}`),
    ).not.toBe('0');
    expect(
      sql(`select count(*) from kaq_private.account_merge_id_maps where receipt_id=${quoted(receipt)}`),
    ).not.toBe('0');
    expect(
      sql(
        `select count(*) from public.learning_events where user_id=${quoted(canonical)} and event_id=${quoted(variants.eventId)}`,
      ),
    ).toBe('1');
    expect(
      JSON.parse(
        sql(`select jsonb_build_object(
          'submitted_exams', (select count(*) from public.exam_sessions where user_id=${quoted(canonical)} and exam_id=${quoted(nonLegacy.submittedExamId)}),
          'draft_exams', (select count(*) from public.exam_sessions where user_id=${quoted(canonical)} and exam_id=${quoted(nonLegacy.draftExamId)}),
          'submitted_events', (select count(*) from public.learning_events where user_id=${quoted(canonical)} and event_id=${quoted(nonLegacy.submittedEventId)}),
          'draft_responses', (select count(*) from public.exam_responses where user_id=${quoted(canonical)} and exam_id=${quoted(nonLegacy.draftExamId)} and question_key::jsonb=${literal(nonLegacy.draftQuestionKey)}::jsonb),
          'raw_archive_rows', (select count(*) from kaq_private.account_merge_archives where receipt_id=${quoted(receipt)}
            and ((table_name='exam_sessions' and payload->>'exam_id' in (${literal(nonLegacy.submittedExamId)},${literal(nonLegacy.draftExamId)}))
              or (table_name='learning_events' and payload->>'event_id'=${literal(nonLegacy.submittedEventId)})
              or (table_name='exam_responses' and payload->>'exam_id'=${literal(nonLegacy.draftExamId)}))),
          'raw_archive_origins', (select count(distinct origin_account_id) from kaq_private.account_merge_archives where receipt_id=${quoted(receipt)}
            and table_name='exam_sessions' and payload->>'exam_id'=${literal(nonLegacy.submittedExamId)}),
          'exam_maps', (select count(*) from kaq_private.account_merge_id_maps where receipt_id=${quoted(receipt)} and origin_account_id=${quoted(source)}
            and entity_kind='exam' and original_id in (${quoted(nonLegacy.submittedExamId)},${quoted(nonLegacy.draftExamId)}) and canonical_id=original_id),
          'event_maps', (select count(*) from kaq_private.account_merge_id_maps where receipt_id=${quoted(receipt)} and origin_account_id=${quoted(source)}
            and entity_kind='event' and original_id=${quoted(nonLegacy.submittedEventId)} and canonical_id=original_id),
          'replay_head', (select count(*) from kaq_private.account_merge_replay_heads where receipt_id=${quoted(receipt)}
            and source_name='history-local-storage' and source_fingerprint=${literal(variants.fingerprint)}
            and manifest_id=${quoted(variants.manifests[1] ?? '')} and origin_account_id=${quoted(canonical)})
        )::text`),
      ),
    ).toEqual({
      submitted_exams: 1,
      draft_exams: 1,
      submitted_events: 1,
      draft_responses: 1,
      raw_archive_rows: 8,
      raw_archive_origins: 2,
      exam_maps: 2,
      event_maps: 1,
      replay_head: 1,
    });
    expect(sql(`select count(*) from public.learning_state where user_id=${quoted(source)}`)).toBe('0');
  } finally {
    await firstContext.close();
    await secondContext.close();
    if (ownerIds.length > 0) await cleanupRealOwners(ownerIds, receipt, intent);
    if (unrelatedBefore !== null) expect(unrelatedOwnerRows(ownerIds)).toBe(unrelatedBefore);
    if (schemaBefore !== null) expect(publicState().schemaDigest).toBe(schemaBefore);
  }
});
