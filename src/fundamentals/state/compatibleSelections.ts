import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import compatible from '../delivery/compatibleAnswers.json' with { type: 'json' };
import { legacyLessonRecord } from '../delivery/legacyRecordAsset';
import type { LessonRecordAsset, LessonRecordQuestion } from '../delivery/recordAsset';
import { copyCompatibleSelection } from './draftAnswerCompatibility';
import { lessonQuestionRef, sameLessonQuestionRef } from './grade';
import type { GuestLessonStorage } from './guestStorage';
import type { LessonSnapshot } from './types';

export type CompatibleSelections = Readonly<Record<string, readonly string[]>>;

type Input = {
  current: DeliveryUnitAsset;
  guest: GuestLessonStorage | null;
  member?: {
    load: (asset: LessonRecordAsset) => Promise<LessonSnapshot>;
    checkpointSelection: (
      asset: LessonRecordAsset,
      question: LessonRecordQuestion,
    ) => Promise<string[] | undefined>;
  };
};

type CompatibilityMapping = {
  unitId: string;
  contentVersion: string;
  previous: readonly string[];
  questions: readonly string[];
  choiceAliases: Readonly<Partial<Record<string, Readonly<Partial<Record<string, string>>>>>>;
};
const mappings: readonly CompatibilityMapping[] = compatible.units;

export async function compatibleLessonSelections({
  current,
  guest,
  member,
}: Input): Promise<CompatibleSelections> {
  const matching = mappings.filter(
    ({ unitId, contentVersion }) =>
      unitId === current.unit.id && contentVersion === current.contentVersion,
  );
  const selections: Record<string, readonly string[]> = {};
  for (const { previous: previousVersions, questions, choiceAliases } of matching) {
    const eligible = new Set(questions);
    function keep(
      before: LessonRecordQuestion,
      now: LessonRecordQuestion | undefined,
      selected?: string[],
    ) {
      if (!now || !eligible.has(now.id) || Object.hasOwn(selections, now.id) || !selected) return;
      const replacement = copyCompatibleSelection(before, now, selected, choiceAliases[now.id]);
      if (replacement) selections[now.id] = replacement;
    }
    for (const version of previousVersions) {
      if (guest && !guest.hasSource(current.unit.id, version)) continue;
      const previous = await legacyLessonRecord(current.unit.id, version);
      if (!previous) throw new Error('Approved lesson history references are missing.');
      const guestSource = guest ? await guest.read(previous) : null;
      const memberSource = member ? await member.load(previous) : null;
      const active =
        guestSource?.activeFinal ?? memberSource?.sessions.find(({ state }) => state === 'draft');
      for (const [position, before] of previous.finalQuestions.entries()) {
        const response = active?.responses[String(position)];
        if (response && sameLessonQuestionRef(response.questionRef, lessonQuestionRef(before))) {
          keep(
            before,
            current.finalQuestions.find(({ id }) => id === before.id),
            response.selected,
          );
        }
      }
      if (!member && !guestSource) continue;
      await Promise.all(
        previous.checkpoints
          .filter(({ id }) => eligible.has(id))
          .map(async (before) => {
            if (Object.hasOwn(selections, before.id)) return;
            const selected = guestSource
              ? guestSource.checkpointReceipts
                  .filter(({ questionRef }) =>
                    sameLessonQuestionRef(questionRef, lessonQuestionRef(before)),
                  )
                  .at(-1)?.selected
              : await member?.checkpointSelection(previous, before);
            keep(
              before,
              current.checkpoints.find(({ id }) => id === before.id),
              selected,
            );
          }),
      );
    }
  }
  return selections;
}
