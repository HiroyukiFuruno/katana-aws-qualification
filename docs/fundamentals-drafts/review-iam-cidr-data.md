# IAM・CIDR・データ保護 教材内容レビュー

レビュー日: 2026-11-20  
対象: `identity-access.json`, `cidr-subnets.json`, `data-protection.json`  
方針: 内容のみのread-onlyレビュー。対象3 JSONは変更していない。各設問を本文の根拠から実際に解き、promptの極性・選択数・`correct`・選択肢説明を照合した。

## 重大度の定義

- **P0**: 正答が反転しており、学習者が誤った判断を学ぶ。
- **P1**: promptの極性/metadataと正答キーが矛盾する、または本文の結論を誤らせる。
- **P2**: 重複、説明不足、本文と設問の対応が弱いが、正答自体は判断できる。
- **OK**: 本文根拠、設問極性、選択数、正答、解説が整合。

## identity-access

目標と本文は、(1)認証/認可、(2)principal/role、(3)Allow/Deny、(4)最小権限/一時credentialの4段階で初心者が判断できる構成。各sectionに因果・切り分け・具体例・misconception・takeawaysがあり、AWS IAMの一次資料と整合する。ただしauthn-authzの3問は同じ「サインイン成功後のAccessDeniedなら認可を調べる」判断を繰り返す。

| ID | 回答照合 | 判定・理由 |
|---|---|---|
| fund-iam-101 | A | **OK**。認証=主体の確認。Bは認可、Cは暗号化で、本文の定義と一致。 |
| fund-iam-102 | B | **OK**。サインイン後のAccessDeniedは要求action/resourceとAllowを確認する。選択数1・correctも一致。 |
| fund-iam-103 | A | **P2**。正答Aは正しいが、102とほぼ同じ「認証成功後は認可確認」を再出題。integrateとして新しい統合判断がない。**修正案**: 同一要求の明示Deny・resource policy・conditionを組み合わせた別シナリオへ変更。 |
| fund-iam-104 | B | **OK**。roleは長期password/access keyを必ず持たず、一時credentialを使うという本文と一致。 |
| fund-iam-105 | C | **P0（既知）**。promptは「適切な方法」を問うのに、correct=Cは誤った長期キー直書き。AとBが適切で、現状は極性/正答キー/learningを修正必須。**修正案**: requiredChoicesを2、correctを[A,B]にし、promptを「適切な方法を2つ」にする（またはAだけを残してCを不適切選択肢にする）。 |
| fund-iam-106 | A | **OK**。roleを作るだけでは誰でも引受不可で、trust policy等が必要。 |
| fund-iam-107 | A,D | **OK**。明示Deny優先とprincipal/action/resource固定の2点。B/C/Eの解説も本文と一致。 |
| fund-iam-108 | B,E | **OK**。Allowのaction/resource一致と明示Deny/condition確認。Denyを認証済みだから無視するDは誤り。 |
| fund-iam-109 | A,C | **OK**。同一対象のAllowとDenyではDeny優先、発生ポリシー/条件を調査する。 |
| fund-iam-110 | B,D | **OK**。管理者権限の初期付与と長期key共有が最小権限に反する。 |
| fund-iam-111 | A,E | **OK**。全bucket削除と個人keyコピーが誤り。B/C/Dはジョブ用role・限定resource・一時credentialで本文と一致。 |
| fund-iam-112 | C,D | **OK**。全操作許可、期限なし共通keyが誤り。A/B/Eは設計手順として正しい。 |

### IAMの追加指摘

- **P2 / fund-iam-101〜103**: 3問が同じsection・同じ結論に集中し、authn/authzの用語定義以外の判断（例えば認証失敗、認可の対象不一致、明示Deny）を十分にカバーしない。3問のうち1問を認証失敗の切り分け、1問をaction/resource不一致、1問をDeny優先へ分ける。
- **P1 / fund-iam-105** は上記P0と同一問題を指す。修正後に「適切な方法」の極性と選択数を再検査する。

## cidr-subnets

4目標（prefix/範囲、包含/重複、AWS予約IP、public/privateの経路）が4sectionに一対一で対応し、本文には計算手順・範囲比較・予約数・route table/IGW/public IPの順序がある。AWS VPCの予約IPおよびpublic subnetの定義と整合する。

| ID | 回答照合 | 判定・理由 |
|---|---|---|
| fund-cidr-001 | A | **OK**。/26は64、/24は256なので/26の範囲が小さい。 |
| fund-cidr-002 | B | **OK**。/24を4分割すると/26。 |
| fund-cidr-101 | C | **OK**。/26を2つまとめると/25であり/24ではない。 |
| fund-cidr-102 | B | **OK**。AZが違っても同一VPC内CIDRの重複は不可。 |
| fund-cidr-103 | A | **P0（既知）**。既存10.0.0.0/25は.0〜.127を含み、Aの10.0.0.64/26はその内部で重複する。非重複の正答はB（10.0.0.128/25）。**修正案**: promptを「重複しない候補を1つ」に保つならcorrect=[B]、Aの解説は誤候補として明示。 |
| fund-cidr-104 | A | **OK**。VPC内包含と既存範囲非重複を最初に確認する。 |
| fund-cidr-105 | B,E | **OK**。AWSは先頭4個と末尾1個を予約し、必要台数へ予約分を加える。 |
| fund-cidr-106 | A,C | **OK**。/27は32で不足、/26は64-5=59で50台を収容。 |
| fund-cidr-107 | B,D | **OK**。将来余地と予約5個を合算して設計する。 |
| fund-cidr-108 | A,E | **OK**。CIDRだけでpublicとは決まらず、privateという名前もIGW経路を打ち消さない。 |
| fund-cidr-109 | B,D | **OK**。subnet名だけで判断すること、CIDRだけでport/listenerを調べないことが誤り。 |
| fund-cidr-110 | C,E | **OK**。到達性はCIDR数字だけで決まらず、IGW経路があってもSG/portが必要。 |

