import { expect, test } from 'bun:test';
import { validateTranslation } from './content-translation-validation';

test('assessment prompt edits retain the service named in their own source question', () => {
  const cases = [
    {
      source:
        'ECSのローリングデプロイで起動失敗を検出し、直近の完了済みデプロイへ自動で戻したい。何を設定する？',
      misplaced:
        'Une API de paiement accepte une clé d’idempotence, mais la réponse peut être perdue juste après la réussite du paiement. Comment éviter une double facturation si SQS relivre la même commande ?',
      correct:
        'Lors d’un déploiement roulant ECS, quelle configuration détecte un échec de démarrage et revient automatiquement au dernier déploiement terminé ?',
      token: 'ECS',
    },
    {
      source:
        'Kinesis Data Streamsで、今後は新規コンシューマーが直近7日分を読み直せるようにしたい。必要なデータが期限切れになる前に、ストリーム側で準備する設定は？',
      misplaced:
        'Dans Athena, il faut agréger certaines colonnes des journaux quotidiens correspondant à une date donnée. Quelle configuration réduit le volume de données analysées, à la fois selon la date et selon les colonnes ?',
      correct:
        'Avec Kinesis Data Streams, quel paramètre faut-il préparer avant l’expiration des données pour que les nouveaux consommateurs puissent relire les 7 derniers jours ?',
      token: 'Kinesis Data Streams',
    },
  ];
  for (const { source, misplaced, correct, token } of cases) {
    expect(() => validateTranslation(source, misplaced, 'fr', 'assessment.prompt')).toThrow(
      `technical token lost: ${token}`,
    );
    expect(() => validateTranslation(source, correct, 'fr', 'assessment.prompt')).not.toThrow();
  }
});

test('ETL glossary definitions cannot be replaced with a streaming service definition', () => {
  const source =
    'データの検出、カタログ化、変換などを行うデータ統合サービス。ETLジョブで複数のデータソースを分析に使いやすい形式へ加工する。';
  expect(() =>
    validateTranslation(
      source,
      'Serviço que ingere dados gerados continuamente como um fluxo, permitindo que várias aplicações os processem. É usado para processar logs, eventos e outros dados com baixa latência.',
      'pt',
      'glossary.Glue',
    ),
  ).toThrow('technical token lost: ETL');
  expect(() =>
    validateTranslation(
      source,
      'O AWS Glue descobre, cataloga e transforma dados para integração. Trabalhos de ETL podem combinar dados de várias fontes e prepará-los em um formato adequado para análise.',
      'pt',
      'glossary.Glue',
    ),
  ).not.toThrow();
});
