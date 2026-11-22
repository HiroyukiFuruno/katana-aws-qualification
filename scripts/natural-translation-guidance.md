# 自然翻訳の共通校正基準

When identifiersByQuestion is provided, each entry lists exact technical tokens required at specific output-field paths. Preserve EVERY listed token in the corresponding field in EVERY requested locale. In particular, capitalized Query and Scan are DynamoDB API names, even in English; natural verbs such as queries do not replace the explicit API identifier. Check the entire list before returning JSON.

- 全文脈を読み、各言語の初稿を文法・語順・性数一致・用語統一の観点で校正してからJSONを返す。正答と誤答の意味、否定、数値、単位、選択数を保持する。
- 各対象フィールドに明示された操作・条件・時制を、そのフィールド内に残す。例えば問題文の「発生時に収集し、発生後に調査する」という要件を、選択肢や学習ノートにだけ残して問題文から省略しない。
- 問題文にない実装方式や製品名を、正解選択肢や補足指示から問題文へ追加して正答の手掛かりにしない。補足指示は誤訳を防ぐ文脈であり、追加の出題条件ではない。
- 見出しは既に問題文で明示された専門領域に合わせる。WAFの問題では直訳的な「防御ルール」より各言語で自然な「WAFルール」を使う。問題が選ばせる正解製品名を見出しへ先取りして追加しない。
- 規則が「検知になる」という直訳より、「一致を数え、評価を終了しない」のように振る舞いを自然に説明する。
- フランス語のmessagesは男性複数であり、tels quelsと一致させる。telles quelles les messagesという誤りを避ける。
- WAFではグループが返すアクションと内部の各ルールのアクションを区別する。フランス語ではaction renvoyée par le groupeのように明確に表現する。
- 部分バッチの再試行は、失敗した項目だけを再試行する意味を保つ。フランス語のlots partielsで複数の不完全なバッチを示す表現へ変えない。
- AWS機能名を英語動詞のまま使わず、対象言語の自然な構文に組み込む。フランス語ではRedrive l’exécutionではなく、Lancer une opération Redrive sur l’exécutionなどとする。
- 組織の部門を示すタグとAWSサービスのタグを混同しない。フランス語では必要に応じてbalises de départementと明確にする。
- ECSのweightは容量プロバイダーに設定される。baseによる基本分と、それを超えるタスクの配分を保持する。
- 数値の値を保持しつつ自然な表記を用いる。例えばフランス語の99.99%は99,99 %と表記できる。API名、コード識別子、ARN、URL、IP/CIDR内の数字や綴りはそのまま保持する。
- JSONや設定のプロパティ名を説明的な一般名詞だけへ置き換えない。例えばartifactStoresが明示されたフィールドでは、対象言語で説明を添えても識別子artifactStores自体を保持する。
- sourceLabelなどの出典・分類ラベルも必須の表示文言であり、各言語で空文字にしない。原文のラベル全体を自然に訳し、公式製品名を残す。
- categoryLabel・examDomainLabel・versionLabel・sourceLabelも各問ごとに対象言語へ訳す。原文に専用のLabelフィールドがない場合は、それぞれcategory・examDomain（未指定ならcategory）・version・source.labelを参照する。例えばversionの「オリジナル模試」をversionLabelへ日本語のままコピーしない。資格コードや年月は保持する。
- ポルトガル語でIOPSを説明するときは、as IOPSのような複数形か、taxa de IOPS・número de IOPSのように量を示す名詞を使い、動詞・形容詞・代名詞も一致させる。a IOPS・à IOPSのような単数表現を避ける。引用した設定フィールド名やAPI識別子はそのまま保持する。
- AccessDeniedのようなエラーコードは、access deniedなどの一般的な説明だけへ置き換えない。表示される実コードを綴り・大文字小文字ごと保ち、必要なら自然な説明を添える。
- IAMのprincipalは主体を指す専門用語として訳す。ポルトガル語ではentidade principal（複数entidades principais）とし、principaisだけで主要なものを指す曖昧な表現にしない。EC2の新規作成と既存インスタンスの開始・再起動も区別する。
- EC2やFargateの計算料金は英語でcompute chargesやcompute costsと表現し、calculation feesという直訳を使わない。
- FSxのファイルシステム名Lustreは、似た綴りのLusterへ変えず、全言語で公式名Lustreを保持する。
- 別問題の訳文を流用して設問IDとの対応を崩さない。ECSやKinesis Data Streamsなど原文に明示されたサービス名をそのフィールドに残し、各問題の本文・選択肢・正答をIDごとに再照合する。
- フランス語のソフトウェアにおけるstatelessはsans étatであり、無国籍者を意味するapatrideへ変えない。Transit Gateway等のネットワークのattachmentも、メール添付を意味するpièce jointeではなくattachementとして文脈に合わせて表す。
- イタリア語でモデルの再訓練はriaddestrare il modelloと表現し、人材の職業再教育を意味するriqualificareへ直訳しない。ファインチューニングも一般的な再訓練と混同せず、fine-tuning等で特定の操作を保持する。
- 用語集も各項目の見出し・ID・原文定義を一組で照合する。ShieldのDDoS対策をMacieの機密情報検出へ、GlueのETL定義をKinesisのストリーミング定義へ入れ替えない。原文に明記されたETLなどの専門略語も保持する。
- 原文のAssumeRoleはAPI識別子なので、英語でもassume an IAM roleなどの一般動詞だけに置き換えない。call AssumeRole to assume an IAM roleなど、自然な文の中にAssumeRoleの綴りをそのフィールド内へ明示する。
- 決済コールバックはアプリケーションへの通知であり、支払督促や電話の折り返しではない。フランス語ではcallbacks de paiement等を用い、支払督促を意味するrappels de paiementにしない。ドイツ語ではCallbacks für Zahlungen等とし、Zahlungsrückrufeという直訳を避ける。DB項目の作成も電話・アカウントの登録と混同せず、各言語で自然な作成・書き込みの表現を使う。
- QueryやScanもDynamoDBのAPI操作名として明記された場合は、そのフィールド内に綴り・大文字小文字を保持する。フランス語で単にinterrogerと置き換えず、via l’opération Queryのように自然な説明へ組み込む。一般名詞のqueryを通常のクエリとして訳す場合とは区別する。
- フランス語で空のItems配列を説明するときはune liste Items videやun résultat Items videのように自然な名詞を添え、un Items videとしない。校正のafter値を提示するときも、フィールド全体の完成値を返し、変更した1文だけに縮めて前後の条件を落とさない。
- フランス語のGSI/LSIはun index、ポルトガル語ではum índiceを指すため男性として一致させる。une/la GSI、uma/da/na GSIなどの女性形にせず、un index GSI、um índice GSI等と明示できる。一方、キー・パーティション・テーブル・式など別の名詞の女性形は維持する。
- S3のアップロード先キーはオブジェクト名であり、別のキーを持つ利用者を指さない。認証されていない利用者によるアップロードと、指定キー以外へのアップロードを区別する。独語ではObjektschlüsselとunter、伊語ではchiave oggettoなど自然な対象指定を使う。繁体字では公式に物件金鑰/物件索引鍵の両方が使われるため、金鑰という語だけを機械的に排除しない。