### CIDRの追加指摘

- **P0 / fund-cidr-103** は上記のとおり正答反転。本文のplanning sectionが示す包含/重複判定とも矛盾する。
- それ以外は、promptの極性・requiredChoices・correct・選択肢説明が一致し、本文から正答を導ける。

## data-protection

4目標は暗号化の場面、KMS権限、backup/restore、secret分離に対応し、本文に「経路/保管場所を分ける」「データ許可と鍵許可を分ける」「復元テスト」「ログ/role/rotation」がある。AWS KMS、AWS Backup、Secrets Managerの一次資料と方向性が一致する。

| ID | 回答照合 | 判定・理由 |
|---|---|---|
| fund-data-101 | A | **OK**。TLSは転送中を保護し、保存時暗号化やIAMとは別。 |
| fund-data-102 | B | **OK**。TLSと保存先暗号化を別々に確認する。 |
| fund-data-103 | C | **OK**。HTTPSだけでは保存データの暗号化/鍵管理を保証しない。 |
| fund-data-104 | B | **OK**。KMS keyが存在してもprincipalの利用許可は自動付与されない。 |
| fund-data-105 | A | **P1**。promptは「適切な確認」を1つ問うが、correct=Aは「鍵権限を見ない」という不適切な方法。本文はsecret読取権限とKMS鍵利用権限を分けて確認すると説明しており、正しい選択肢はBまたはC（設問を2つ選択にするならB,C）。**修正案**: promptを「適切な確認を2つ」にし、correct=[B,C]。 |
| fund-data-106 | B,D | **OK**。principal/KMS operationの特定とデータ許可・鍵許可の分離。 |
| fund-data-107 | A | **OK**。backup成功はrestore可能性の証明ではなく、復元後確認が必要。5選択肢だがrequiredChoices=1で、極性も正しい。 |
| fund-data-108 | B,C | **OK**。分離先へ復元し件数とアプリ接続を確認する。 |
| fund-data-109 | A,D | **OK**。復旧point、復旧時間、確認基準を決める。 |
| fund-data-110 | B,D | **OK**。平文ログと全アプリ共通admin secretが誤り。 |
| fund-data-111 | A,E | **OK**。コードへの平文commitとチャット配布が誤り。 |
| fund-data-112 | C,D | **OK**。暗号化済みでもログ露出は不可、rotation後の利用確認も必要。 |

### data-protectionの追加指摘

- **P1 / fund-data-105** はprompt/selectionPolarity/correctの不一致。Cが本文に沿う適切な確認なのに、Aをcorrectにしている。修正後は選択数と全選択肢解説を再検査する。
- それ以外は、本文の判断根拠、正答、解説が整合している。fund-data-107の選択肢数が5でも、requiredChoices=1の単一選択として形式上問題ない。

## 共通の形式・対応確認

3ファイルとも4目標・4section・12問で、各設問の `objectiveId`/`sectionId` は対応する本文sectionを指す。各設問には全選択肢のexplanation、https source、learning.reason/conceptがあり、`parseQuestions`相当の基本構造は通る。ただし件数やparse成功だけでは正答の事実性を保証しないため、上記P0/P1を修正してから再度実際に解く必要がある。

### 形式上の分布（参考）

| 単元 | 正しい1 | 誤り1 | 正しい複数 | 誤り複数 |
|---|---:|---:|---:|---:|
| identity-access | 3 | 3 | 3 | 3 |
| cidr-subnets | 3 | 3 | 3 | 3 |
| data-protection | 3 | 3 | 3 | 3 |

## 修正依頼一覧

1. **P0 `fund-iam-105`**: 適切な方法を問うpromptに対して長期access key直書きをcorrectにしている。A/Bを正答に修正する。
2. **P0 `fund-cidr-103`**: 既存/25と重複するAをcorrectにしている。非重複Bを正答に修正する。
3. **P1 `fund-data-105`**: 適切な確認を問うpromptに対して鍵権限を見ないAをcorrectにしている。B/Cを正答に修正する。
4. **P2 `fund-iam-103`**: IAM-102と同じ認証成功後の認可確認を反復。統合判断の異なる設問へ差し替える。

## source hash

レビュー時点の対象ファイルsha256（rootが修正後に更新すること）:

```text
339e719eddfd2c913f302b64c185e9d1ecbdd3297fb39ac30af9f379b841b716  docs/fundamentals-drafts/identity-access.json
fa3c1f6bb05fe721bdadbf945ee671a119ea0074605c4dcb160f7b2951424a6a  docs/fundamentals-drafts/cidr-subnets.json
7011b44ef2096b1ec7ff2c0a2921be915cf444a6eaad225862658f9186792f3c  docs/fundamentals-drafts/data-protection.json
```
