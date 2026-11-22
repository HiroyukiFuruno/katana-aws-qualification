import { expect, test } from 'bun:test';
import { type Locale, locales } from '../src/locales';
import { assertNativeLanguage } from './content-language-issues';

const examples: Record<Exclude<Locale, 'ja'>, [string, string]> = {
  en: [
    'Send one-quarter of new connections normally directed to Tokyo away from Tokyo.',
    'Keep only one-quarter of the new connections going to Tokyo.',
  ],
  'zh-CN': ['将四分之一从东京转移出去。', '仅将四分之一的新连接发往东京。'],
  'zh-TW': ['將四分之一移出東京。', '只將四分之一的新連線導向東京。'],
  ko: ['4분의 1만 다른 곳으로 보냅니다.', '4분의 1만 도쿄로 보냅니다.'],
  pt: ['Desviar de Tóquio cerca de um quarto.', 'Manter apenas um quarto das conexões em Tóquio.'],
  fr: ['Détourner de Tokyo environ un quart.', 'Ne conserver vers Tokyo qu’un quart des connexions.'],
  de: ['Ein Viertel soll davon umgeleitet werden.', 'Nur ein Viertel soll weiterhin nach Tokio gehen.'],
  es: ['Desviar de Tokio aproximadamente una cuarta parte.', 'Enviar solo una cuarta parte a Tokio.'],
  it: ['Deviare da Tokyo circa un quarto.', 'Inviare solo un quarto delle connessioni a Tokyo.'],
};

test('all nine locales retain the fraction sent to the destination instead of reversing its direction', () => {
  const source = 'Global Acceleratorで、約4分の1だけを東京へ流す。';
  for (const locale of locales.filter((value) => value !== 'ja')) {
    const [reversed, retained] = examples[locale];
    expect(() => assertNativeLanguage(source, reversed, locale, 'prompt')).toThrow(
      'traffic fraction direction',
    );
    expect(() => assertNativeLanguage(source, retained, locale, 'prompt')).not.toThrow();
    expect(() =>
      assertNativeLanguage('Global Acceleratorで4分の1を東京から退避する。', reversed, locale, 'prompt'),
    ).not.toThrow();
  }
});
