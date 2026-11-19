import type { Locale } from './locales.ts';
import de from './locales/de.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };
import es from './locales/es.json' with { type: 'json' };
import fr from './locales/fr.json' with { type: 'json' };
import it from './locales/it.json' with { type: 'json' };
import ja from './locales/ja.json' with { type: 'json' };
import ko from './locales/ko.json' with { type: 'json' };
import pt from './locales/pt.json' with { type: 'json' };
import zhCN from './locales/zh-CN.json' with { type: 'json' };
import zhTW from './locales/zh-TW.json' with { type: 'json' };

export type Message = keyof typeof ja;

export const messages = {
  en,
  ja,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ko,
  pt,
  fr,
  de,
  es,
  it,
} satisfies Record<Locale, Record<Message, string>>;
