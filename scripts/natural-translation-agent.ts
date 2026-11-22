import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { naturalTranslationInstructions } from './natural-translation-schema';

export async function runNaturalTranslationAgent(
  input: unknown,
  directory: string,
  schemaPath: string,
  attempt = 0,
  instructions = naturalTranslationInstructions,
) {
  await mkdir(directory, { recursive: true });
  const output = join(directory, 'result.json');
  const events = join(directory, 'events.jsonl');
  const errors = join(directory, 'stderr.log');
  const guidance = await readFile(new URL('./natural-translation-guidance.md', import.meta.url), 'utf8');
  const prompt = `${instructions}\n\n${guidance}\n\nINPUT:\n${JSON.stringify(input)}\n`;
  await writeFile(join(directory, 'prompt.txt'), prompt);
  const model =
    attempt < 2 ? (process.env.NATURAL_TRANSLATION_MODEL ?? 'gpt-5.6-luna') : 'gpt-5.6-terra';
  const child = Bun.spawn(
    [
      'codex',
      'exec',
      '--ignore-user-config',
      '--ephemeral',
      '-s',
      'read-only',
      '-m',
      model,
      '-c',
      `model_reasoning_effort="${attempt < 2 ? (process.env.NATURAL_TRANSLATION_REASONING ?? 'medium') : 'high'}"`,
      '--output-schema',
      schemaPath,
      '--output-last-message',
      output,
      '--json',
      '-',
    ],
    { stdin: 'pipe', stdout: Bun.file(events), stderr: Bun.file(errors) },
  );
  child.stdin.write(prompt);
  child.stdin.end();
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(`Natural translation agent exit ${exitCode}; see ${errors}`);
  const eventRecords = (await readFile(events, 'utf8'))
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line));
  const thread = eventRecords.find((event) => event.type === 'thread.started')?.thread_id;
  const result = JSON.parse(await readFile(output, 'utf8'));
  if (thread) {
    const ledger = join(process.env.HOME ?? '', '.codex/hooks/task-state', `${thread}.json`);
    await writeFile(
      ledger,
      `${JSON.stringify({ session_id: thread, cwd: process.cwd(), mode: 'work', user_instruction: 'Produce candidate natural translation JSON for parent validation.', tasks: [{ id: 'candidate-translation', state: 'done', evidence: output }] }, null, 2)}\n`,
    );
  }
  const usage = eventRecords.find((event) => event.type === 'turn.completed')?.usage;
  return { result, model, usage, thread };
}
