import type { Attempt } from './attempts';

export function exportHistory(history: Attempt[]) {
  const data = history.map((attempt) => JSON.stringify(attempt)).join('\n');
  const url = URL.createObjectURL(new Blob([`${data}\n`], { type: 'application/x-ndjson' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'saa-study-history.jsonl';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
