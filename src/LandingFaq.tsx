import { localePath } from './locales';
import { usePreferences } from './preferences';

const items = [
  { question: 'freeStudyQuestion', answer: 'freeStudyAnswer' },
  { question: 'guestStudyQuestion', answer: 'guestStudyAnswer' },
  {
    question: 'accountTradeoffsQuestion',
    answer: 'accountTradeoffsAnswer',
    link: { page: 'privacy', label: 'privacy' },
  },
  {
    question: 'commuteStudyQuestion',
    answer: 'commuteStudyAnswer',
    link: { page: 'study/questions', label: 'learnFromQuestions' },
  },
  { question: 'mockFormatQuestion', answer: 'mockFormatAnswer' },
  { question: 'answerExplanationsQuestion', answer: 'answerExplanationsAnswer' },
] as const;

export function LandingFaq() {
  const { locale, t } = usePreferences();
  return (
    <section className="landing-faq layout-stack" aria-labelledby="landing-faq-title">
      <h2 id="landing-faq-title">{t('landingFaq')}</h2>
      {items.map((item) => (
        <details className="disclosure" key={item.question} open={item.question === 'freeStudyQuestion'}>
          <summary>{t(item.question)}</summary>
          <div className="layout-stack disclosure-content">
            <p>{t(item.answer)}</p>
            {'link' in item && <a href={localePath(locale, item.link.page)}>{t(item.link.label)}</a>}
          </div>
        </details>
      ))}
    </section>
  );
}
