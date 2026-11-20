# 教材レビュー指摘の修正確認

以前の4レビュー記録は修正前の証跡として保持する。本記録は公開データへ統合した後の指摘箇所を、問題文・選択肢の真偽・必要選択数・正答・本文の対応で再確認した結果である。件数検査や採点コードの成功を内容の正確性の代わりにしない。

|対象|確認した修正と根拠|
|---|---|
|IAM 103|MFAによる本人確認強化とS3認可の独立性を問う場面へ変更。102のAccessDenied確認と同じ場面を反復しない。|
|IAM 105|誤り1つという問題文に揃え、長期キー直書きCだけが該当する。ロールと一時認証情報のA/Bは妥当。|
|IAM 106|人以外の実行アプリもprincipalを持つことを問う。未説明のtrust policyを正答条件にせず、105の長期キー共有と異なる判断にする。|
|CIDR 101|二つの/26は128個で/24の256個ではない。任意の二つが一つの/25になると断定せず、連続・境界の条件を解説に付けた。|
|CIDR 103|既存.0–.127に対し.64–.127だけが重複。新候補の誤りはA一つ。B/Cは既存範囲外で重複しない。|
|Data 105|誤り1つへ揃え、secret読取だけ確認してKMS許可を調べないAを選ぶ。B/Cは調査に必要。|
|Network 103|UDPが必ず順序・再送を提供するAを誤りとして選ぶ。用途の必要性を検討するB/Cは妥当。|
|Network 109|二次点検でも正しいB/Dが誤答キーに入っていたため再修正。HTTP 404を先に調べるAと証明書再発行でDNSが直るCだけが誤り。Eは問い合わせDNSサーバー/エラーの確認へ変更し、正しい選択肢を3つにした。|
|DNS 103|NSにWebサーバーIPv4を設定するAだけが誤り。別名はCNAME、固定IPv4はAレコードという比較は本文に対応する。|
|CI 003/005|品質gateのrecallとCIのintegrateを本文の対応目標へ配置し、各目標の確認・適用・統合を揃えた。|
|CI 010|外部設定を注入できる場合もartifact識別が必要という誤選択肢Cへ変更。同一検証artifactのdigest確認Aだけが正しい。|
|Testing 009/012|誤りはB/Cの二つ。Eはそれぞれレポート保存と調査記録の正しい判断にした。|
|Release 004|正しいA/CのうちCを観測不能時の拡大中止と調査に変更。CPUだけを見てerror rateを無視するBは誤り。|

全12単元の初回内容レビューは他のreview-*.mdを参照する。上記はその後の変更範囲の確認であり、未公開・自動検査中の状態を公開完了とは扱わない。

## この点検時の教材ハッシュ

- `cicd.json`: `96c1200ef527d1b0ac354c6c366146a7865d7bb6942284c730e7beecbc8cd64e`
- `cidr-subnets.json`: `42e4a3cdd7128252a464b32c20d581d6ed5f319d33c7fa8947ee6b8dc6fae20a`
- `cloud-concepts.json`: `14cbe2d3cb215fb9d64bc07e5a4021139762b60812f8885b0e451c8803dda084`
- `core-services.json`: `22f9104252835f28514ff9f9f0f904e00ed6e4ebc20c616c6b258bb2ab1e82d3`
- `data-protection.json`: `a10b59b214038b712f12d1d2ba8214cda8df7c8faf1713d0ef883d35b97d357d`
- `domain-dns.json`: `78c129995d9f58e142f9ed4afef140ea1176381c38e0ca339e8c33abcfdd9845`
- `identity-access.json`: `53fcc7043031be574d10ce55cb25b20555798795ff566bbfb4636ae15812f806`
- `networking-basics.json`: `38df3ebff03256d584a1c85e9916eab6168e96036d1be8a67ea09e60b983970f`
- `observability.json`: `ceef4866a79c10c779ff4b43673082d39931fb2dfea0f7dad0473acdc6c9015a`
- `release-rollback.json`: `032d2858ca45ef69036aff63ee2281889d079dbcfa14a3ef167381464d4e7163`
- `routing-connectivity.json`: `9b33450ca45e3db09473acc810944c3e2a5390fbcb231701324072ad883ff7cf`
- `testing-quality.json`: `d8e371fb6bb09bcd6697f8b75badda2ad0e4c2a2058c790aa5669dc714b9c344`
- `public/fundamentals/content.json`: `332961193717ac32151fd24fbb36f255d78113e72c761e574a2cbd1d5fd6fc25`
