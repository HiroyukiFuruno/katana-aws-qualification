import { expect, type Page, test } from '@playwright/test';
import { signIn } from './helpers';
import { visibleBounds } from './layout';
import { authOrigin, testKey } from './settings';

async function setProfileName(page: Page, fullName: string | null) {
  await page.evaluate(
    async ({ origin, key, fullName }) => {
      const { createAuthClient } = await import('/src/auth/client.ts');
      const { error } = await createAuthClient({ url: origin, key }).updateUser({
        data: { full_name: fullName },
      });
      if (error) throw error;
    },
    { origin: authOrigin, key: testKey('anon'), fullName },
  );
}

for (const width of [320, 390, 768, 1280]) {
  test(`real profile names do not move header regions at ${width}px`, async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width, height: 900 });
    const original = await page.evaluate(
      async ({ origin, key }) => {
        const { createAuthClient } = await import('/src/auth/client.ts');
        const { data, error } = await createAuthClient({ url: origin, key }).getUser();
        if (error || !data.user) throw error ?? new Error('Missing user');
        const name = data.user.user_metadata.full_name;
        return typeof name === 'string' ? name : null;
      },
      { origin: authOrigin, key: testKey('anon') },
    );
    const selectors = [
      'header .brand',
      '.site-navigation',
      '.account-controls',
      '.account-avatar-button',
    ];
    const baseline = await Promise.all(
      selectors.map((selector) => visibleBounds(page.locator(selector))),
    );
    try {
      for (const name of ['一', 'Alex Example', '長い表示名LongDisplayName'.repeat(16)]) {
        await setProfileName(page, name);
        await page.reload();
        await expect(page.locator('.account-avatar-label')).toHaveText(name);
        for (const [index, selector] of selectors.entries()) {
          const current = await visibleBounds(page.locator(selector));
          const previous = baseline[index];
          if (!previous) throw new Error(selector);
          for (const dimension of ['x', 'y', 'width', 'height'] as const) {
            expect(Math.abs(current[dimension] - previous[dimension])).toBeLessThan(1);
          }
        }
        await page.getByRole('button', { name: 'アカウントメニュー' }).click();
        await expect(page.locator('.account-menu-heading')).toHaveText(name);
        const menu = await visibleBounds(page.locator('#account-menu-links'));
        expect(menu.x).toBeGreaterThanOrEqual(0);
        expect(menu.x + menu.width).toBeLessThanOrEqual(width);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        await page.keyboard.press('Escape');
      }
    } finally {
      await setProfileName(page, original);
    }
  });
}
