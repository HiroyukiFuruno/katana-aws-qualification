import { createContext, useContext } from 'react';
import { defaultSitePreferences, type SitePreferences } from './repository';

export type SitePreferenceNotice =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'load-error'
  | 'save-error'
  | 'conflict';

export type SitePreferenceContext = {
  kind: 'guest' | 'member' | 'pending';
  values: SitePreferences;
  disabled: boolean;
  loading: boolean;
  notice: SitePreferenceNotice;
  reload(): void;
  save(values: SitePreferences): void;
};

// 公開用の静的描画と認証を使わない部品では、従来の端末設定だけを使う。
export const SitePreferenceContext = createContext<SitePreferenceContext>({
  kind: 'guest',
  values: defaultSitePreferences,
  disabled: false,
  loading: false,
  notice: 'idle',
  reload() {},
  save() {},
});

export const useSitePreferences = () => useContext(SitePreferenceContext);
