import { expect, test } from 'bun:test';
import { hardcodedCssIssues, hardcodedUiIssues } from './hardcoded-ui';

test('translation lint rejects hardcoded visible text and accessible labels', () => {
  const source = '<button aria-label="Next question">次の問題</button>';
  expect(hardcodedUiIssues(source, 'Example.tsx')).toHaveLength(2);
});

test('translation lint accepts external data, translation keys and technical attributes', () => {
  const source =
    '<button className="primary" lang="en" aria-label={t("next")}>{t("next")} · {item.title}</button>';
  expect(hardcodedUiIssues(source, 'Example.tsx')).toEqual([]);
});

test('translation lint rejects a literal hidden inside an expression', () => {
  expect(hardcodedUiIssues('<p>{"Loading content"}</p>', 'Example.tsx')).toHaveLength(1);
});

test('translation lint includes chart, table and assistive display labels', () => {
  const source =
    '<section aria-roledescription="chart"><meter aria-valuetext="Half complete" /><Chart label="Accuracy" /><td data-label="Score" /></section>';
  expect(hardcodedUiIssues(source, 'Example.tsx')).toHaveLength(4);
  expect(
    hardcodedUiIssues('<Chart label={t("accuracy")} data-label={column.label} />', 'Example.tsx'),
  ).toEqual([]);
});

test('translation lint inspects displayed conditional branches, templates, and accessible expressions', () => {
  expect(hardcodedUiIssues('<p>{ready ? "Ready" : t("loading")}</p>', 'Example.tsx')).toHaveLength(1);
  expect(hardcodedUiIssues(`<p>{\`Question \${index}\`}</p>`, 'Example.tsx')).toHaveLength(1);
  expect(
    hardcodedUiIssues('<button aria-label={ready ? "Next" : "Wait"} />', 'Example.tsx'),
  ).toHaveLength(2);
  expect(hardcodedUiIssues('<p>{mode === "study" && t("study")}</p>', 'Example.tsx')).toEqual([]);
});

test('translation lint rejects CSS text while allowing decoration and external attributes', () => {
  expect(hardcodedCssIssues('.faq::before { content: "Q"; }', 'faq.css')).toHaveLength(1);
  expect(hardcodedCssIssues('.status::after { content: "完了"; }', 'status.css')).toHaveLength(1);
  expect(hardcodedCssIssues('.icon::before { content: "→"; }', 'icon.css')).toEqual([]);
  expect(hardcodedCssIssues('.label::before { content: attr(data-label); }', 'label.css')).toEqual([]);
  expect(hardcodedCssIssues('.icon::before { content: ""; }', 'icon.css')).toEqual([]);
  expect(hardcodedCssIssues(String.raw`.icon::before { content: "\f00d"; }`, 'icon.css')).toEqual([]);
  expect(hardcodedCssIssues(String.raw`.faq::before { content: "\51"; }`, 'faq.css')).toHaveLength(1);
});

test('translation lint rejects generator display labels and preserves canonical identifiers', () => {
  expect(
    hardcodedUiIssues('const step = { label: "Checkpoint", kind: "checkpoint" };', 'plan.ts', true),
  ).toHaveLength(1);
  expect(
    hardcodedUiIssues(`const step = { label: \`Step \${index}\`, kind: "reading" };`, 'plan.ts', true),
  ).toHaveLength(1);
  expect(
    hardcodedUiIssues('const step = { label: labels.checkpoint, kind: "checkpoint" };', 'plan.ts', true),
  ).toEqual([]);
});
