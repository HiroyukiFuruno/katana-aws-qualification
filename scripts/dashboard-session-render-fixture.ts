import { mock } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import content from '../public/translations/en/site.json';
import type { DashboardWidget } from '../src/dashboard/preferenceTypes';
import type { DashboardSummary } from '../src/dashboard/summaryTypes';
import { DashboardDensityContext } from '../src/dashboard/visual/DashboardDensity';

// 単体描画だけで読み込み済みの実辞書を渡し、モジュール置換を別プロセスへ隔離する。
mock.module('../src/useContent', () => ({ useContent: () => ({ content }) }));
const { SessionPanel } = await import('../src/dashboard/visual/SessionPanel');
const input: { widget: DashboardWidget; summary: DashboardSummary } = JSON.parse(await Bun.stdin.text());
process.stdout.write(
  renderToStaticMarkup(
    createElement(
      DashboardDensityContext.Provider,
      { value: 'compact' },
      createElement(SessionPanel, { ...input, lessons: [] }),
    ),
  ),
);
