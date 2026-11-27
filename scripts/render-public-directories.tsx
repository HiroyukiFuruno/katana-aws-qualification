import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { certifications, studyCourses } from '../src/certifications.ts';
import type { SiteContent } from '../src/contentTypes.ts';
import type { DeliveryIndexAsset } from '../src/fundamentals/delivery/artifactTypes.ts';
import { localePath, locales } from '../src/locales.ts';
import { messages } from '../src/messages.ts';

async function insert(locale: (typeof locales)[number], page: string, content: string) {
  const path = join('dist', localePath(locale, page), 'index.html');
  const html = await readFile(path, 'utf8');
  const root = /<div id="root">(?:<main[\s\S]*?<\/main>)?<\/div>/;
  if (!root.test(html)) throw new Error(`Missing static root: ${locale}/${page}`);
  await writeFile(path, html.replace(root, `<div id="root">${content}</div>`));
}

for (const locale of locales) {
  const copy = messages[locale];
  const site = JSON.parse(
    await readFile(`public/translations/${locale}/site.json`, 'utf8'),
  ) as SiteContent;
  await insert(
    locale,
    'study',
    renderToStaticMarkup(
      <main id="main" className="shell">
        <h1>{copy.study}</h1>
        <p>{copy.studyPathsIntro}</p>
        <a href={localePath(locale, 'study/fundamentals')}>{copy.learnFundamentals}</a>
        <a href={localePath(locale, 'study/questions')}>{copy.learnFromQuestions}</a>
      </main>,
    ),
  );
  const indexPath =
    locale === 'ja'
      ? 'public/fundamentals/delivery/index.json'
      : `public/translations/${locale}/fundamentals/delivery/index.json`;
  const lessons = JSON.parse(await readFile(indexPath, 'utf8')) as DeliveryIndexAsset;
  await insert(
    locale,
    'study/fundamentals',
    renderToStaticMarkup(
      <main id="main" className="shell">
        <h1>{copy.learnFundamentals}</h1>
        <p>{copy.fundamentalsEntry}</p>
        <ul>
          {lessons.units
            .filter((unit) => unit.state === 'published')
            .map((unit) => (
              <li key={unit.unitId}>
                <a href={localePath(locale, `study/fundamentals/${unit.slug}`)}>{unit.title}</a>
                <p>{unit.objective}</p>
              </li>
            ))}
        </ul>
      </main>,
    ),
  );
  for (const [page, entries, title] of [
    ['certifications', certifications, copy.certGuides],
    ['study/questions', studyCourses, copy.learnFromQuestions],
  ] as const) {
    await insert(
      locale,
      page,
      renderToStaticMarkup(
        <main id="main" className="shell">
          <h1>{title}</h1>
          <a href={localePath(locale, 'certifications/overview')}>{copy.certOverviewTitle}</a>
          <ul>
            {entries.map((cert) => (
              <li key={cert.id}>
                <a
                  href={localePath(
                    locale,
                    `${page === 'certifications' ? 'certifications' : 'study'}/${cert.id}`,
                  )}
                >
                  {site.certifications[cert.id]?.name ?? cert.name} ({cert.id.toUpperCase()})
                </a>
              </li>
            ))}
          </ul>
        </main>,
      ),
    );
  }
  for (const cert of studyCourses) {
    const info = site.certifications[cert.id];
    if (!info) throw new Error(`Missing course content: ${locale}/${cert.id}`);
    await insert(
      locale,
      `study/${cert.id}`,
      renderToStaticMarkup(
        <main id="main" className="shell">
          <h1>
            {info.name} ({cert.id.toUpperCase()})
          </h1>
          <p>{info.focus}</p>
          <a href={localePath(locale, 'study/questions')}>{copy.learnFromQuestions}</a>
        </main>,
      ),
    );
  }
  for (const cert of certifications) {
    const guide = site.guides[cert.id];
    const info = site.certifications[cert.id];
    if (!guide || !info) throw new Error(`Missing certification content: ${locale}/${cert.id}`);
    await insert(
      locale,
      `certifications/${cert.id}`,
      renderToStaticMarkup(
        <main id="main" className="shell">
          <h1>
            {info.name} ({cert.id.toUpperCase()})
          </h1>
          <h2>{copy.certScope}</h2>
          <p>{guide.scope}</p>
          <h2>{copy.certDifficulty}</h2>
          <p>{guide.why}</p>
          <h2>{copy.certAudience}</h2>
          <p>{guide.audience}</p>
          <a href={localePath(locale, 'certifications')}>{copy.backCertGuides}</a>
          {cert.course && <a href={localePath(locale, `study/${cert.id}`)}>{copy.openCourse}</a>}
        </main>,
      ),
    );
  }
}
