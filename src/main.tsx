import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AnalyticsSettings, initializeAnalytics } from './AnalyticsSettings';
import { analyticsAllowedForPath } from './analyticsNavigation';
import { AccountPages } from './auth/AccountPages';
import { AccountPrivacy } from './auth/AccountPrivacy';
import { AuthCallback } from './auth/AuthCallback';
import { AuthProvider, useAccount } from './auth/AuthContext';
import { dashboardPath } from './auth/navigation';
import { CertificationPages } from './CertificationPages';
import { CookieConsent, useCookieConsent } from './CookieConsent';
import { CourseApp } from './CourseApp';
import { studyCourses } from './certifications';
import { lessonRouteAt } from './fundamentals/delivery/navigation';
import { useLessonLocation } from './fundamentals/delivery/useLessonLocation';
import { LessonExperience } from './fundamentals/learner/LessonExperience';
import { GlossaryPage } from './GlossaryPage';
import { localePath } from './locales';
import { PreferencesProvider, usePreferences } from './preferences';
import { GuestStorageSettings, ProgressGate } from './progress/ProgressGate';
import { ProgressProvider } from './progress/ProgressProvider';
import { Roadmap } from './Roadmap';
import { routeAt } from './routes';
import { SiteAdLayout } from './SiteAd';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { Home, NotFound, StudyDirectory, StudyPaths } from './SitePages';
import './style.css';

function App() {
  const { t, locale } = usePreferences();
  const consent = useCookieConsent();
  const currentUrl = useLessonLocation();
  const route = routeAt(currentUrl.pathname);
  const lesson = lessonRouteAt(currentUrl.pathname, currentUrl.search);
  const { state } = useAccount();
  useEffect(() => {
    initializeAnalytics(analyticsAllowedForPath(currentUrl.pathname, consent.value === 'granted'));
  }, [currentUrl.pathname, consent]);
  useEffect(() => {
    const beforeNavigation = (event: Event) => {
      if (!(event instanceof CustomEvent) || typeof event.detail !== 'string') return;
      initializeAnalytics(
        analyticsAllowedForPath(
          new URL(event.detail, location.origin).pathname,
          consent.value === 'granted',
        ),
      );
    };
    const beforeHistory = () =>
      initializeAnalytics(analyticsAllowedForPath(location.pathname, consent.value === 'granted'));
    window.addEventListener('kaq:lesson-navigation', beforeNavigation);
    window.addEventListener('popstate', beforeHistory, true);
    return () => {
      window.removeEventListener('kaq:lesson-navigation', beforeNavigation);
      window.removeEventListener('popstate', beforeHistory, true);
    };
  }, [consent.value]);
  useEffect(() => {
    if (route?.page === '' && state.status === 'ready' && state.account) {
      location.replace(dashboardPath(locale));
    }
  }, [route, state, locale]);
  if (!route) return <NotFound />;
  const [section, courseId] = route.page.split('/');
  const selected = section === 'study' ? studyCourses.find((cert) => cert.id === courseId) : undefined;
  if (section === 'study' && courseId === 'fundamentals') {
    return (
      <>
        {!lesson && <SiteHeader section={section} subpage={courseId} />}
        <LessonExperience />
        {!lesson && <SiteFooter />}
        <CookieConsent />
      </>
    );
  }

  const contentAds =
    section === '' ||
    section === 'glossary' ||
    section === 'certifications' ||
    route.page === 'study' ||
    route.page === 'study/questions';

  return (
    <>
      <SiteHeader section={section} subpage={courseId} />
      <SiteAdLayout show={contentAds}>
        {section === 'auth' ? (
          <AuthCallback />
        ) : section === 'login' || section === 'dashboard' ? (
          <AccountPages page={section} />
        ) : selected?.course ? (
          <ProgressGate>
            <CourseApp
              key={selected.id}
              id={selected.id}
              name={selected.name}
              course={selected.course}
            />
          </ProgressGate>
        ) : section === 'study' && courseId === 'questions' ? (
          <StudyDirectory />
        ) : section === 'study' ? (
          <StudyPaths />
        ) : section === 'certifications' ? (
          <CertificationPages id={courseId} />
        ) : section === 'glossary' ? (
          <GlossaryPage />
        ) : section === 'privacy' ? (
          <main className="shell" id="main">
            <h1>{t('privacy')}</h1>
            <AnalyticsSettings />
            <GuestStorageSettings />
            <AccountPrivacy />
          </main>
        ) : section === 'assessment' ? (
          <ProgressGate>
            <Roadmap onStudy={(id) => location.assign(localePath(locale, `study/${id}`))} />
          </ProgressGate>
        ) : (
          <Home />
        )}
      </SiteAdLayout>
      <SiteFooter replaceAdOnMobile={contentAds} />
      <CookieConsent />
    </>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Application root missing');
createRoot(root).render(
  <PreferencesProvider>
    <AuthProvider>
      <ProgressProvider>
        <App />
      </ProgressProvider>
    </AuthProvider>
  </PreferencesProvider>,
);
