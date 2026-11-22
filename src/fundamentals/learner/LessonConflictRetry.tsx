export function LessonConflictRetry({
  busy,
  label,
  retry,
}: {
  busy: boolean;
  label: string;
  retry: () => void;
}) {
  return (
    <button type="button" disabled={busy} onClick={retry}>
      {label}
    </button>
  );
}
