import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CertificationOverviewContent } from '../src/CertificationOverviewContent';
import type { SiteContent } from '../src/contentTypes';
import { localePath, locales } from '../src/locales';
import { messages } from '../src/messages';
import { pageTitle } from '../src/pageTitles';
import { routeAt } from '../src/routes';

const overviewKeys = [
  'certOverviewTitle',
  'certOverviewDescription',
  'certOverviewMeaningTitle',
  'certOverviewMeaning',
  'certOverviewChooseTitle',
  'certOverviewGoalHeader',
  'certOverviewCertificationHeader',
  'certOverviewCloudGoal',
  'certOverviewAiGoal',
  'certOverviewDesignGoal',
  'certOverviewOtherGoals',
  'certOverviewStartTitle',
  'certOverviewStartBody',
  'certOverviewOfficialLink',
] as const;

function escaped(value: string) {
  return renderToStaticMarkup(createElement(Fragment, null, value));
}

test('publishes a localized overview route and search title', () => {
  for (const locale of locales) {
    expect(routeAt(localePath(locale, 'certifications/overview'))).toEqual({
      locale,
      page: 'certifications/overview',
    });
    expect(pageTitle('certifications/overview', locale)).toBe(
      `${messages[locale].certOverviewSearchTitle} | ${messages[locale].siteName}`,
    );
  }
});

test('renders localized overview semantics and learning entrances for every locale', () => {
  for (const locale of locales) {
    const content = JSON.parse(
      readFileSync(`public/translations/${locale}/site.json`, 'utf8'),
    ) as SiteContent;
    const html = renderToStaticMarkup(
      createElement(CertificationOverviewContent, {
        locale,
        copy: messages[locale],
        certifications: content.certifications,
      }),
    );

    expect(html).toContain(`<h1>${escaped(messages[locale].certOverviewTitle)}</h1>`);
    for (const key of overviewKeys) expect(html).toContain(escaped(messages[locale][key]));
    for (const id of ['clf-c02', 'aif-c01', 'saa-c03']) {
      expect(html).toContain(escaped(content.certifications[id].name));
      expect(html).toContain(`href="${localePath(locale, `certifications/${id}`)}"`);
    }
    for (const page of ['certifications', 'study/fundamentals', 'study/questions'])
      expect(html).toContain(`href="${localePath(locale, page)}"`);
    expect(html).toContain('href="https://aws.amazon.com/certification/"');
  }
});

test('renders an optional client ad between choosing and starting sections', () => {
  const content = JSON.parse(readFileSync('public/translations/en/site.json', 'utf8')) as SiteContent;
  const html = renderToStaticMarkup(
    createElement(CertificationOverviewContent, {
      locale: 'en',
      copy: messages.en,
      certifications: content.certifications,
      ad: createElement('aside', { id: 'overview-ad' }, 'ad'),
    }),
  );
  const adPosition = html.indexOf('overview-ad');

  expect(adPosition).toBeGreaterThan(html.indexOf('overview-choice'));
  expect(adPosition).toBeLessThan(html.indexOf('overview-start'));
});
