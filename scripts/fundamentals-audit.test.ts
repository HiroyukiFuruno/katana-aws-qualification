import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parseDeliveryIndex } from '../src/fundamentals/delivery/loadIndex';
import { parseDeliveryUnit } from '../src/fundamentals/delivery/loadUnit';

test('the 192-question audit preserves the original polarity, choice count and answer keys', async () => {
  const root = 'public/fundamentals/delivery/history/2026-11-20';
  const index = parseDeliveryIndex(await Bun.file(`${root}/index.json`).json());
  const expected = new Map<string, { polarity: string; required: number; correct: string[] }>();
  for (const entry of index.units) {
    const asset = parseDeliveryUnit(await Bun.file(`${root}/${entry.slug}.json`).json(), entry);
    for (const question of [...asset.checkpoints, ...asset.finalQuestions])
      expected.set(question.id, {
        polarity: question.selectionPolarity,
        required: question.requiredChoices,
        correct: [...question.correct].sort(),
      });
  }
  const documents = await Promise.all(
    ['first6', 'last6'].map((part) =>
      readFile(`docs/reviews/20261121_fundamentals_questions_${part}.md`, 'utf8'),
    ),
  );
  const rows = documents
    .flatMap((document) =>
      document.split('\n').map((line) =>
        line
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim().replaceAll('`', '')),
      ),
    )
    .filter((row) => row.length === 5 && (row[2] === 'correct' || row[2] === 'incorrect'));
  expect(expected.size).toBe(192);
  expect(rows).toHaveLength(192);
  const seen = new Set<string>();
  for (const row of rows) {
    const id = row[1];
    if (!id) throw new Error('Audit row has no question ID');
    expect(seen.has(id)).toBe(false);
    seen.add(id);
    expect(expected.get(id)).toEqual({
      polarity: row[2],
      required: Number(row[3]),
      correct: (row[4] ?? '')
        .split(',')
        .map((id) => id.trim())
        .sort(),
    });
  }
});
