import { mock } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SiteContent } from '../src/contentTypes';

const content: SiteContent = JSON.parse(readFileSync('public/translations/en/site.json', 'utf8'));
mock.module('../src/useContent', () => ({
  useContent: () => ({ content, loading: false, error: false }),
}));
const { RoadmapResults } = await import('../src/RoadmapResults');
function idle() {}
console.log(
  renderToStaticMarkup(
    createElement(RoadmapResults, {
      items: content.assessment,
      earned: [],
      answers: JSON.parse(process.argv[2]),
      today: '2026-11-22',
      onStudy: idle,
      onEdit: idle,
      onRetake: idle,
      saving: false,
    }),
  ),
);
