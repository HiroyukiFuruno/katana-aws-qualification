import { localePath } from './locales';
import { usePreferences } from './preferences';

const items = [
  {
    question: 'commuteStudyQuestion',
    answer: 'commuteStudyAnswer',
    action: 'learnFromQuestions',
    page: 'study/questions',
  },
  { question: 'guestAccountQuestion', answer: 'guestAccountAnswer' },
  { question: 'accountPricingQuestion', answer: 'accountPricingAnswer' },
] as const;

export function Faq() {
  const { locale, t } = usePreferences();
  return (
    <section className="shell landing-faq" aria-labelledby="landing-faq-title">
      <h2 id="landing-faq-title">{t('landingFaq')}</h2>
      <div className="landing-faq-list">
        {items.map((item) => (
          <details className="landing-faq-item" key={item.question}>
            <summary>{t(item.question)}</summary>
            <div className="landing-faq-answer">
              <p>{t(item.answer)}</p>
              {'action' in item && <a href={localePath(locale, item.page)}>{t(item.action)}</a>}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
