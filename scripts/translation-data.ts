import { readdir, readFile } from 'node:fs/promises';
import site from '../src/content/ja.json' with { type: 'json' };
import type { Question } from '../src/questions';
import { questionTranslationSource } from './natural-translation-content';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };
export async function contentJobs() {
  const jobs: { path: string; data: Json }[] = [{ path: 'site.json', data: site }];
  for (const directory of (await readdir('public/courses', { withFileTypes: true })).filter((entry) =>
    entry.isDirectory(),
  )) {
    for (const file of (await readdir(`public/courses/${directory.name}`)).filter((name) =>
      name.endsWith('.json'),
    )) {
      const path = `courses/${directory.name}/${file}`;
      const questions: Question[] = JSON.parse(await readFile(`public/${path}`, 'utf8'));
      const data = questions.map(questionTranslationSource);
      jobs.push({ path, data });
    }
  }
  return jobs;
}
