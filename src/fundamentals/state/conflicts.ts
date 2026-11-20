export class LessonStateChangedError extends Error {
  readonly code = 'PT412';
  constructor() {
    super('Lesson progress changed. Reload the saved record before continuing.');
    this.name = 'LessonStateChangedError';
  }
}
