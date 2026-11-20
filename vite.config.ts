import { readFileSync } from 'node:fs';
import { defineConfig, type HtmlTagDescriptor, loadEnv } from 'vite';
import { catalogStats } from './scripts/catalog-stats.ts';
import { certifications, studyCourses } from './src/certifications.ts';

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
