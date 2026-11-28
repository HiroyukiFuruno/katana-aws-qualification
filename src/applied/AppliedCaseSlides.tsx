import { useMemo } from 'react';
import { useAccount } from '../auth/AuthContext';
import { LessonSlideShell } from '../fundamentals/learner/LessonSlideShell';
import { imageSlot } from '../images/catalog';
import { ImageSlot } from '../images/ImageSlot';
import { type Locale, localePath } from '../locales';
import { usePreferences } from '../preferences';
import { ProgressConsent } from '../progress/ProgressConsent';
import { AppliedReflectionSlide } from './AppliedReflectionSlide';
import { AppliedSectionContent } from './AppliedSectionContent';
import { appliedIndexPage, appliedSlideHref } from './routes';
import { appliedCaseShortTitle } from './serviceCatalog';
import { appliedReflection, appliedSlideCopy } from './slideContent';
import { appliedSlideKey } from './slideRecord';
import type { AppliedCaseContent } from './types';
import { useAppliedSlideRecord } from './useAppliedSlideRecord';

type SlideProps = {
  lesson: AppliedCaseContent;
  locale: Locale;
  articleHref: string;
  requestedStep?: string;
};

export function AppliedCaseSlides(props: SlideProps) {
  const { state } = useAccount();
  const { t } = usePreferences();
  if (state.status === 'error' || state.status === 'loading') {
    return (
      <main className="shell progress-status layout-stack" id="main">
        <p role={state.status === 'error' ? 'alert' : 'status'}>
          {t(state.status === 'error' ? 'progressAuthFailed' : 'progressAuthLoading')}
        </p>
        <a href={props.articleHref}>{appliedSlideCopy(props.locale).article}</a>
      </main>
    );
  }
  const accountId = state.account?.id;
  const storageKey = appliedSlideKey(props.lesson.id, accountId);
  return (
    <AppliedSlideSession {...props} accountId={accountId} storageKey={storageKey} key={storageKey} />
  );
}

function AppliedSlideSession({
  lesson,
  locale,
  articleHref,
  requestedStep,
  accountId,
  storageKey,
}: SlideProps & { accountId?: string; storageKey: string }) {
  const { t } = usePreferences();
  const copy = appliedSlideCopy(locale);
  const stepIds = useMemo(() => lesson.sections.map(({ id }) => id), [lesson.sections]);
  const reflectionStep = lesson.sections.find((section) => appliedReflection(lesson.id, section))?.id;
  const { record, apply, store, failed, consentChanged } = useAppliedSlideRecord(
    storageKey,
    stepIds,
    reflectionStep,
    accountId,
    requestedStep,
  );
  const position = stepIds.indexOf(record.stepId);
  const section = lesson.sections[position];
  const previous = stepIds[position - 1];
  const next = stepIds[position + 1];
  const reflection = appliedReflection(lesson.id, section);
  const reviewedAnswer = record.reflection?.stepId === section.id ? record.reflection.answer : undefined;
  const catalogHref = localePath(locale, appliedIndexPage);

  function leave() {
    location.assign(catalogHref);
  }

  function moveTo(stepId: string) {
    const url = new URL(location.href);
    if (url.searchParams.has('step')) {
      url.searchParams.delete('step');
      window.history.replaceState(window.history.state, '', url);
    }
    apply({ stepId });
  }

  function advance() {
    if (next) moveTo(next);
    else location.assign(articleHref);
  }

  return (
    <LessonSlideShell
      step={{
        id: section.id,
        kind: 'reading',
        label: section.title,
        position: position + 1,
        totalSteps: stepIds.length,
        remainingSteps: stepIds.length - position - 1,
      }}
      unitTitle={appliedCaseShortTitle(locale, lesson.id)}
      catalogHref={catalogHref}
      catalogLabel={copy.contents}
      previousHref={previous ? appliedSlideHref(articleHref, previous) : undefined}
      onPrevious={previous ? () => moveTo(previous) : undefined}
      onCatalog={leave}
      nextLabel={next ? undefined : copy.article}
      onNext={reflection && !reviewedAnswer ? undefined : advance}
      error={failed ? t('progressStorageFailed') : undefined}
      onRetry={() => store(record)}
    >
      <div className="applied-case applied-slide-body">
        <ImageSlot id={imageSlot('applied-slide', lesson.id, section.id)} locale={locale} />
        {reflection ? (
          <AppliedReflectionSlide
            key={section.id}
            {...reflection}
            copy={copy}
            reviewedAnswer={reviewedAnswer}
            onReview={(answer) => apply({ reflection: { stepId: section.id, answer } })}
          />
        ) : (
          <AppliedSectionContent lessonId={lesson.id} section={section} locale={locale} />
        )}
        <p className="muted">{copy.scope}</p>
        {!accountId && <ProgressConsent compact onChange={consentChanged} />}
      </div>
    </LessonSlideShell>
  );
}
