import { expect, test } from 'bun:test';
import { validateTranslation } from './content-translation-validation';
import { changedTranslationNumbers } from './translation-numbers';

test('content lint rejects changed explicit durations and storage limits', () => {
  expect(() =>
    validateTranslation(
      'アップロードの有効期間は10分。',
      'The upload expires after 15 minutes.',
      'en',
      'upload.prompt',
      'prompt',
    ),
  ).toThrow('numeric quantity changed');
  expect(() =>
    validateTranslation('記憶域は108GiB。', 'Storage is 180 GiB.', 'en', 'storage.prompt', 'prompt'),
  ).toThrow('numeric quantity changed');
});
test('quantity lint accepts native decimal separators, byte aliases and equivalent units', () => {
  for (const [source, translated, locale] of [
    ['可用性は99.99%。容量は1,024GiB。', 'Disponibilité : 99,99 %. Capacité : 1 024 Gio.', 'fr'],
    ['所要時間は60分。', 'It takes 1 hour.', 'en'],
    ['容量は1GB。', 'Capacity is 1 000 000 000 octets.', 'fr'],
    ['Linux 1.3.0で108GiBを設定。', 'Unter Linux 1.3.0 108 GiB konfigurieren.', 'de'],
  ] as const)
    expect(changedTranslationNumbers(source, translated, locale)).toEqual([]);
});
test('quantity lint leaves written numerals, scale words and clock formatting to semantic review', () => {
  expect(changedTranslationNumbers('1件を選ぶ。', 'Choose one item.', 'en')).toEqual([]);
  expect(changedTranslationNumbers('8億個を複製する。', 'Replicate 800 million objects.', 'en')).toEqual(
    [],
  );
  expect(
    changedTranslationNumbers(
      '8時30分に開始し19時に停止する。',
      'Start at 8:30 a.m. and stop at 7 p.m.',
      'en',
    ),
  ).toEqual([]);
});
test('quantity lint recognizes localized time units across every target locale', () => {
  const translations = {
    ja: '15分',
    en: '15 minutes',
    'zh-CN': '15分钟',
    'zh-TW': '15分鐘',
    ko: '15분',
    pt: '15 minutos',
    fr: '15 minutes',
    de: '15 Minuten',
    es: '15 minutos',
    it: '15 minuti',
  };
  for (const [locale, translated] of Object.entries(translations)) {
    expect(changedTranslationNumbers('10分', translated, locale as keyof typeof translations)).toEqual([
      'seconds:600',
    ]);
  }
});
test('fraction notation is not interpreted as a duration while actual minutes remain checked', () => {
  expect(changedTranslationNumbers('4分の1だけを東京へ流す。', 'Send 25% to Tokyo.', 'en')).toEqual([]);
  expect(
    changedTranslationNumbers('4分の1秒で応答する。', 'Respond in 250 milliseconds.', 'en'),
  ).toEqual([]);
  expect(changedTranslationNumbers('1/4時間で完了する。', 'Complete in 15 minutes.', 'en')).toEqual([]);
  expect(changedTranslationNumbers('4分の処理時間が必要。', 'It takes 5 minutes.', 'en')).toEqual([
    'seconds:240',
  ]);
});
test('compares explicit quantities independently by dimension for mixed percent and duration text', () => {
  const translations = {
    ja: '月末2日間に判定の8割が発生。',
    en: '80% of decisions occur during the final two days.',
    'zh-CN': '判定中有80%发生在月底最后两天。',
    'zh-TW': '判定中有80%發生在月底最後兩天。',
    ko: '판정의 80%가 월말 이틀 동안 발생합니다.',
    pt: '80% das decisões ocorrem nos dois últimos dias do mês.',
    fr: '80 % des décisions surviennent au cours des deux derniers jours du mois.',
    de: '80 % der Entscheidungen fallen in die letzten beiden Tage des Monats.',
    es: 'El 80 % de las decisiones se produce durante los dos últimos días del mes.',
    it: "L'80% delle decisioni si verifica negli ultimi due giorni del mese.",
  };
  for (const [locale, translated] of Object.entries(translations)) {
    expect(
      changedTranslationNumbers(translations.ja, translated, locale as keyof typeof translations),
    ).toEqual([]);
  }
});
test('rejects explicit changes within a dimension while ignoring written numerals in another dimension', () => {
  expect(
    changedTranslationNumbers(
      '月末2日間に判定の8割が発生。',
      '90% of decisions occur during the final two days.',
      'en',
    ),
  ).toEqual(['percent:80']);
  expect(
    changedTranslationNumbers(
      '月末2日間に判定の8割が発生。',
      '80% of decisions occur during the final 3 days.',
      'en',
    ),
  ).toEqual(['seconds:172800']);
  expect(
    changedTranslationNumbers(
      '判定の8割と10分の処理時間。',
      'eighty percent of decisions and 15 minutes of processing time.',
      'en',
    ),
  ).toEqual(['seconds:600']);
});
test('normalizes Japanese percentage scale words without hiding explicit changes', () => {
  expect([
    changedTranslationNumbers('80%', '8割', 'ja'),
    changedTranslationNumbers('9割', '80%', 'en'),
    changedTranslationNumbers('容量は1GB、割合は80%。', '2 GB and eighty percent.', 'en'),
    changedTranslationNumbers('1GBと2GBを保存する。', 'Store 1 GB and 1 GB.', 'en'),
    changedTranslationNumbers('1GBと1GBを保存する。', 'Store 1 GB and 2 GB.', 'en'),
    changedTranslationNumbers('1GBと1GBを保存する。', 'Store 1000 MB and 1000 MB.', 'en'),
    changedTranslationNumbers('10分と10分かかる。', 'It takes 600 seconds and 600 seconds.', 'en'),
  ]).toEqual([
    [],
    ['percent:90'],
    ['bytes:1000000000'],
    ['bytes:2000000000'],
    ['bytes:1000000000'],
    [],
    [],
  ]);
});
test('German RDS monitoring retains an explicit one-second interval', () => {
  expect(() =>
    validateTranslation(
      'RDS拡張モニタリングを1秒間隔にする。',
      'RDS Enhanced Monitoring auf ein Sekundenintervall einstellen.',
      'de',
      'choice.text',
      'text',
    ),
  ).toThrow('one-second interval terminology');
  expect(() =>
    validateTranslation(
      'RDS拡張モニタリングを1秒間隔にする。',
      'RDS Enhanced Monitoring im Abstand von 1 Sekunde konfigurieren.',
      'de',
      'choice.text',
      'text',
    ),
  ).not.toThrow();
});
