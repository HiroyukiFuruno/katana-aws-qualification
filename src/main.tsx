import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AnalyticsSettings, initializeAnalytics } from './AnalyticsSettings';
import { AccountPages } from './auth/AccountPages';
import { AccountPrivacy } from './auth/AccountPrivacy';
import { AuthCallback } from './auth/AuthCallback';
import { AuthProvider, useAccount } from './auth/AuthContext';
import { dashboardPath } from './auth/navigation';
import { CertificationPages } from './CertificationPages';
import { CourseApp } from './CourseApp';
import { certifications } from './certifications';
import { FundamentalsPage } from './fundamentals/FundamentalsPage';
import { GlossaryPage } from './GlossaryPage';
import { localePath } from './locales';
import { PreferencesProvider, usePreferences } from './preferences';
import { Roadmap } from './Roadmap';
import { accountPages, routeAt } from './routes';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { Home, NotFound, StudyDirectory, StudyPaths } from './SitePages';
import './style.css';

function App() {
  const { t, locale } = usePreferences();
  const route = routeAt(location.pathname);
  const { state } = useAccount();
  useEffect(() => {
    if (!route || accountPages.includes(route.page)) return;
    initializeAnalytics();
  }, [route]);
  useEffect(() => {
    if (route?.page === '' && state.status === 'ready' && state.account) {
      location.replace(dashboardPath(locale));
    }
  }, [route, state, locale]);
  if (!route) return <NotFound />;
  const [section, courseId] = route.page.split('/');
  const selected = section === 'study' ? certifications.find((cert) => cert.id === courseId) : undefined;

  return (
    <>
      <SiteHeader section={section} subpage={courseId} />
      {section === 'auth' ? (
        <AuthCallback />
      ) : section === 'login' || section === 'dashboard' ? (
        <AccountPages page={section} />
      ) : selected?.course ? (
        <CourseApp key={selected.id} id={selected.id} name={selected.name} course={selected.course} />
      ) : section === 'study' && courseId === 'questions' ? (
        <StudyDirectory />
      ) : section === 'study' && courseId === 'fundamentals' ? (
        <FundamentalsPage />
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
          <AccountPrivacy />
        </main>
      ) : section === 'assessment' ? (
        <main className="shell" id="main">
          <div className="intro">
            <h1>{t('skillsAssessment')}</h1>
            <p>{t('roadmapIntro')}</p>
          </div>
          <Roadmap onStudy={(id) => location.assign(localePath(locale, `study/${id}`))} />
        </main>
      ) : (
        <Home />
      )}
      <SiteFooter />
    </>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Application root missing');
createRoot(root).render(
  <PreferencesProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </PreferencesProvider>,
);
