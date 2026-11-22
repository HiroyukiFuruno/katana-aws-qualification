# #58 private session grant / committed proof binding slice（migration 17）

## 対象と固定境界

この archive は migration 16 private helper を基礎に、通常 fresh reauthentication と committed proof の grant 根拠を private schema/function に固定する候補である。新規作成、attach、merge の public API、44 public function、RLS、12 owner FK、client、旧 delete、実利用者の account 操作は変更しない。

- normal は active existing member の単一 main OAuth SID だけを検査する。第二 SSO、intent、proof を要求しない。
- normal は live user/session、OAuth AMR、current membership/account、`created_at` と `oauth_at` の双方が最大 fence を厳密に超えることを確認する。refresh/iat/header だけは許可しない。
- proof は committed receipt、consumed proof、同一 intent/UID/SID/canonical account/current epoch/fence を binding で束縛したときだけ許可する。proof 不成立時に normal へ fallback しない。
- retired/deleting、detached/disabled、old/equal fence、Auth invalid SID は account/member/state/grant を再作成・再有効化しない。

## DoR

1. migration 16 helper の `assert_live_session`、trusted request context、固定 search_path/REVOKE、Auth user→session→state→account/member の lock 契約を再利用する。
2. source registry の末尾が migration16 であること、migration17 を追加する前に private schema に proof binding table が無いことを確認する。
3. native fixture は実 GoTrue、2 OIDC、PostgREST の verified JWT context を使う。fixture wrapper は test 専用で migration に含めない。

## 実装 DoD

1. private migration17 は membership pair / proof / receipt の候補キー、grant の proof CHECK/FK、committed binding table を transaction 内に追加する。
2. single SECURITY DEFINER issuer は normal と proof を明示分岐し、grant の再送は同一値だけ収束させる。direct table DML と function EXECUTE は全 API role から REVOKE する。
3. private resolver は normal の strict fence と proof binding の current 再照合を分岐し、公開 helper16 を proof 対応へ変更しない。
4. native fixture source は実 signed JWT 経由で、single-SSO normal 成功、iat-only/old/equal-fence/Auth-invalid/retired/detached 拒否、proof binding の UID/SID/intent/consumed/epoch/fence 不一致拒否、lock retry/rollback/ACL/public hash 不変を検査できる。
5. registry17、targeted test、strict type、Biome、whole check、変更 path SHA freeze を回収する。Docker/production は root/Luna が immutable archive で実行する。

## 明示的な未完

createNew、public `enroll_learning_session` wrapper、attach/merge commit、public `require_learning_context`、RLS/FK/client/delete cutover は後続 slice である。本 slice の private native 成功を #58 完了、production callback 完了、実利用者 merge/delete 許可と報告しない。