- CloudWatchなどソフトウェアのinstrumentation/計装は、繁体字では文脈に応じて監測程式碼などと表し、物理機器の検査を意味する儀器檢測へ直訳しない。計測や監視に必要なコードを追加しないという条件を保つ。

- Distinguish S3 Intelligent-Tiering access tiers from storage classes: moving between its tiers does not change the storage class. In Spanish use niveles de acceso / niveles de archivado for internal tiers, not clases. Preserve optional archive activation and restoration conditions.

- Compare every translated question against its correct answer and explanations before returning it. Preserve the direction of proportions, destinations, permissions, and time conditions. If only one-quarter of traffic should continue TO Tokyo, keep that quarter going to Tokyo. Japanese fractions such as 4分の1 denote a fraction rather than minutes.

- Check each target language directly against the original source, including every qualifier that makes an answer valid. For CloudFront automatic compression, “次回公開の新URLでは” means the new URLs in the next release, not merely the next release. Preserve the explicit new-URL condition: enabling compression does not retroactively recompress objects already cached. Do not carry an omission from one translated language into the other eight.

- Distinguish resource names from answer letters. If an Aurora reader is named A, write reader A / 读取器 A / 候選執行個體 A as appropriate; do not call it “option A” or 候选项 A. Reader names remain fixed when answer choices are shuffled, while displayed choice letters change.
- When the scenario labels commercial proposals or deployment plans A/B, retain their role as named proposals, not shuffled answer choices. Use an explicit entity noun such as proposal A / proposition A / Vorschlag A / propuesta A / proposta A; do not refer to those scenario entities as option A / opción A / opzione A. Keep the billing, quality, and acceptance conditions attached to the correct proposal.
- Resolve the entity before translating “candidate”: a candidate software/service solution is a solution, not a job applicant. In first mentions, prefer explicit solution wording (FR solution, PT solução, DE Lösung) when a bare person-like noun would mislead. Translate service-counter guidance in context rather than literal compounds such as German Schalterführung. Preserve genuine hiring/applicant contexts.

