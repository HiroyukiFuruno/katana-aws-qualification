import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AnalyticsSettings, initializeAnalytics } from './AnalyticsSettings';
import { CertificationPages } from './CertificationPages';
import { certifications } from './certifications';
import { CourseApp } from './CourseApp';
import { GlossaryPage } from './GlossaryPage';
import { localePath } from './locales';
import { PreferencesProvider, usePreferences } from './preferences';
import { Roadmap } from './Roadmap';
import { routeAt } from './routes';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { FundamentalsPage, Home, NotFound, StudyDirectory, StudyPaths } from './SitePages';
import './style.css';

function App() {
  useEffect(initializeAnalytics, []);
  const { t, locale } = usePreferences();
  const route = routeAt(location.pathname);
  if (!route) return <NotFound />;
  const [section, courseId] = route.page.split('/');
  const selected = section === 'study' ? certifications.find((cert) => cert.id === courseId) : undefined;

  return (
    <>
      <SiteHeader section={section} subpage={courseId} />
      {selected?.course ? (
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
    <App />
  </PreferencesProvider>,
);
