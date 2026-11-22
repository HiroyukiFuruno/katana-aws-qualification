import { useState } from 'react';
import { shuffle } from '../../randomization';
import type { DeliveryQuestion } from '../delivery/artifactTypes';

export function useCheckpointPresentation(question: DeliveryQuestion | undefined, checkpoint: boolean) {
  const [order, setOrder] = useState(() =>
    question && checkpoint ? shuffle(question.choices.map(({ id }) => id)) : [],
  );
  const choices =
    question && checkpoint
      ? order.map((id) => {
          const choice = question.choices.find((item) => item.id === id);
          if (!choice) throw new Error('Invalid localized checkpoint choice identity');
          return choice;
        })
      : question?.choices;
  return {
    question: question && choices ? { ...question, choices } : question,
    reshuffle: () => setOrder(question ? shuffle(question.choices.map(({ id }) => id)) : []),
  };
}
