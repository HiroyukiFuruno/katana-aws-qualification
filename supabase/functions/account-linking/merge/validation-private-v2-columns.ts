const fields = (value: string) => Object.fromEntries(value.split(',').map((field) => field.split('=')));

export const privateV2Types = {
  'kaq_private.learning_accounts': fields(
    'id=uuid,status=account-status,membership_revision=natural,session_fence_at=timestamp-nullable,created_at=timestamp,retired_at=timestamp-nullable',
  ),
  'kaq_private.learning_memberships': fields(
    'auth_user_id=uuid,account_id=uuid,epoch=natural,status=membership-status,session_fence_at=timestamp-nullable,created_at=timestamp,updated_at=timestamp',
  ),
  'kaq_private.account_merge_receipts': fields(
    'id=uuid,intent_id=uuid,canonical_account_id=uuid,algorithm_version=positive,consent_hash=hash,before_scopes=json-array,choices=json-object,result=json-object,created_at=timestamp',
  ),
  'kaq_private.account_merge_archives': fields(
    'id=uuid,receipt_id=uuid,canonical_account_id=uuid,origin_account_id=uuid,table_name=archive-table,row_key=json-object,row_key_hash=hash,payload=json-object,payload_hash=hash',
  ),
  'kaq_private.account_merge_id_maps': fields(
    'receipt_id=uuid,canonical_account_id=uuid,origin_account_id=uuid,entity_kind=entity-kind,original_id=uuid,canonical_id=uuid,original_row_hash=hash,canonical_row_hash=hash,original_payload_hash=hash-nullable',
  ),
  'kaq_private.account_merge_resolution_choices': fields(
    'receipt_id=uuid,choice_kind=choice-kind,choice_scope=json-object,selected_origin_account_id=uuid,selected_row_key=json-object,created_at=timestamp',
  ),
  'kaq_private.account_merge_deferred_rows': fields(
    'receipt_id=uuid,canonical_account_id=uuid,origin_account_id=uuid,table_name=deferred-table,row_key=json-object,payload=json-object,payload_hash=hash,reason=deferred-reason',
  ),
  'kaq_private.account_merge_resume_heads': fields(
    'receipt_id=uuid,canonical_account_id=uuid,unit_id=text,content_version=text,session_id=uuid,origin_account_id=uuid',
  ),
  'kaq_private.account_merge_replay_heads': fields(
    'receipt_id=uuid,canonical_account_id=uuid,source_name=text,source_fingerprint=text,manifest_id=uuid,origin_account_id=uuid',
  ),
  'kaq_private.account_merge_lineage_closure': fields(
    'ancestor_account_id=uuid,current_canonical_account_id=uuid,established_receipt_id=uuid,updated_at=timestamp',
  ),
} as const;

export const privateV2Columns = Object.fromEntries(
  Object.entries(privateV2Types).map(([table, fields]) => [table, Object.keys(fields)]),
);
export const privateV2Tables = Object.keys(privateV2Types).sort();
