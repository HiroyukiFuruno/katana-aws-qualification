import { useState } from 'react';
import { appliedDirectory, appliedIndexPage } from './applied/routes';
import { AccountNavigation, useHomePath } from './auth/AccountNavigation';
import { ImageSlot } from './images/ImageSlot';
import { localePath } from './locales';
import { SiteControls, usePreferences } from './preferences';
import { useDismissiblePopover } from './useDismissiblePopover';

function StudyNavigation({ active, subpage }: { active: boolean; subpage?: string }) {
  const { locale, t } = usePreferences();
  const [open, setOpen] = useState(false);
  const { group, button } = useDismissiblePopover(open, setOpen);
  const currentQuestions =
    subpage === 'questions'
      ? 'page'
      : subpage && subpage !== 'fundamentals' && subpage !== 'applied'
        ? 'location'
        : undefined;

  return (
    <div className="study-navigation" ref={group}>
      <button
        aria-controls="study-navigation-links"
        aria-expanded={open}
        className="study-navigation-toggle"
        data-current={active || undefined}
        onClick={() => setOpen(!open)}
        ref={button}
        type="button"
      >
        {t(locale === 'ja' ? 'studyTab' : 'study')}
      </button>
      <ul className="study-navigation-links" hidden={!open} id="study-navigation-links">
        <li>
          <a
            href={localePath(locale, 'study')}
            aria-current={active && !subpage ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            {t('study')}
          </a>
        </li>
        <li>
          <a
            href={localePath(locale, 'study/fundamentals')}
            aria-current={subpage === 'fundamentals' ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            {t('learnFundamentals')}
          </a>
        </li>
        <li>
          <a
            href={localePath(locale, appliedIndexPage)}
            aria-current={subpage === 'applied' ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            {appliedDirectory(locale).title}
          </a>
        </li>
        <li>
          <a
            href={localePath(locale, 'study/questions')}
            aria-current={currentQuestions}
            onClick={() => setOpen(false)}
          >
            {t('learnFromQuestions')}
          </a>
        </li>
      </ul>
    </div>
  );
}

export function SiteHeader({ section, subpage }: { section: string; subpage?: string }) {
  const { locale, t } = usePreferences();
  const homePath = useHomePath();
  return (
    <header className="site-header">
      <a className="skip-link" href="#main">
        {t('skip')}
      </a>
      <div className="shell topbar">
        <a className="brand" href={homePath} aria-label={t('siteName')} translate="no">
          <ImageSlot id="site/header/logo" />
          <span className="brand-name">
            {t('brandName')} <span>{t('brandDescriptor')}</span>
          </span>
          <span className="brand-short" aria-hidden="true">
            {t('siteShortName')}
          </span>
        </a>
        <div className="account-controls">
          <SiteControls />
          <AccountNavigation />
        </div>
        <nav className="site-navigation" aria-label={t('navigation')}>
          <StudyNavigation
            active={section === 'study'}
            subpage={section === 'study' ? subpage : undefined}
          />
          <a
            href={localePath(locale, 'assessment')}
            aria-current={section === 'assessment' ? 'page' : undefined}
          >
            {t('skillsAssessmentNav')}
          </a>
          <a
            href={localePath(locale, 'certifications')}
            aria-current={section === 'certifications' ? 'location' : undefined}
          >
            {t('certGuides')}
          </a>
          <a
            href={localePath(locale, 'glossary')}
            aria-current={section === 'glossary' ? 'page' : undefined}
          >
            {t('glossary')}
          </a>
        </nav>
      </div>
    </header>
  );
}
