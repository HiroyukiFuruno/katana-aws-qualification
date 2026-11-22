import { useEffect, useRef, useState } from 'react';
import type { Attempt } from '../attempts';
import { localizeSessionQuestions } from '../questionPresentation';
import { randomizePracticeQuestions } from '../randomization';
import { createSession, type FundamentalsSession } from './session';
import type { FundamentalsContent, FundamentalsQuestion, FundamentalsUnit } from './types';

function sessionFor(unit: FundamentalsUnit, attempts: Attempt[], review: boolean) {
  const session = createSession(unit, attempts, review);
  return !review && !session.questions.length
    ? { ...session, questions: randomizePracticeQuestions(unit.questions) }
    : session;
}

export function useFundamentalsSession(
  content: FundamentalsContent | undefined,
  attempts: Attempt[],
  historyLoaded: boolean,
) {
  const [session, setSession] = useState<FundamentalsSession>();
  const [showResults, setShowResults] = useState(false);
  const [initialUnitId] = useState(() => new URLSearchParams(location.search).get('unit'));
  const [initialReview] = useState(() => new URLSearchParams(location.search).get('review') === '1');
  const [practice, setPractice] = useState(initialReview);
  const initialSessionStarted = useRef(false);

  useEffect(() => {
    if (initialSessionStarted.current || !content || !historyLoaded || !initialUnitId) return;
    initialSessionStarted.current = true;
    const unit = content.units.find((item) => item.id === initialUnitId);
    if (unit) setSession(sessionFor(unit, attempts, initialReview));
  }, [attempts, content, historyLoaded, initialReview, initialUnitId]);

  useEffect(() => {
    if (!content) return;
    setSession((current) => {
      if (!current) return current;
      const unit = content.units.find((item) => item.id === current.unitId);
      return unit
        ? {
            ...current,
            questions: localizeSessionQuestions(
              current.questions,
              unit.questions,
            ) as FundamentalsQuestion[],
          }
        : current;
    });
  }, [content]);

  function openUnit(id: string, review = false) {
    const unit = content?.units.find((item) => item.id === id);
    setSession(unit ? sessionFor(unit, attempts, review) : undefined);
    setShowResults(false);
    setPractice(review);
    history.replaceState(
      null,
      '',
      `${location.pathname}?unit=${encodeURIComponent(id)}${review ? '&review=1' : ''}`,
    );
  }

  return { session, setSession, practice, setPractice, showResults, setShowResults, openUnit };
}
