export function isLessonConflict(error: unknown) {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error.code === 'PT412' || error.code === 'PT409')
  );
}
