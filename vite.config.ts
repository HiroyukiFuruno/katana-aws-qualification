import { readFileSync } from 'node:fs';
import { defineConfig, type HtmlTagDescriptor, loadEnv } from 'vite';
import { catalogStats } from './scripts/catalog-stats.ts';
import { certifications, studyCourses } from './src/certifications.ts';
import { messages } from './src/messages.ts';
import { pageTitle } from './src/pageTitles.ts';
import { routeAt } from './src/routes.ts';

export default defineConfig(({ command, isPreview, mode }) => {
  const env = loadEnv(mode, process.cwd());
  const { questions } = catalogStats(studyCourses, (path) =>
    JSON.parse(readFileSync(`public/${path}`, 'utf8')),
  );
  const certificationCount = certifications.filter(({ course }) => course).length;
  return {
    appType: command === 'serve' && !isPreview ? 'spa' : 'mpa',
    define: {
      __KAQ_CATALOG_STATS__: JSON.stringify({ certifications: certificationCount, questions }),
    },
    plugins: [
      {
        name: 'localized-document-metadata',
        transformIndexHtml(html, context) {
          const route = routeAt((context.originalUrl ?? '/').split('?')[0]);
          const locale = route?.locale ?? 'en';
          const id = route?.page.split('/')[1];
          const name = certifications.find((cert) => cert.id === id)?.name;
          const escapeMetadata = (text: string) =>
            text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
          return html
            .replace('__PAGE_TITLE__', escapeMetadata(pageTitle(route?.page ?? '', locale, name)))
            .replace('__PAGE_DESCRIPTION__', escapeMetadata(messages[locale].landingIntro));
        },
      },
      {
        name: 'google-site-integrations',
        transformIndexHtml() {
          const tags: HtmlTagDescriptor[] = [];
          const token = env.VITE_GOOGLE_SITE_VERIFICATION;
          if (token) {
            if (!/^[\w-]+$/.test(token))
              throw new Error('Invalid Google Search Console verification token');
            tags.push({ tag: 'meta', attrs: { name: 'google-site-verification', content: token } });
          }
          return tags;
        },
      },
    ],
  };
});
