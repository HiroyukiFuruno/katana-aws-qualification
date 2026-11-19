import { expect, test } from '@playwright/test';
import de from '../../src/locales/de.json' with { type: 'json' };
import en from '../../src/locales/en.json' with { type: 'json' };
import es from '../../src/locales/es.json' with { type: 'json' };
import fr from '../../src/locales/fr.json' with { type: 'json' };
import it from '../../src/locales/it.json' with { type: 'json' };
import ja from '../../src/locales/ja.json' with { type: 'json' };
import ko from '../../src/locales/ko.json' with { type: 'json' };
import pt from '../../src/locales/pt.json' with { type: 'json' };
import zhCN from '../../src/locales/zh-CN.json' with { type: 'json' };
import zhTW from '../../src/locales/zh-TW.json' with { type: 'json' };

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
