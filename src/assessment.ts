import { certifications, type Skill } from './certifications';

export const profileKey = 'katana.certification-profile.v1';

type Item = { id: string; skill: Skill; prompt: string; options: [string, string, string]; correct: number };

export const assessment: Item[] = [
  { id: 'f1', skill: 'fundamentals', prompt: 'EC2上でLinuxを運用する際、ゲストOSのセキュリティパッチを適用する責任は？', options: ['AWS', 'EC2を運用する利用者', 'AWS Support'], correct: 1 },
  { id: 'f2', skill: 'fundamentals', prompt: 'EC2からFargateへ移行しても、一定の利用額へのコミットで計算料金の割引を受けたい。どれを検討する？', options: ['Compute Savings Plans', 'EC2 Instance Savings Plans', 'EC2 Capacity Reservation'], correct: 0 },
  { id: 'a1', skill: 'architecture', prompt: 'ピーク時にリクエストがDBの書き込み能力を超える。処理の遅延を許容し、受け付けは継続したい。どの変更が適する？', options: ['リードレプリカを追加', 'DNSのTTLを短くする', '受付とDB書き込みの間にキューを置く'], correct: 2 },
  { id: 'a2', skill: 'architecture', prompt: '別リージョンへの複製遅延が最大5分あり、切替手順の実行に30分かかる。対応する指標は？', options: ['RPOは5分、RTOは30分', 'RPOは30分、RTOは5分', 'RPOもRTOも30分'], correct: 0 },
  { id: 's1', skill: 'security', prompt: '別アカウント所有のKMSキーで暗号化したS3データをIAMロールで読む。S3側の許可は済んでいる。KMSでは何を確認する？', options: ['読み手のIAMポリシーだけ', 'キー所有者のキーポリシーと読み手のIAMポリシー', 'S3バケットのCORS設定'], correct: 1 },
  { id: 's2', skill: 'security', prompt: 'ECS Fargateのアプリが特定のSQSキューを操作する。どこに許可を付ける？', options: ['タスク実行ロール', 'ECSサービスリンクロール', 'タスクロール'], correct: 2 },
  { id: 'n1', skill: 'networking', prompt: 'VPNで接続したオンプレミスから、公開宛先IPを使わずS3に接続したい。どのエンドポイントを使う？', options: ['S3インターフェイスエンドポイント', 'S3ゲートウェイエンドポイント', 'インターネットゲートウェイ'], correct: 0 },
  { id: 'n2', skill: 'networking', prompt: 'VPCのセキュリティグループとネットワークACLのうち、ステートレスで戻り方向の許可も設定するものは？', options: ['セキュリティグループのみ', '両方', 'ネットワークACLのみ'], correct: 2 },
  { id: 'd1', skill: 'development', prompt: 'SQSからLambdaへバッチ配信している。1件の処理失敗で、成功したレコードまで再試行されることを避けたい。どの設定を使う？', options: ['部分バッチ応答で失敗IDのみ返す', 'Lambda同時実行数を増やす', 'Visibility Timeoutを短くする'], correct: 0 },
  { id: 'd2', skill: 'development', prompt: '決済APIの成功直後に応答が失われることがある。SQSが注文を再配信したときに二重請求を防ぐには？', options: ['試行するたびに別の決済キーを使う', '同じ注文の再試行で共通の冪等キーを使う', '受信したら決済前にメッセージを削除する'], correct: 1 },
  { id: 'o1', skill: 'operations', prompt: 'ECSのローリングデプロイで起動失敗を検出し、直近の完了済みデプロイへ自動で戻したい。何を設定する？', options: ['ECSタスクロール', 'ALB登録解除遅延', 'デプロイサーキットブレーカーのロールバック'], correct: 2 },
  { id: 'o2', skill: 'operations', prompt: 'AWS APIを誰が呼んだかを確認する。通常参照する記録は？', options: ['CloudTrailイベント', 'VPC Flow Logs', 'CloudWatchのCPU使用率'], correct: 0 },
  { id: 'e1', skill: 'data', prompt: 'Athenaで日次ログの一部の列だけを集計する。日付と列の両方でスキャンを減らす構成は？', options: ['単一の非圧縮CSVにまとめる', '日付パーティション付きのParquet', 'S3バケットをバージョニングする'], correct: 1 },
  { id: 'e2', skill: 'data', prompt: 'Kinesisの新規コンシューマーが過去7日分を読み直す。ストリーム側で準備する設定は？', options: ['Enhanced Fan-Outを有効にするだけ', 'シャード数を1にする', '必要な期間を先に保持期間に設定する'], correct: 2 },
  { id: 'i1', skill: 'ai', prompt: '社内文書が頻繁に更新される。最新の文書断片を参照した回答を生成し、モデルの再訓練を避けるには？', options: ['RAGで文書を検索しコンテキストに渡す', '更新のたびにモデルをファインチューニングする', '出力のtemperatureを上げる'], correct: 0 },
  { id: 'i2', skill: 'ai', prompt: '分類モデルで、検証中に見たデータだけ精度が高い。最終評価で汎化性能を確かめるには？', options: ['同じ検証データでハイパーパラメータ調整を続ける', '調整に使っていないテストデータで評価する', 'トレーニングデータだけで精度を比較する'], correct: 1 },
];

export function remainingCertifications(earned: string[], today: string) {
  return certifications.filter(cert => !earned.includes(cert.id) &&
    (!cert.retireOn || cert.retireOn >= today));
}

export function assessmentItems(earned: string[], today: string) {
  const relevant = new Set(remainingCertifications(earned, today).flatMap(cert => cert.skills));
  return assessment.filter(item => relevant.has(item.skill));
}

export function recommend(earned: string[], answers: Record<string, number>, today: string) {
  const questions = assessmentItems(earned, today);
  const scores = new Map<Skill, number>();
  for (const item of questions) {
    const group = questions.filter(question => question.skill === item.skill);
    scores.set(item.skill, group.filter(question => answers[question.id] === question.correct).length / group.length);
  }
  const candidates = remainingCertifications(earned, today).map(cert => {
    const readiness = cert.skills.reduce((sum, skill) => sum + (scores.get(skill) ?? 0), 0) / cert.skills.length;
    const gaps = cert.skills.filter(skill => scores.get(skill) !== 1);
    const days = cert.retireOn
      ? (Date.parse(cert.retireOn) - Date.parse(today)) / 86_400_000
      : Infinity;
    const priority = cert.beta ? -1 : days <= 60 && readiness >= 0.75 ? 3 : 0;
    return { cert, readiness, gaps, priority };
  });
  const ordered: typeof candidates = [];
  const completed = new Set(earned);
  const levels = { 基礎: 0, アソシエイト: 1, プロフェッショナル: 2, 専門: 2, ビジネス: 1 };
  while (candidates.length) {
    const eligible = candidates.filter(({ cert }) =>
      cert.buildsOn?.every(id => completed.has(id) || !candidates.some(candidate => candidate.cert.id === id)) ?? true);
    const next = (eligible.length ? eligible : candidates).sort((a, b) =>
      b.priority - a.priority ||
      (b.readiness - levels[b.cert.level] * 0.24) - (a.readiness - levels[a.cert.level] * 0.24))[0];
    candidates.splice(candidates.indexOf(next), 1);
    completed.add(next.cert.id);
    ordered.push(next);
  }
  return ordered;
}
