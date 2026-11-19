import type { AssessmentItem } from './assessmentTypes';

export const assessmentExtra: AssessmentItem[] = [
  {
    id: 'd2',
    skill: 'development',
    prompt:
      '決済APIの成功直後に応答が失われることがある。SQSが注文を再配信したときに二重請求を防ぐには？',
    options: [
      '試行するたびに別の決済キーを使う',
      '同じ注文の再試行で共通の冪等キーを使う',
      '受信したら決済前にメッセージを削除する',
    ],
    correct: 1,
  },
  {
    id: 'o1',
    skill: 'operations',
    prompt:
      'ECSのローリングデプロイで起動失敗を検出し、直近の完了済みデプロイへ自動で戻したい。何を設定する？',
    options: ['ECSタスクロール', 'ALB登録解除遅延', 'デプロイサーキットブレーカーのロールバック'],
    correct: 2,
  },
  {
    id: 'o2',
    skill: 'operations',
    prompt: 'AWS APIを誰が呼んだかを確認する。通常参照する記録は？',
    options: ['CloudTrailイベント', 'VPC Flow Logs', 'CloudWatchのCPU使用率'],
    correct: 0,
  },
  {
    id: 'e1',
    skill: 'data',
    prompt: 'Athenaで日次ログの一部の列だけを集計する。日付と列の両方でスキャンを減らす構成は？',
    options: [
      '単一の非圧縮CSVにまとめる',
      '日付パーティション付きのParquet',
      'S3バケットをバージョニングする',
    ],
    correct: 1,
  },
  {
    id: 'e2',
    skill: 'data',
    prompt: 'Kinesisの新規コンシューマーが過去7日分を読み直す。ストリーム側で準備する設定は？',
    options: [
      'Enhanced Fan-Outを有効にするだけ',
      'シャード数を1にする',
      '必要な期間を先に保持期間に設定する',
    ],
    correct: 2,
  },
  {
    id: 'i1',
    skill: 'ai',
    prompt:
      '社内文書が頻繁に更新される。最新の文書断片を参照した回答を生成し、モデルの再訓練を避けるには？',
    options: [
      'RAGで文書を検索しコンテキストに渡す',
      '更新のたびにモデルをファインチューニングする',
      '出力のtemperatureを上げる',
    ],
    correct: 0,
  },
  {
    id: 'i2',
    skill: 'ai',
    prompt: '分類モデルで、検証中に見たデータだけ精度が高い。最終評価で汎化性能を確かめるには？',
    options: [
      '同じ検証データでハイパーパラメータ調整を続ける',
      '調整に使っていないテストデータで評価する',
      'トレーニングデータだけで精度を比較する',
    ],
    correct: 1,
  },
];
