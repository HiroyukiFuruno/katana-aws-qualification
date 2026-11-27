export class LessonStateChangedError extends Error {
  readonly code = 'PT412';
  constructor() {
    super('Lesson progress changed. Reload the saved record before continuing.');
    this.name = 'LessonStateChangedError';
  }
}

export class GuestLessonConflictError extends Error {
  constructor() {
    super('Saved and temporary lesson progress differ. Choose which record to keep.');
    this.name = 'GuestLessonConflictError';
  }
}
