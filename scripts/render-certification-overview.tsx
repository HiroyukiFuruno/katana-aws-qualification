import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CertificationOverviewContent,
  CertificationOverviewLink,
} from '../src/CertificationOverviewContent.tsx';
import type { SiteContent } from '../src/contentTypes.ts';
import { localePath, locales } from '../src/locales.ts';
import { messages } from '../src/messages.ts';

function withRootContent(html: string, content: string) {
  const root = '<div id="root"></div>';
  if (!html.includes(root)) throw new Error('Missing application root in rendered route.');
  return html.replace(root, `<div id="root">${content}</div>`);
}

async function localizedContent(locale: (typeof locales)[number]) {
  return JSON.parse(await readFile(`public/translations/${locale}/site.json`, 'utf8')) as SiteContent;
}

async function renderEntrance(locale: (typeof locales)[number], page: string) {
  const path = join('dist', localePath(locale, page), 'index.html');
  const html = await readFile(path, 'utf8');
  const entrance = renderToStaticMarkup(
    <main className="shell static-certification-overview-entrance">
      <CertificationOverviewLink locale={locale}>
        {messages[locale].certOverviewTitle}
      </CertificationOverviewLink>
    </main>,
  );
  await writeFile(path, withRootContent(html, entrance));
}

for (const locale of locales) {
  const content = await localizedContent(locale);
  const path = join('dist', localePath(locale, 'certifications/overview'), 'index.html');
  const html = await readFile(path, 'utf8');
  const overview = renderToStaticMarkup(
    <CertificationOverviewContent
      locale={locale}
      copy={messages[locale]}
      certifications={content.certifications}
    />,
  );
  await writeFile(path, withRootContent(html, overview));
  await renderEntrance(locale, '');
  await renderEntrance(locale, 'certifications');
}
