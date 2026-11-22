export const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
export const origin = id(1),
  account = id(2),
  receipt = id(3),
  stamp = '2026-11-22T00:00:00.000Z',
  hash = `\\x${'a'.repeat(64)}`;

export const privateV2Document = () => ({
  algorithm_version: 2,
  accounts: [origin, account],
  lineage_accounts: [origin, account],
  tables: {
    'kaq_private.learning_accounts': [
      {
        id: account,
        status: 'active',
        membership_revision: 0,
        session_fence_at: null,
        created_at: stamp,
        retired_at: null,
      },
    ],
    'kaq_private.learning_memberships': [
      {
        auth_user_id: id(4),
        account_id: account,
        epoch: 0,
        status: 'active',
        session_fence_at: null,
        created_at: stamp,
        updated_at: stamp,
      },
    ],
    'kaq_private.account_merge_receipts': [
      {
        id: receipt,
        intent_id: id(5),
        canonical_account_id: account,
        algorithm_version: 2,
        consent_hash: hash,
        before_scopes: [],
        choices: {},
        result: {},
        created_at: stamp,
      },
    ],
    'kaq_private.account_merge_archives': [
      {
        id: id(6),
        receipt_id: receipt,
        canonical_account_id: account,
        origin_account_id: origin,
        table_name: 'learning_events',
        row_key: {},
        row_key_hash: hash,
        payload: {},
        payload_hash: hash,
      },
    ],
    'kaq_private.account_merge_id_maps': [
      {
        receipt_id: receipt,
        canonical_account_id: account,
        origin_account_id: origin,
        entity_kind: 'event',
        original_id: id(7),
        canonical_id: id(8),
        original_row_hash: hash,
        canonical_row_hash: hash,
        original_payload_hash: null,
      },
    ],
    'kaq_private.account_merge_resolution_choices': [
      {
        receipt_id: receipt,
        choice_kind: 'assessment',
        choice_scope: {},
        selected_origin_account_id: origin,
        selected_row_key: {},
        created_at: stamp,
      },
    ],
    'kaq_private.account_merge_deferred_rows': [
      {
        receipt_id: receipt,
        canonical_account_id: account,
        origin_account_id: origin,
        table_name: 'migration_manifests',
        row_key: {},
        payload: {},
        payload_hash: hash,
        reason: 'unselected_manifest_variant',
      },
    ],
    'kaq_private.account_merge_resume_heads': [
      {
        receipt_id: receipt,
        canonical_account_id: account,
        unit_id: 'cloud-basics',
        content_version: 'v1',
        session_id: id(9),
        origin_account_id: origin,
      },
    ],
    'kaq_private.account_merge_replay_heads': [
      {
        receipt_id: receipt,
        canonical_account_id: account,
        source_name: 'legacy',
        source_fingerprint: 'sha256',
        manifest_id: id(10),
        origin_account_id: origin,
      },
    ],
    'kaq_private.account_merge_lineage_closure': [
      {
        ancestor_account_id: origin,
        current_canonical_account_id: account,
        established_receipt_id: receipt,
        updated_at: stamp,
      },
    ],
  },
});
