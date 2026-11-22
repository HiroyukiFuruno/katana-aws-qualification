import assert from 'node:assert/strict';
import type { Locale } from '../src/locales';
import { assertClassificationMetrics } from './translation-classification-metrics.ts';
import { assertLowRankLanguage } from './translation-low-rank-language.ts';
import { assertNewUrlCondition } from './translation-new-url-condition.ts';
import { assertRoleLanguage } from './translation-role-language.ts';

const reversedTrafficFractions: Partial<Record<Locale, RegExp>> = {
  en: /(?:one[- ]quarter|a quarter)[^.]*Tokyo away from Tokyo/iu,
  'zh-CN': /四分之一\s*从东京转移出去/u,
  'zh-TW': /四分之一\s*移出東京/u,
  ko: /4분의\s*1만\s*다른\s*곳으로/u,
  pt: /desviar de Tóquio\s+(?:cerca de\s+)?um quarto/iu,
  fr: /détourner de Tokyo\s+(?:environ\s+)?un quart/iu,
  de: /ein Viertel[^.]*davon umgeleitet/iu,
  es: /desviar de Tokio\s+(?:aproximadamente\s+)?una cuarta parte/iu,
  it: /deviare da Tokyo\s+(?:circa\s+)?un quarto/iu,
};

export function assertNativeLanguage(
  source: string,
  translated: string,
  locale: Locale,
  context: string,
) {
  assertClassificationMetrics(source, translated, locale, context);
  assertLowRankLanguage(source, translated, locale, context);
  assertNewUrlCondition(source, translated, locale, context);
  assertRoleLanguage(source, translated, locale, context);
  if (locale === 'pt' && /\bIOPS\b/u.test(source))
    assert(
      !/(?<![\p{L}\p{N}_])(?:a|o|da|do|na|no|pela|pelo|à)\s+IOPS\b/iu.test(translated),
      `${context}: Portuguese IOPS agreement`,
    );
  if (
    locale === 'de' &&
    /RDS(?:拡張モニタリング| Enhanced Monitoring)/u.test(source) &&
    /1秒間隔/u.test(source)
  )
    assert(
      !/\bein Sekundenintervall\b/iu.test(translated),
      `${context}: one-second interval terminology`,
    );
  if (/Global Accelerator/u.test(source) && /(?:4分の1|25[%％])だけを東京へ/u.test(source))
    assert(
      !reversedTrafficFractions[locale]?.test(translated),
      `${context}: traffic fraction direction reversed`,
    );
  if (locale === 'es' && /Intelligent-Tiering/u.test(source) && /階層|\btiers?\b/iu.test(source))
    assert(
      !/\b(?:entre\s+clases|clases\s+de\s+archivado)\b/iu.test(translated),
      `${context}: access tier terminology`,
    );
  if (locale === 'zh-TW' && /CloudWatch/u.test(source) && /計装|instrumentation/iu.test(source))
    assert(!/儀器檢測/u.test(translated), `${context}: software instrumentation terminology`);
  if (/決済コールバック|payment callbacks?/iu.test(source)) {
    if (locale === 'fr')
      assert(!/\brappels?\s+de\s+paiement\b/iu.test(translated), `${context}: callback terminology`);
    if (locale === 'de')
      assert(!/Zahlungsrückrufe/iu.test(translated), `${context}: callback terminology`);
  }
  if (
    locale === 'en' &&
    /\b(?:EC2|Fargate)\b/u.test(source) &&
    /計算料金|コンピューティング(?:利用)?料金|compute\s+(?:charges|costs)/iu.test(source)
  )
    assert(
      !/\bcalculation\s+fees?\b/iu.test(translated),
      `${context}: English compute pricing terminology`,
    );
  if (locale === 'fr')
    assert(
      !/\btelles\s+quelles\s+les\s+messages\b/iu.test(translated),
      `${context}: French agreement mismatch for messages`,
    );
  if (locale === 'fr' && /ステートレス|\bstateless\b/iu.test(source))
    assert(!/\bapatrides?\b/iu.test(translated), `${context}: French stateless terminology`);
  if (locale === 'fr')
    assert(
      !/\bun\s+Items\s+vide\b/iu.test(translated),
      `${context}: French agreement mismatch for Items`,
    );
  if (locale === 'fr')
    assert(
      !/\b(?:la|une|cette)\s+r[eé]h[eé]bergements?\b/iu.test(translated.normalize('NFC')),
      `${context}: French rehosting agreement`,
    );
  if (locale === 'de')
    assert(
      !/\b(?:den|einen|einem|eines|zum|dem|des)(?:\s+(?:verfügbaren|eigenen))?\s+Agents?(?![\p{L}\p{N}_-]|\.[\p{L}\p{N}_])/iu.test(
        translated.normalize('NFC'),
      ),
      `${context}: German Agent declension`,
    );
  if (locale === 'it' && /モデル|\bmodel\b/iu.test(source) && /再訓練|再学習|\bretrain/iu.test(source))
    assert(!/\briqualific\p{L}*/iu.test(translated), `${context}: Italian model retraining terminology`);
  if (/\b(?:GSI|LSI)s?\b/u.test(source)) {
    if (locale === 'fr')
      assert(
        !/\b(?:une|la)\s+(?:GSI|LSI)\b|\bles\s+(?:GSI|LSI)s?\s+existantes\b/iu.test(translated),
        `${context}: French index agreement`,
      );
    if (locale === 'pt')
      assert(
        !/\b(?:umas?|das?|nas?|pelas?)\s+(?:GSI|LSI)s?\b|(?:^|[.!?]\s+)A\s+(?:GSI|LSI)s?\b/iu.test(
          translated,
        ),
        `${context}: Portuguese index agreement`,
      );
  }
  if (locale === 'en' && /キー以外へのアップロード|uploads?[^.]*keys other than/iu.test(source))
    assert(
      !/\busers (?:with|holding) (?:other|different) keys\b/iu.test(translated),
      `${context}: upload target key terminology`,
    );
}
