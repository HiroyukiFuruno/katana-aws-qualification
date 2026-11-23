import { describe, expect, test } from 'bun:test';
import { messages } from '../src/messages';
import { translationIssues } from './translation-quality';

const dictionary = {
  examFormatShort: 'Short',
  examFormatMedium: 'Medium',
  examFormatFull: 'Full',
  examFormatCustom: 'Custom',
  mockFormatAnswer: 'Choose Short, Medium, Full, or Custom.',
  accountBenefitFree: 'Free, with secure provider sign-in.',
};

describe('translation quality lint', () => {
  test('rejects copied English sentences while keeping official names and shared short words', () => {
    const source = { message: 'Reload your cloud schedule before editing again.' };
    expect(translationIssues('fr', { ...dictionary, ...source }, {}, source)).toContain(
      'fr.message: untranslated English sentence',
    );
    expect(translationIssues('en', { ...dictionary, ...source }, {}, source)).toEqual([]);
    const shared = {
      siteName: 'KatanA AWS Qualification',
      certSaaName: 'Solutions Architect – Associate',
      assessmentF2Option1: 'Compute Savings Plans',
      dashboardChartAxes: 'X: {x} · Y: {y}',
      date: 'Date',
    };
    expect(translationIssues('fr', { ...dictionary, ...shared }, {}, shared)).toEqual([]);
  });
  test('rejects the copied French milestone title label', () => {
    expect(
      translationIssues(
        'fr',
        { ...dictionary, milestoneTitleLabel: 'Name' },
        {},
        { milestoneTitleLabel: 'Name' },
      ),
    ).toContain('fr.milestoneTitleLabel: untranslated English label');
    expect(translationIssues('fr', { ...dictionary, date: 'Date' }, {}, { date: 'Date' })).toEqual([]);
    expect(
      translationIssues(
        'de',
        { ...dictionary, name: 'Name', title: 'API Name' },
        {},
        { name: 'Name', title: 'API Name' },
      ),
    ).toEqual([]);
    expect(
      translationIssues(
        'fr',
        { ...dictionary, milestoneTitleLabel: 'Nom' },
        {},
        { milestoneTitleLabel: 'Name' },
      ),
    ).toEqual([]);
  });
  test('applies shared native grammar checks to visible UI messages', () => {
    expect(
      translationIssues('de', { ...messages.de, question: 'An einen verfügbaren Agent weiterleiten.' }),
    ).toContain('de.question: German Agent declension');
    expect(
      translationIssues('fr', { ...messages.fr, question: 'Commencer la réhébergement.' }),
    ).toContain('fr.question: French rehosting agreement');
    expect(
      translationIssues(
        'pt',
        { ...messages.pt, question: 'Alterar a IOPS.' },
        { ...messages.ja, question: 'IOPSを変更する。' },
      ),
    ).toContain('pt.question: Portuguese IOPS agreement');
  });
  test('rejects date-only wording on a reset shared by all dashboard filters', () => {
    expect(
      translationIssues('en', {
        ...dictionary,
        dashboardInherit: 'Use dashboard date range',
      }),
    ).toContain('en.dashboardInherit: shared filter reset is incorrectly limited to dates');
    expect(
      translationIssues('en', {
        ...dictionary,
        dashboardInherit: 'Use dashboard filters',
        dashboardPeriod: 'Use dashboard date range',
      }),
    ).toEqual([]);
    for (const [locale, translated] of Object.entries(messages)) {
      expect(translationIssues(locale as keyof typeof messages, translated)).toEqual([]);
    }
  });
  test('accepts consistent terminology and valid placeholders', () => {
    expect(translationIssues('en', { ...dictionary, position: '{current} of {total}' })).toEqual([]);
  });
  test('detects untranslated text, corrupt characters and invalid placeholders', () => {
    const issues = translationIssues('en', {
      ...dictionary,
      mixed: 'Nextの問題',
      korean: '다음',
      corrupt: 'Bad\ufffd',
      placeholder: '{ total }',
    });
    expect(issues).toHaveLength(5);
  });
  test('detects inconsistent format names and added pricing guarantees', () => {
    expect(
      translationIssues('en', {
        ...dictionary,
        mockFormatAnswer: 'Choose a short exam.',
        accountBenefitFree: 'Free forever.',
      }),
    ).toHaveLength(4);
  });
  test('permits Japanese and Korean in their respective locales', () => {
    expect(translationIssues('ja', { ...dictionary, question: '問題を選ぶ' })).toEqual([]);
    expect(translationIssues('ko', { ...dictionary, question: '문제 선택' })).toEqual([]);
  });
});
