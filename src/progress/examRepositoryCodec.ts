type QuestionRef = { question_id: string; question_revision: number };

export type ResponseRow = {
  duration_ms: number;
  exam_id: string;
  flagged: boolean;
  question_key: string;
  selected: string[];
  selected_at: string | null;
};

export type SessionRow = {
  certification_id: string;
  deadline_at: string;
  exam_id: string;
  position: number;
  presentation?: unknown;
  question_order: QuestionRef[];
  revision: number;
  state: string;
  started_at?: string | null;
  submitted_at?: string | null;
};

export function choiceOrders(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const orders = (value as { choiceOrders?: unknown }).choiceOrders;
  if (!orders || typeof orders !== 'object' || Array.isArray(orders)) return {};
  return Object.fromEntries(
    Object.entries(orders).flatMap(([key, candidate]) =>
      Array.isArray(candidate) && candidate.every((id) => typeof id === 'string')
        ? [[key, candidate]]
        : [],
    ),
  );
}

export function presentation(order: string[], choices: Record<string, string[]> | undefined) {
  const permitted = new Set(order);
  return {
    choiceOrders: Object.fromEntries(
      Object.entries(choices ?? {}).filter(
        ([key, ids]) =>
          permitted.has(key) &&
          ids.length > 0 &&
          ids.length <= 20 &&
          ids.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 160) &&
          new Set(ids).size === ids.length,
      ),
    ),
  };
}

function ref(value: unknown): QuestionRef {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as QuestionRef).question_id !== 'string' ||
    !Number.isInteger((value as QuestionRef).question_revision)
  )
    throw new Error('Invalid exam question key');
  return value as QuestionRef;
}

export function refs(order: string[]) {
  return order.map((item) => {
    const value: unknown = JSON.parse(item);
    if (!Array.isArray(value)) throw new Error('Invalid exam question key');
    return ref({ question_id: value[0], question_revision: value[1] });
  });
}

export function questionKey(value: QuestionRef) {
  return JSON.stringify([value.question_id, value.question_revision]);
}

export function storedQuestionKey(value: string) {
  return questionKey(ref(JSON.parse(value)));
}