- Localize numeric separators without changing quantities. English/Japanese `4,096 MB` means 4096 MB. Do not copy `4,096 MB` into French, German, Spanish, Italian, or Portuguese prose where the comma can mean a decimal separator; use `4096 MB` or that language’s unambiguous thousands grouping. Never change numeric API parameter literals or identifiers.

- StackSetsのservice-managedは、サービスが権限を管理するモデルを指す。繁体字では服務管理型權限や由服務管理的權限などと表し、サービス自体が管理されるように読める服務受管理という修飾を避ける。

- IAMロールの引受けは、繁体字では擔任角色などの自然な用語で表し、日本語を直写した引受動作角色にしない。フランス語はassumer/endosser un rôleなどの動詞構文を使い、英語の名詞を持ち込んだassumption du rôleを避ける。API識別子AssumeRoleや原文で指定された引用ラベルは保持する。

- 低サンプル数は観測値の個数が少ない意味であり、観測値自体が低い意味ではない。スペイン語ではpocas muestrasやbajo número de muestrasと表し、muestras bajasという曖昧な直訳を避ける。ignoreなどの明示された設定値はそのまま保持する。

- When the source distinguishes legacy global IAM recording, legacy describes the historically supported resource types, not the age of individual IAM users or roles. Express that distinction naturally and do not add cutoff dates absent from the source.

- Preserve technical acronyms in visible category/domain/version labels as well as question text. If you expand an acronym naturally (for example infrastructure as code), retain the original acronym (IaC) alongside the expansion.

- ML分類指標はaccuracy（全例の正解率）とprecision（予測陽性中の適合率）を区別する。日本語『正解率』『99%正解』をPT precisão /FR précision /ES precisiónのみで表さず、PT acurácia、FR taux de bonnes prédictions（またはexactitude）、ES exactitud等、文脈で定義が明確な自然な語を用いる。title/prompt/各解説も同じ定義で整合させる。適合率自体のprecision訳や一般的な精密さを禁止しない。

- matching形式の既存採点仕様は、correct配列のi番目がprompts配列のi番目に対する正答choice IDを表す（prompt IDの文字列で再ソートしない）。UIはこのslot順を保ち、choiceの表示順だけが変わってもcanonical IDで採点する。JSONの内部配列仕様を問題本文へ説明させる必要はないが、各promptと正答の意味対応そのものは必ずレビューする。orderingも正答の順序を持ち、通常の複数選択の集合とは区別する。
- 繁體中文では引用や証拠が主張を裏付ける文脈は佐證/支持などで自然に表す。機能・互換性の支援は適切なまま保持し、単語全体を機械的に置換・禁止しない。

- LoRAのlow-rankは行列のrankを指す。Portugueseのadaptadores de baixo escalãoは組織の階級の意味なので用いず、matrizes de baixo posto等、数学的な意味が明確な自然文にする。組織の階層を表すescalãoの語自体を禁止しない。
- 提供終了モデルの技術資料を例示する方式一般の設問と、現在そのモデルを呼び出す設問を区別する。現行サービスの選定/呼出しなら現時点の提供状況を要確認とし、旧資料だけで承認しない。
- 現行AWS Quick資料ではQuick Sightという表記が使われる（2026-11確認）。旧知識のみでAmazon QuickSightへの変更を断定せず、実際の参照資料/識別子に基づいて判断する。SDK等のquicksight識別子はそのまま保持する。

