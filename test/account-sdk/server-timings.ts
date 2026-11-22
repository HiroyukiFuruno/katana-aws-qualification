import { writeFileSync } from 'node:fs';
import { artifacts } from '../account-merge/settings';

type Phase = 'started' | 'actor' | 'exchange' | 'canonical' | 'port' | 'membership' | 'hook' | 'proof';
type Span = { path: string; startedAt: string; phases: { name: Phase; elapsedMs: number }[] };

export class SdkTimings {
  private readonly spans: Span[] = [];

  constructor(private readonly cleanupFilename = 'sdk-cleanup.json') {
    if (!/^sdk(?:-[a-z]+)*-cleanup\.json$/.test(cleanupFilename))
      throw new Error('Invalid SDK timing receipt filename');
  }

  request(path: string | undefined) {
    const start = performance.now();
    const span: Span = {
      path: path === '/start' || path === '/exchange' ? path : 'other',
      startedAt: new Date().toISOString(),
      phases: [],
    };
    this.spans.push(span);
    return (name: Phase) => span.phases.push({ name, elapsedMs: performance.now() - start });
  }

  write() {
    const name = this.cleanupFilename.replace(/-cleanup\.json$/, '-timings.json');
    writeFileSync(`${artifacts}/${name}`, `${JSON.stringify({ spans: this.spans }, null, 2)}\n`);
  }
}
