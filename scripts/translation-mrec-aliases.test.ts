import { expect, test } from 'bun:test';
import type { Locale } from '../src/locales';
import { assertNativeLanguage } from './content-language-issues';

type AliasCase = {
  path: string;
  id: string;
  locale: Locale;
  binding: string;
  source: string;
  translated: string;
};

const auditCases: AliasCase[] = [
  {
    path: 'courses/saa-c03/mock-questions-v1.json',
    id: 'mock-resilience-11',
    locale: 'de',
    binding: 'choices[0].text',
    source: 'DynamoDBグローバルテーブルをマルチリージョン結果整合性で構成する',
    translated:
      'Konfigurieren Sie eine DynamoDB-Globale Tabelle mit eventual consistency über mehrere Regionen',
  },
  {
    path: 'courses/saa-c03/mock-questions-v1.json',
    id: 'mock-resilience-11',
    locale: 'es',
    binding: 'choices[0].text',
    source: 'DynamoDBグローバルテーブルをマルチリージョン結果整合性で構成する',
    translated: 'Configure una tabla global de DynamoDB con consistencia final multirregional',
  },
  {
    path: 'courses/saa-c03/mock-questions.json',
    id: 'mock-resilience-11',
    locale: 'ko',
    binding: 'choices[2].text',
    source: 'DynamoDBグローバルテーブルをマルチリージョン結果整合性で構成する',
    translated: 'DynamoDB 글로벌 테이블을 다중 리전 최종적 일관성으로 구성합니다.',
  },
  {
    path: 'courses/saa-c03/mock-questions.json',
    id: 'mock-resilience-11',
    locale: 'de',
    binding: 'choices[2].text',
    source: 'DynamoDBグローバルテーブルをマルチリージョン結果整合性で構成する',
    translated: 'Eine DynamoDB-Globale Tabelle für Multi-Region Eventual Consistency konfigurieren',
  },
  {
    path: 'courses/saa-c03/mock-questions.json',
    id: 'mock-resilience-11',
    locale: 'it',
    binding: 'choices[2].text',
    source: 'DynamoDBグローバルテーブルをマルチリージョン結果整合性で構成する',
    translated: 'Configurare una tabella globale DynamoDB per la consistenza finale multiregionale',
  },
  {
    path: 'courses/dop-c02/full-mock-2026-11.json',
    id: 'dop-c02-d3-003',
    locale: 'de',
    binding: 'prompt',
    source:
      'DynamoDBのマルチリージョン結果整合性のグローバルテーブルを使用する。通常運用では同じ配送項目への別リージョンの更新が競合し、片方の変更が消えた。項目のスキーマを保ち、全リージョンから読める状態で、通常時の競合を構造的に防ぐにはどうするか。',
    translated:
      'Sie verwenden DynamoDB-Globale Tabellen mit Multi-Region Eventual Consistency. Im Normalbetrieb geraten Aktualisierungen desselben Lieferungselements aus verschiedenen Regionen in Konflikt, wodurch eine Änderung verloren geht. Wie können Sie Konflikte im Normalbetrieb strukturell verhindern, dabei das Elementschema beibehalten und Lesezugriffe aus allen Regionen ermöglichen?',
  },
  {
    path: 'courses/dop-c02/full-mock-2026-11.json',
    id: 'dop-c02-d3-003',
    locale: 'it',
    binding: 'prompt',
    source:
      'DynamoDBのマルチリージョン結果整合性のグローバルテーブルを使用する。通常運用では同じ配送項目への別リージョンの更新が競合し、片方の変更が消えた。項目のスキーマを保ち、全リージョンから読める状態で、通常時の競合を構造的に防ぐにはどうするか。',
    translated:
      "Usi le tabelle globali DynamoDB con coerenza finale multi-regione. Durante il normale funzionamento, gli aggiornamenti dello stesso elemento di consegna provenienti da regioni diverse entrano in conflitto e una modifica va persa. Come puoi prevenire strutturalmente questi conflitti durante il normale funzionamento, mantenendo lo schema dell'elemento e consentendo la lettura da tutte le regioni?",
  },
];

test('actual audit bindings accept official MREC aliases and technical English names', () => {
  for (const item of auditCases)
    expect(() =>
      assertNativeLanguage(
        item.source,
        item.translated,
        item.locale,
        `${item.path}/${item.id}/${item.binding}`,
      ),
    ).not.toThrow();
});
