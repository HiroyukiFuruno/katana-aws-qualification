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
  question_order: QuestionRef[];
  revision: number;
  state: string;
  started_at?: string | null;
  submitted_at?: string | null;
};

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
