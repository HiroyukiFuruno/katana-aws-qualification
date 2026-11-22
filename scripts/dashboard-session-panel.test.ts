import { expect, test } from 'bun:test';
import { aggregateDashboard } from '../src/dashboard/aggregate';
import { dashboardDefaults } from '../src/dashboard/preferences';
import { messages } from '../src/messages';
import { base, query, records } from './dashboard-fixture';

test('compact exam results keep legacy records accessible alongside the timeline', () => {
  const legacy = records.exams[0];
  const current = {
    ...legacy,
    examId: 'exam-current',
    submittedAt: '2026-11-19T15:02:00Z',
    questionCount: 1,
  };
  const summary = aggregateDashboard(
    {
      ...records,
      exams: [...records.exams, current],
      events: [
        ...records.events,
        {
          ...base,
          eventId: 'current-answer',
          examId: current.examId,
          certificationId: current.certificationId,
          mode: 'exam',
          context: 'exam',
        },
      ],
    },
    query,
  );
  const widget = dashboardDefaults('Asia/Tokyo').widgets.find(({ kind }) => kind === 'exams');
  if (!widget) throw new Error('Exam widget is missing.');
  const render = (includeLegacy: boolean) => {
    const child = Bun.spawnSync(['rtk', 'proxy', 'bun', 'scripts/dashboard-session-render-fixture.ts'], {
      stdin: new TextEncoder().encode(
        JSON.stringify({
          widget,
          summary: includeLegacy
            ? summary
            : { ...summary, exams: summary.exams.filter((exam) => exam.submittedAt !== null) },
        }),
      ),
    });
    expect(child.exitCode).toBe(0);
    return new TextDecoder().decode(child.stdout);
  };

  const mixed = render(true);
  expect(mixed).toContain('dashboard-viz-svg');
  expect(mixed).toContain('<details class="dashboard-viz-details">');
  expect(mixed).toContain(messages.en.dashboardUnknownSubmitted);
  expect(render(false)).not.toContain('<table');
});
