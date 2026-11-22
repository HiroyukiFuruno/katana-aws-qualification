import { type Locale, locales } from '../locales';
import type { ProgressRpcClient } from '../progress/types';

export type SitePreferences = { locale: Locale | null; theme: 'light' | 'dark' | null };
export type SitePreferencesSnapshot = SitePreferences & { generation: number; revision: number };
export const defaultSitePreferences: SitePreferences = { locale: null, theme: null };

function counter(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('Invalid preference revision.');
  return value;
}

function snapshot(value: unknown, generation: number): SitePreferencesSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid site preferences.');
  const item = value as Record<string, unknown>;
  const locale = item.locale === null ? null : locales.find((entry) => entry === item.locale);
  if (
    Object.keys(item).sort().join(',') !== 'locale,revision,theme' ||
    locale === undefined ||
    (item.theme !== null && item.theme !== 'light' && item.theme !== 'dark')
  )
    throw new Error('Invalid site preferences.');
  return { locale, theme: item.theme, revision: counter(item.revision), generation };
}

export function createSitePreferencesRepository(client: ProgressRpcClient) {
  return {
    async load() {
      const generation = counter(await client.rpc<unknown>('initialize_learning_state', {}));
      return snapshot(
        await client.rpc<unknown>('load_site_preferences', { p_expected_generation: generation }),
        generation,
      );
    },
    async save(values: SitePreferences, previous: SitePreferencesSnapshot) {
      const saved = snapshot(
        await client.rpc<unknown>('save_site_preferences', {
          p_locale: values.locale,
          p_theme: values.theme,
          p_expected_revision: counter(previous.revision),
          p_expected_generation: counter(previous.generation),
        }),
        previous.generation,
      );
      if (
        saved.locale !== values.locale ||
        saved.theme !== values.theme ||
        saved.revision < previous.revision
      )
        throw new Error('Site preference acknowledgement differs.');
      return saved;
    },
  };
}
