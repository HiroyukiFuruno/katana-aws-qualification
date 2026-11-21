# #58 proof用SDK storageの暗号化部品

一次要件は[proof契約](20261121_account_merge_proof.md)。通常ログインのstorageを共有せず、legごとのサーバー内storageを使うための部品を実装する。

## 完了条件と対象境界

- [x] AES-256-GCMでSDKのstorage値を暗号化し、intent/leg/attempt/purpose/発行時刻/期限/keyをAADへ束縛する。
- [x] contextを固定し、leg最大3分・proof最大10分、非active・期限切れ・改ざん・未知keyを拒否する。
- [x] AuthJSの利用するkeyだけを受け入れ、provider tokenを永続化前に除去する。
- [x] 非同期処理の前後で失効を確認し、書込みには正規contextとrevisionの原子的なCASを要求する。
- [x] 期限切れ後も復号を要しないCAS cleanupを提供し、元のphase/contextをDB照合へ渡す。
- [x] 実WebCryptoの単体検査と独立した差分レビューを回収する。
- [ ] 標準check、Draftレビュー、指摘対応、Ready、必須CI、merge、公開を完了する。

これは注入されたrepository/keyringを利用する部品であり、本番DB adapter・鍵発行・公式SDKによるOAuth交換・公開APIの完成ではない。DB adapterはactive状態と正規phase・発行時刻・期限・revisionをDB時刻で同一transaction内に照合する必要がある。in-memory repositoryは単体検査だけに使い、IT/E2Eへ流用しない。

## 検証

`test-results/account-merge/runtime-parent-unit.log`: 13件成功、48検証。実WebCryptoで暗号化往復・各AAD項目の改ざん・nonce更新・key切替・入力検査・await中の期限切れ/terminal・CAS競合・後片付け・秘密を含む例外の非露出を検査した。

`test-results/account-merge/runtime-review.md`: 固定したソースSHAに対する独立レビュー。部品の範囲では未対応P0/P1/P2なし。本番adapterと公開フローの未実装は残す。

追加レビューで、同じlegの認証段階が変わった後に古いstorageのcleanupが新しいproof記録を消し得るinterface不足を検出した。`deleteIfRevision`へ元の不変contextを必須で渡し、adapterにphase/contextとrevisionの同一transaction照合を要求する。`runtime-cleanup-red.log`→`runtime-cleanup-green.log`で、古いlegによる削除拒否と正しいproofによる削除成功を回帰化した。active/期限をcleanupの条件には追加していない。変更後の全検査・再レビューは回収して記録する。

`runtime-candidate-check.log`: 固定候補tree `c59853e63019b4ee896634dcc36037598a26b437`の標準check全体が成功。692単体検査・4,068検証、うちruntimeは14件・51検証。693文言/10言語、351ソースの直書き違反0、重複0、型・教材・構造・buildも成功した。最初の標準checkが検出したテスト重複5件は、単体検査専用fixtureへ整理して解消した。検査条件と全assertionは維持した。

その後の最終レビューは、本物の`RuntimeStorageError`でも注入されたrepository/keyringがmessage/codeを書き換えると秘密を伝播できるP1を検出した。`runtime-error-instance-red.log`で再現し、repositoryのread/delete/terminal/CAS・keyringのactive/resolve・clockの7境界を固定エラーへ変換した。内部で生成した検証/暗号化エラーだけをブランド化して維持する。新しい`runtime-error-instance-green.log`は追加2件・18検証を成功し、runtime全体は16件・69検証。旧SHAに束縛されたレビューを最終候補の証跡へ流用せず、全checkと独立レビューを再回収する。

修正後の`runtime-final-check.log`は候補tree `2cba5f5097f39d07c531f2c9c7b17e5daa42e4ce`で全check成功（694件・4,086検証、重複0、辞書/直書き/型/教材/構造/buildも成功）。入力archiveとlockfile SHAは`runtime-final-candidate-source.json`で固定した。

再レビューで直接exportされた復号helperの入力getterが例外秘匿範囲の外にあるP1も採用した。暗号化/復号の入力検査、context固定、JSON session検査を同じ固定エラー境界へ揃えた。`runtime-input-boundaries-red.log`→`runtime-input-boundaries-green.log`は4入力経路・8検証を回帰化し、関連全体は`runtime-final-parent-unit.log`で17件・77検証成功。最終候補の標準checkとSHA束縛レビューは別途回収する。

`runtime-boundaries-check.log`: 最終入力境界修正を含む候補tree `045c357245556407875056b2173f57ad1eada791`の標準check全体成功（695件・4,094検証、重複0、10言語の辞書整合・直書き検出・型・教材・構造・build成功）。`runtime-boundaries-candidate-source.json`でarchive/lockfile SHAを保存した。
