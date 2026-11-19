import { expect, test } from '@playwright/test';
import de from '../../src/locales/de.json';
import en from '../../src/locales/en.json';
import es from '../../src/locales/es.json';
import fr from '../../src/locales/fr.json';
import it from '../../src/locales/it.json';
import ja from '../../src/locales/ja.json';
import ko from '../../src/locales/ko.json';
import pt from '../../src/locales/pt.json';
import zhCN from '../../src/locales/zh-CN.json';
import zhTW from '../../src/locales/zh-TW.json';

test('account deletion guidance is visible on the privacy page in every supported locale', async ({
  page,
}) => {
  for (const [locale, messages] of Object.entries({
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
  })) {
    await page.goto(locale === 'en' ? '/privacy/' : `/${locale}/privacy/`);
    await expect(page.getByText(messages.accountPrivacyDeletion, { exact: true })).toBeVisible();
  }
});
