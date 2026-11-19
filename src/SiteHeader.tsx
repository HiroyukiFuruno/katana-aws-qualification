import { useEffect, useRef, useState } from 'react';
import { AccountNavigation, useHomePath } from './auth/AccountNavigation';
import { localePath } from './locales';
import { SiteControls, usePreferences } from './preferences';

function StudyNavigation({ active, subpage }: { active: boolean; subpage?: string }) {
  const { locale, t } = usePreferences();
  const [open, setOpen] = useState(false);
  const group = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeFromOutside(event: Event) {
      if (event.target instanceof Node && !group.current?.contains(event.target)) setOpen(false);
    }

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    }

    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('focusin', closeFromOutside);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('focusin', closeFromOutside);
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [open]);

  const currentQuestions =
    subpage === 'questions' ? 'page' : subpage && subpage !== 'fundamentals' ? 'location' : undefined;

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
            href={localePath(locale, 'study/fundamentals')}
            aria-current={subpage === 'fundamentals' ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            {t('learnFundamentals')}
            <small>{t('coursePending')}</small>
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
        <a className="brand" href={homePath}>
          <img src="/katana-icon-128.png" width="40" height="40" alt="" />
          <span className="brand-name">
            KatanA <span>AWS Qualification</span>
          </span>
        </a>
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
        <div className="account-controls">
          <AccountNavigation />
          <SiteControls />
        </div>
      </div>
    </header>
  );
}
