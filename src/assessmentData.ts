import type { AssessmentItem } from './assessmentTypes';

export const assessmentData: AssessmentItem[] = [
  {
    id: 'f1',
    skill: 'fundamentals',
    prompt: 'EC2上でLinuxを運用する際、ゲストOSのセキュリティパッチを適用する責任は？',
    options: ['AWS', 'EC2を運用する利用者', 'AWS Support'],
    correct: 1,
  },
  {
    id: 'f2',
    skill: 'fundamentals',
    prompt:
      'EC2からFargateへ移行しても、一定の利用額へのコミットで計算料金の割引を受けたい。どれを検討する？',
    options: ['Compute Savings Plans', 'EC2 Instance Savings Plans', 'EC2 Capacity Reservation'],
    correct: 0,
  },
  {
    id: 'a1',
    skill: 'architecture',
    prompt:
      'ピーク時にリクエストがDBの書き込み能力を超える。処理の遅延を許容し、受け付けは継続したい。どの変更が適する？',
    options: ['リードレプリカを追加', 'DNSのTTLを短くする', '受付とDB書き込みの間にキューを置く'],
    correct: 2,
  },
  {
    id: 'a2',
    skill: 'architecture',
    prompt: '別リージョンへの複製遅延が最大5分あり、切替手順の実行に30分かかる。対応する指標は？',
    options: ['RPOは5分、RTOは30分', 'RPOは30分、RTOは5分', 'RPOもRTOも30分'],
    correct: 0,
  },
  {
    id: 's1',
    skill: 'security',
    prompt:
      '別アカウント所有のKMSキーで暗号化したS3データをIAMロールで読む。S3側の許可は済んでいる。KMSでは何を確認する？',
    options: [
      '読み手のIAMポリシーだけ',
      'キー所有者のキーポリシーと読み手のIAMポリシー',
      'S3バケットのCORS設定',
    ],
    correct: 1,
  },
  {
    id: 's2',
    skill: 'security',
    prompt: 'ECS Fargateのアプリが特定のSQSキューを操作する。どこに許可を付ける？',
    options: ['タスク実行ロール', 'ECSサービスリンクロール', 'タスクロール'],
    correct: 2,
  },
  {
    id: 'n1',
    skill: 'networking',
    prompt:
      'VPNで接続したオンプレミスから、公開宛先IPを使わずS3に接続したい。どのエンドポイントを使う？',
    options: [
      'S3インターフェイスエンドポイント',
      'S3ゲートウェイエンドポイント',
      'インターネットゲートウェイ',
    ],
    correct: 0,
  },
  {
    id: 'n2',
    skill: 'networking',
    prompt:
      'VPCのセキュリティグループとネットワークACLのうち、ステートレスで戻り方向の許可も設定するものは？',
    options: ['セキュリティグループのみ', '両方', 'ネットワークACLのみ'],
    correct: 2,
  },
  {
    id: 'd1',
    skill: 'development',
    prompt:
      'SQSからLambdaへバッチ配信している。1件の処理失敗で、成功したレコードまで再試行されることを避けたい。どの設定を使う？',
    options: [
      '部分バッチ応答で失敗IDのみ返す',
      'Lambda同時実行数を増やす',
      'Visibility Timeoutを短くする',
    ],
    correct: 0,
  },
];
