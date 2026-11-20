# 基礎学習の再実装・未対応指摘

## 撤回した完了判断

- [/] 読む段階がなく、短い説明と問題が同時に始まる。通常の単元入口を教材の読解に変更し、確認問題は明示操作で開始する。
- [/] 12単元中6単元が未公開。今回の対象は既存の全12単元であり、準備中を残してCloseしない。
- [/] 公開単元も2問と短文しかなく学習目標を満たしていない。用語の意味、仕組み、判断の手順、具体例、典型的な誤解を本文で教え、その内容から確認問題へ進める。
- [/] 件数・画面表示・採点テストだけを教材の完成根拠としない。本文で説明した知識と設問・選択肢別解説の対応、正確性と独立した学習価値をレビューする。

## 分類と対象

既存の安定した単元IDと順序を維持する。AWS固有の概念と一般技術の説明を区別し、前提単元へのリンクを設ける。

|順|単元ID末尾|到達目標の内訳|
|---|---|---|
|1|cloud-concepts|オンデマンド利用と従量課金、責任共有、Region/AZ、可用性と費用の判断|
|2|core-services|EC2/Lambdaの実行、S3/EBSの保存、RDS/DynamoDB、要件からサービスを選ぶ|
|3|identity-access|認証と認可、IAM principalとrole、policyと明示deny、最小権限と一時credential|
|4|data-protection|転送中/保存時暗号化、KMSと鍵の権限、backupと復元、機密情報の扱い|
|5|networking-basics|IPとport、TCP/UDP、HTTP/TLS、通信のどの段階が失敗したか|
|6|domain-dns|名前解決の流れ、record種類、TTL/cache、DNSとHTTP/TLSの責務|
|7|cidr-subnets|IPv4とprefix、範囲と包含、重複しない設計、AWS予約addressとpublicの条件|
|8|routing-connectivity|routeの選択、IGWとNAT、SG/NACL、private接続と経路の切り分け|
|9|cicd|commitからbuild/test、CIとdelivery/deployment、artifactの同一性、段階的なpromotion|
|10|testing-quality|unit/integration/E2E、固定入力と期待値、品質gate、失敗時の調査と再発防止|
|11|release-rollback|rolling/blue-green/canary、監視と中止基準、rollback/rollforward、DB互換性と復旧|
|12|observability|metrics/logs/traces、latency/errors/traffic/saturation、SLOとalert、仮説と改善の検証|

## 教材データ契約

既存のunitフィールドを保持して、以下を追加する。draftは`docs/fundamentals-drafts/<unit末尾>.json`に1単元ずつ保存し、統合時に内容をレビューして公開データへ移す。

- `learningObjectives`: `{id, text, sectionIds}`の配列。4つの実際に判断・説明できる目標を置く。
- `sections`: `{id, title, paragraphs, example:{scenario, steps, outcome}, misconception:{claim, correction}, takeaways, source:{label,url}}`の配列。sectionは4つの目標と対応する。paragraphsは用語の前提から因果・判断の手順まで原文で説明する。例は状況→手順→理由付き結論とする。
- `questions`は既存Question形式に`objectiveId`、`sectionId`、`application: 'recall' | 'apply' | 'integrate'`を追加する。各目標について概念確認・状況への適用・誤解/判断の確認を行う12問を用意する。単に名詞を置換した水増しや同一判断の反復は不可。
- 4形式（正しい1つ、誤り1つ、正しい複数、誤り複数）を各単元で使用し、選ぶ個数を明記する。複数選択は5選択肢から2つ等、否定の二重反転を避ける。全選択肢に根拠のある解説を付ける。
- 既存問題IDは保持し、内容を変更した場合だけrevisionを上げる。新規IDはunit固有prefixを使い、重複させない。`source`は実際に確認した公式一次資料、`learning.reason/concept`は独自の説明とする。
- 各設問が指すsectionで正答の判断材料を学べること。本文未説明の知識を確認問題の正答条件にしない。

## 学習の流れと検証

- [x] カタログ→到達目標/読解→例と要点→確認問題→選択肢別解説→関連本文へ戻る/次単元。通常入口にQuestionCardを置かない。
- [x] 読み直しで途中の回答を勝手に消さない。明示復習入口は対象問題へ進めるが、教材への戻り口を持つ。
- [x] 既存回答履歴のID/revision契約、ゲスト・アカウント保存、誤答復習を保持する。
- [x] 全12単元・目標と本文/設問の参照、4形式、孤立/重複IDを自動検査する。各教材を一次資料と照合し、目標別の内容レビューを別途記録する。
- [x] 通常入口で読解が先に表示されること、全単元で問題開始・採点・本文への復帰ができることを実ブラウザ回帰検査する。既存checkと品質gateを維持する。
- [ ] Draftレビューの指摘を解消して小分けに公開し、全対象が整うまで#25をOpenに保つ。


## 公開前の検証記録

- `bun run check`: 66 tests / 568 assertions成功、build・32問題bank・12単元144問・10言語・重複0・依存検査を維持。`test-results/auth/fundamentals-fullcheck.log`。
- `bun run auth:integration`: 実GoTrue/OIDC/browserで100件成功、Docker終了を確認。`test-results/auth/deletion-integration.log`。
- 全12単元の本文入口、各12問の採点と履歴、本文開閉時の選択/採点結果保持、後半catalogからのfocus/scroll、10言語×320/390px×light/darkを回帰検査した。
- 内容レビューは`docs/fundamentals-drafts/review-*.md`。初回の指摘と最終修正の照合を分離し、公開教材のhashを記録した。
- 公開とIssue Closeは未実施。上記のローカル成功だけでCloseしない。
