import { useState } from 'react';
import { useAccount } from '../auth/AuthContext.tsx';
import { type Locale, localePath } from '../locales';
import { appliedContentFor } from './cases.ts';
import { appliedCases, appliedDirectory, appliedSlideHref } from './routes.ts';
import { appliedSearchCopy, appliedServiceCopy, appliedServiceGroups } from './serviceCatalog';
import { appliedReflection, appliedSlideCopy } from './slideContent.ts';
import { appliedSlideKey, canStoreAppliedSlides, readAppliedSlide } from './slideRecord.ts';

const services = [...new Set(appliedServiceGroups.flatMap(({ products }) => products))];

export function AppliedDirectoryPage({ locale, interactive }: { locale: Locale; interactive: boolean }) {
  const directory = appliedDirectory(locale);
  const filter = appliedSearchCopy(locale);
  const [selected, setSelected] = useState<string | undefined>();
  const groups = selected
    ? appliedServiceGroups.filter(({ products }) => products.includes(selected))
    : appliedServiceGroups;
  const cases = new Map(appliedCases(locale).map((entry) => [entry.id, entry]));
  return (
    <main id="main" className="shell applied-case">
      <h1>{directory.title}</h1>
      <p>{directory.description}</p>
      <section className="applied-case-section" aria-labelledby="applied-services">
        <h2 id="applied-services">{filter.heading}</h2>
        <div className="applied-services">
          <button type="button" aria-pressed={!selected} onClick={() => setSelected(undefined)}>
            {filter.all}
          </button>
          {services.map((service) => (
            <button
              key={service}
              type="button"
              translate="no"
              aria-pressed={selected === service}
              onClick={() => setSelected(service)}
            >
              {service}
            </button>
          ))}
        </div>
      </section>
      {groups.map((group) => {
        const entry = cases.get(group.caseId);
        if (!entry) throw new Error(`Missing applied practice example: ${group.caseId}`);
        const copy = appliedServiceCopy(locale, group.id);
        return (
          <section className="applied-case-section" key={group.id} aria-labelledby={group.id}>
            <h2 id={group.id}>{copy.label}</h2>
            <p>{copy.purpose}</p>
            <p>{group.products.join(' · ')}</p>
            <div className="entry-grid study-paths">
              <article className="entry-card">
                <p className="eyebrow">{copy.examplesLabel}</p>
                <h3>
                  <a href={localePath(locale, entry.page)}>{entry.title}</a>
                </h3>
                <p>{entry.description}</p>
                {interactive ? (
                  <ResumableSlideLink
                    locale={locale}
                    caseId={entry.id}
                    href={appliedSlideHref(localePath(locale, entry.page))}
                  />
                ) : (
                  <a href={appliedSlideHref(localePath(locale, entry.page))}>
                    {appliedSlideCopy(locale).open}
                  </a>
                )}
              </article>
            </div>
          </section>
        );
      })}
    </main>
  );
}

function ResumableSlideLink({ locale, caseId, href }: { locale: Locale; caseId: string; href: string }) {
  const { state } = useAccount();
  const copy = appliedSlideCopy(locale);
  const lesson = appliedContentFor(locale, caseId);
  const steps = lesson.sections.map(({ id }) => id);
  const reflection = lesson.sections.find((section) => appliedReflection(caseId, section))?.id;
  const accountId = state.account?.id;
  const canRead =
    (state.status === 'ready' || state.status === 'unavailable') && canStoreAppliedSlides(accountId);
  const saved = readAppliedSlide(appliedSlideKey(caseId, accountId), steps, reflection, canRead);
  return <a href={href}>{saved.stepId !== steps[0] || saved.reflection ? copy.resume : copy.open}</a>;
}