- 時点の区別を保つ。予測を生成する日と予測対象の将来日が同じ文中にある場合、両方を曖昧な forecast date だけで表さず、forecast generation time / each day in the forecast horizon 等で原文の二つの時点を明確に訳す。数値・制約を追加しない。

- 2026-11時点の公式資料で、AWS Management Console内のAmazon Q DeveloperはAWS assistantという製品名になっている。原文がそのコンソール支援を指す場合、旧知識だけで旧製品名へ戻さない。IDE/CLI/chat等の別製品にはこの改名を適用せず、qというIAM/API等の技術的prefixはそのまま保持する。根拠: https://docs.aws.amazon.com/assistant/latest/userguide/what-is.html 。

- 現行の https://docs.aws.amazon.com/quick/latest/userguide/what-is.html はAWS Quickと、そのBI機能AWS Quick Sightという表示名を用いる。現行サービスの表示名を原文どおり識別し、更新済み原文を旧ブランドAmazon Quick/Amazon QuickSightへ戻さない。過去の名称の説明やquicksight等の技術的識別子は変更しない。

- 複数選択の意味を原文から判別する。構成要素や手順を2つ選ぶ設問は、選択した要素を組み合わせて要件を満たすかを評価し、各要素単独で全工程を完結させる必要があると決めつけない。反対に独立した代替方式を2つ選ぶ設問なら、それぞれが要件を満たすか確認する。補完関係だけで無条件にpassにせず、残りの選択肢が不適切な根拠と正答の一意性も原文・公式仕様から判断する。

- 会話シナリオの「次の質問」は、受験画面の次問を参照しているように読めないよう、会話内の後続質問・利用者の次の発話という文脈を明確にする。英語ではfollow-up questions、later questions in the conversation、subsequent user turns等を文脈に応じて使い、原文の「応答に依存して変わる」という条件を保持する。質問の実体を省いたり、引用されたAPI識別子を言い換えたりしない。

- JWTのaudienceを説明する通常の文章では、Portuguese/Spanishの冠詞へ英語名詞を直結した不自然な表現を避け、audiências permitidas / audiencias permitidasなど文脈に合う現地語を使い、必要ならaudienceを併記する。API/JSON/コード上のaud、allowedAudience、audienceなどの識別子や原文の引用は正確に保持する。
- Italianで英語のclaimを説明文の借用名詞として使う場合はi claimなど自然な不変形を使い、機械的に英語複数形のsを付けない。claimsというコードのキーや原文引用は変更しない。
- ChineseでAWSのauthorizerコンポーネントを説明するときは授权器/授權器など対象を明確にする。認可を与える主体を表す授权方/授權方とは区別し、語自体を一律に置換しない。

- 監視アラームによる事前検知と、障害・容量逼迫による防御停止を区別し、因果の主語を明示する。アラーム監視が検知に役立つ文を、キャプチャ停止それ自体が早期検知をもたらす文へ逆転させない。原文の条件・効果・保証の強さを保ち、誤答選択肢はその誤った主張も忠実に訳す。

- 技術識別子は原文の各fieldとの対応で保持する。同じ設問の別fieldにecs:RunTaskが残っていても、promptのRunTaskを一般的な「タスクを開始する権限」だけへ置き換えて省略しない。自然な説明を添えつつ、当該fieldのAPI/action名自体を正確に残す。

- 純便益の正負と損失額の大きさを区別する。許容上限を超える主語は損失額であり、正の純便益に損失上限を課す意味へ変えない。負の純便益が許容される下限を下回る関係と、損失額が上限を超える関係を各言語で明確にする。提示された試算を、原文で特定されていない固定契約などへ帰属させない。原文自体の帰属や符号に疑問がある場合は意味レビューで指摘し、誤答の主張も含め翻訳だけで勝手に修正しない。

- French réhébergement is masculine: write le réhébergement / un réhébergement, not la réhébergement / une réhébergement. Feminine heads such as la solution de réhébergement or la stratégie de réhébergement remain feminine.

- In German, the ordinary noun Agent (human or software) has weak declension: den/einen/einem/eines/dem/des Agenten and zum Agenten, including eines eigenen Agenten, not den Agent or eines Agents. Preserve nominative der/ein Agent, official product names such as SSM Agent, AgentCore, and quoted code identifiers; do not mechanically replace every Agent/Agents token.
