-- #58の内部部品。公開wrapperが検証済みJWT contextを束縛し、commitは保存済み両proofも再検査する。
-- migration/公開RPCへは未接続。callerは全Auth user/session→state→account/membership順を守る。
-- 下位lockを既に持つcallerが、未取得user/sessionをこの関数で後取りしてはいけない。
-- 対象: GoTrue v2.198.0 (387e91f37e00b64b9060352988066bbb685f6e45)。
-- oauth_client_idは同版20250904133000_add_oauth_client_id_to_session.up.sqlの正式列を使う。
-- https://github.com/supabase/auth/blob/387e91f37e00b64b9060352988066bbb685f6e45/migrations/20250904133000_add_oauth_client_id_to_session.up.sql
create function kaq_private.assert_live_session(
  user_uuid uuid, session_uuid uuid, sensitive boolean default false
) returns auth.sessions
language plpgsql security definer
set search_path = pg_catalog, auth, kaq_private
as $$
declare
  live_user auth.users%rowtype;
  live_session auth.sessions%rowtype;
  has_verified_factor boolean := false;
  checked_at timestamptz;
begin
  if user_uuid is null or session_uuid is null or sensitive is null
    or user_uuid = '00000000-0000-0000-0000-000000000000'::uuid
    or session_uuid = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception using errcode = '28000', message = 'KAQ_SESSION_INVALID';
  end if;

  -- KEY SHAREではban/not_after更新を止められないため、検査終了までSHAREを保持する。
  select * into live_user from auth.users where id = user_uuid for share;
  if not found then
    raise exception using errcode = '28000', message = 'KAQ_SESSION_INVALID';
  end if;
  select * into live_session from auth.sessions where id = session_uuid for share;
  if not found or live_session.user_id is distinct from user_uuid then
    raise exception using errcode = '28000', message = 'KAQ_SESSION_INVALID';
  end if;
  if sensitive then
    perform 1 from auth.mfa_factors where user_id = user_uuid and status = 'verified'
      order by id for share;
    has_verified_factor := found;
  end if;

  -- transaction開始時刻やlock待ち前の時刻で、待機中に切れた期限を許可しない。
  checked_at := clock_timestamp();
  if live_user.deleted_at is not null
    or live_user.banned_until > checked_at
    or live_session.created_at is null
    or not isfinite(live_session.created_at)
    or live_session.created_at <= 'epoch'::timestamptz
    or live_session.created_at > checked_at + interval '5 seconds'
    or (live_session.not_after is not null and (
      not isfinite(live_session.not_after) or live_session.not_after <= checked_at
    ))
    or live_session.oauth_client_id is not null then
    raise exception using errcode = '28000', message = 'KAQ_SESSION_INVALID';
  end if;

  -- hosted低AAL期限の実効durationを推測せず、機微操作だけ到達可能なAAL2を要求する。
  if sensitive and has_verified_factor
    and coalesce(live_session.aal, 'aal1'::auth.aal_level) < 'aal2'::auth.aal_level then
    raise exception using errcode = '28000', message = 'KAQ_STEP_UP_REQUIRED';
  end if;
  return live_session;
end $$;
revoke all on function kaq_private.assert_live_session(uuid, uuid, boolean)
  from public, anon, authenticated, service_role;

-- 2026-11-20T21:53:19.339Zの設定snapshotではtimebox/inactivity=0、single-per-user=false。
-- この部品はそれらの有効化、hosted設定変更、legacy refresh時刻、single-session集合を扱わない。
-- 機微APIの公式policy refresh/結果不明時の再証明/設定変更互換性はcallerの未実装契約。
-- user/session/factor行lockは設定変更やfactor/sessionの並行insertを防ぐものではない。
comment on function kaq_private.assert_live_session(uuid, uuid, boolean) is
  '内部owner専用。Auth UID/session所有・削除・ban・固定期限・第三者OAuth・機微操作のAALを検査。hosted設定guardと全session policyの実装ではなく、公開APIには未接続。';
