import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { studyCourses } from '../src/certifications.ts';
import { examDomainOf, type Question, questionGroupKey, validQuestionFormat } from '../src/questions.ts';

const banks = new Map<string, Question[]>();
async function load(path: string) {
  const cached = banks.get(path);
  if (cached) return cached;
  const questions = JSON.parse(await readFile(`public/${path}`, 'utf8')) as Question[];
  assert(Array.isArray(questions) && questions.length > 0, path);
  const ids = new Set<string>();
  for (const question of questions) {
    const context = `${path}: ${question.id}`;
    assert(question.id && !ids.has(question.id), context);
    ids.add(question.id);
    assert(Number.isSafeInteger(question.revision) && question.revision >= 1, context);
    if (question.examDomain !== undefined)
      assert(typeof question.examDomain === 'string' && question.examDomain.trim(), context);
    assert(
      [
        question.category,
        question.version,
        question.title,
        question.prompt,
        question.source.label,
      ].every((value) => value.trim()),
      context,
    );
    assert.equal(new URL(question.source.url).protocol, 'https:', context);
    const options = new Set(question.choices.map((choice) => choice.id));
    assert.equal(options.size, question.choices.length, context);
    assert(
      question.choices.every((choice) => choice.text.trim() && choice.explanation.trim()),
      context,
    );
    assert(
      question.correct.length > 0 && new Set(question.correct).size === question.correct.length,
      context,
    );
    assert(
      question.correct.every((answer) => options.has(answer)),
      context,
    );
    assert(validQuestionFormat(question), context);
    if (path.endsWith('mock-2026-11.json') || path.endsWith('extra-questions.json')) {
      if (!question.format) assert.equal(options.size, question.correct.length === 1 ? 4 : 5, context);
      assert(question.learning?.reason.trim() && question.learning.concept.trim(), context);
    }
  }
  banks.set(path, questions);
  return questions;
}

for (const { course } of studyCourses) {
  if (!course) continue;
  const bank = await load(course.mock);
  const groups = new Map<string, string>();
  for (const question of bank) {
    if (!question.similarityGroup) continue;
    assert.match(question.similarityGroup, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    const category = groups.get(question.similarityGroup);
    const domain = examDomainOf(question);
    assert(!category || category === domain, `${course.mock}: group crosses exam categories`);
    groups.set(question.similarityGroup, domain);
  }
  for (const [category, count] of Object.entries(course.exam.distribution)) {
    const required = count * (course.reviewedMock ? 5 : 1);
    const available = new Set(
      bank.filter((question) => examDomainOf(question) === category).map(questionGroupKey),
    ).size;
    assert(
      available >= required,
      `${course.mock}: ${category} has ${available} distinct questions, expected at least ${required}`,
    );
  }
  for (const path of [...course.practice.map((entry) => entry.path), ...course.archives])
    await load(path);
}

console.log(`Validated ${banks.size} question banks`);
