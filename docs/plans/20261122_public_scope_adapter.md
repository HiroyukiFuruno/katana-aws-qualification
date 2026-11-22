# #58 public writer/read scope adapter

## 目的と未接続境界

finalize/importはpublic append/require_generationを内部で複数呼ぶ。Auth/session→state→account/memberの最初のlockだけを実行し、transaction-localの同actor/SID/account/epoch/generationをnested呼出しで共有する。writer SHARE取得後にreset UPDATEへupgradeしない。

16のprivate locker/read helperはlegacy段階なので、17のcommit固定proof binding/fence判定へ接続してからpublicへ使用する。今回のsourceは未登録のprivate proposalであり、44 public RPC・RLS・FK・clientをまだ変更しない。cacheは外部パラメーターではなくprivate callerだけが設定するtransaction-local GUC。JWT/headersは毎回再検証し、期限切れやscope変更を再利用しない。

- [ ] writer grant判定をresolve_current_learning_grantへ統合し、承認済proof SIDを通常OAuth cutoffで一律拒否しない。
- [ ] exactscope cacheでnested writer・reset→nested writerを許し、writer→resetとscope/gen/actor変化を拒否。
- [ ] read helper/bootstrapも同じgrant判定へ統合する。public data read/write はheader binding/legacy1:1だけを受ける一方、bootstrapは署名主体自身のlive grantからunbound own-scope metadataを返し、bound headerがあればaccount/epochを完全照合する。Auth-onlyはreadonly onboardingを返し、state/accountを作らない。
- [ ] 実signedHTTP/DBでnormal/proof/oldSID・nested finalize・reset upgrade・期限/headers/generation変化・Tx別cache非共有を回帰。
- [ ] 全source gateを通し、全44RPC/10RLS/12FK・新client・全退会と一体公開。これだけで#58 Closeしない。

別紙: test-results/account-merge/public-cutover-required-integration.md。
