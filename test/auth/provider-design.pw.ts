import { expect, test } from '@playwright/test';
import { localePath, locales } from '../../src/locales';
import { authOrigin } from './settings';

function contrast(foreground: string, background: string) {
  const channels = (value: string) => value.match(/\d+/g)?.map(Number) ?? [];
  const luminance = (value: string) =>
    channels(value)
      .map((channel) => channel / 255)
      .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
      .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const [first, second] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (first + 0.05) / (second + 0.05);
}

test('provider buttons load official marks with accessible branded styles', async ({ page }) => {
  await page.goto('/ja/login/');
  const buttons = page.locator('.account-provider-button');
  await expect(page.locator('.account-provider-button[data-provider="github"]')).toHaveCount(1);
  await expect(page.locator('.account-provider-button[data-provider="google"]')).toHaveCount(1);
  expect(
    await page
      .locator('.account-providers')
      .evaluate((element) => parseFloat(getComputedStyle(element).rowGap)),
  ).toBeGreaterThanOrEqual(8);
  for (const button of await buttons.all()) {
    const provider = await button.getAttribute('data-provider');
    const icon = button.locator('img');
    if (['github', 'google', 'microsoft', 'facebook'].includes(provider ?? '')) {
      await expect(icon).toHaveAttribute('aria-hidden', 'true');
      await expect(icon).toHaveJSProperty('complete', true);
      expect(await icon.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    } else {
      await expect(button.locator('.account-provider-icon-fallback')).toBeVisible();
    }
    const metrics = await button.evaluate((element) => {
      const label = element.querySelector<HTMLElement>('.account-provider-label');
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        color: style.color,
        height: element.getBoundingClientRect().height,
        overflow: label?.scrollWidth === label?.clientWidth,
      };
    });
    expect(metrics.height).toBeGreaterThanOrEqual(48);
    expect(metrics.overflow).toBe(true);
    expect(contrast(metrics.color, metrics.background)).toBeGreaterThanOrEqual(4.5);
  }
  await expect(page.locator('.account-provider-button[data-provider="github"]')).toHaveCSS(
    'background-color',
    'rgb(36, 41, 47)',
  );
  await expect(page.locator('.account-provider-button[data-provider="google"]')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  );
});

test('GitHub button starts the configured OAuth authorization request', async ({ page }) => {
  await page.goto('/ja/login/');
  const requestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.origin === authOrigin && url.pathname === '/auth/v1/authorize';
  });
  await page.getByRole('button', { name: 'GitHubでログイン' }).click();
  const request = await requestPromise;
  const target = new URL(request.url());
  expect(target.searchParams.get('provider')).toBe('github');
  expect(target.searchParams.get('code_challenge_method')).toBe('s256');
  expect(target.searchParams.get('code_challenge')).toBeTruthy();
});

for (const width of [320, 390, 768, 1280]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`provider labels and focus fit ${width}px in ${colorScheme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme });
      for (const locale of locales) {
        await page.goto(localePath(locale, 'login'));
        const button = page.locator('.account-provider-button').first();
        await button.focus();
        await expect(button).toBeFocused();
        await expect(button).toHaveCSS('outline-style', 'solid');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        for (const candidate of await page.locator('.account-provider-button').all()) {
          const box = await candidate.boundingBox();
          expect(box?.height).toBeGreaterThanOrEqual(48);
          expect(box?.x).toBeGreaterThanOrEqual(0);
          expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
          await expect(candidate.locator('.account-provider-label')).toHaveCSS(
            'overflow-wrap',
            'anywhere',
          );
          expect(
            await candidate
              .locator('.account-provider-label')
              .evaluate((element) => element.scrollWidth <= element.clientWidth),
          ).toBe(true);
        }
      }
    });
  }
}
