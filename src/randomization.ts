import type { Question } from './questions';

export type RandomSource = () => number;

export function shuffle<T>(source: readonly T[], random: RandomSource = Math.random) {
  const items = [...source];
  for (let index = items.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

export function randomizeQuestion<T extends Question>(question: T, random?: RandomSource): T {
  return { ...question, choices: shuffle(question.choices, random) };
}

export function randomizePracticeQuestions<T extends Question>(
  questions: readonly T[],
  random?: RandomSource,
) {
  return shuffle(questions, random).map((question) => randomizeQuestion(question, random));
}
