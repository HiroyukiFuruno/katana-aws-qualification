# #58 所有境界のlockと実競合ハーネス

非公開部品と検査の記録。公開API/全writerへの接続・履歴統合・実利用者の変更は含めない。

## 取得順と失効

- 全対象membershipのUID集合/revisionを発見し、Auth user UUID順SHARE→session/AMR→state UUID順→account/membership/grantを取得する。
- writerはstate SHARE、reset/mergeは最初からUPDATEを選ぶ。同transactionの再入を拒否し、後付けupgradeをしない。
- 下位lock後のVOLATILEな最新読取で集合/revision・claim expiry・session・grant/epoch/fence・generationを再検査する。増減はretryで中止し、新UIDを後取りしない。
- GoTrueのrefreshはsession先行でuserを更新するため、KAQのsession/AMR SHAREはNOWAITとする。競合は`PT409/KAQ_SCOPE_RETRY`で全transactionを戻し、userを保持したまま逆順待機しない。直接の内部session helperにも同じ規則を適用する。

## 実検証と通常CI

- [x] 元のblocking取得で実GoTrue refreshと`40P01`を再現。修正後はKAQ retry・GoTrue HTTP200・意図外marker0。
- [x] 専用GoTrue/PGで108 SQL条件と12競合シナリオを標準`account:integration`へ接続。標準2 OIDCのcomposeを片付けてから、別の専用fixtureを起動する。
- [x] user削除、writer/reset/merge、候補UID増減/revision、待機中のclaim/session期限、再入、isolation、実refresh/direct helper競合を検査する。
- [x] refreshの変更は、当該2 userのupdated_at前進・既存保護列不変・正確な4監査行・公式session/token変更だけに限定する。その他のAuth/学習/private状態の差を拒否する。診断で実際の変更列/監査actionを確認して条件を固定した。
- [x] Python stdlib unit7件でsetup失敗時cleanup・起動argv・refresh保護列/監査差分の拒否を検査。ITは実GoTrue/DBでMock/固定待機/timeout延長なし。
- [x] 標準runner全体exit0、専用container残0、deadlock0/意図外書込0。元失敗・SQL診断・保護列/監査診断も別artifactへ保持する。
- [ ] Draftレビュー/指摘修正・必要CI成功・main反映。

成果物は`test-results/account-merge/integration/locking-harness/`へ出し、既存CI uploadに含める。SQL入力SHAを固定し、検査中の変更も失敗として検出する。Python実行は内部でDockerを直接起動し、開発者用CLIには依存しない。専用IDの所有追跡を行い、起動途中の失敗でもそのIDだけを片付ける。

## 未接続の条件

全callerのREAD COMMITTED/lock順・membership writer協調、両側proof認可、receipt束縛の承認session例外、完全preview/merge/退会、logical owner FK/RLS/ブラウザーcutoverは未実装。通常のfresh fenceをreason文字列だけで迂回しない。hosted設定とSQLの完全原子性や全Auth APIの協調まで証明したとは扱わない。
