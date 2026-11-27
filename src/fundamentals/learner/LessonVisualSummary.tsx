import type { ReactNode } from 'react';
import { usePreferences } from '../../preferences';
import './lesson-visual-summary.css';
import copies from './lesson-visual-copy.json';

export function LessonVisualSummary({ stepId, children }: { stepId: string; children: ReactNode }) {
  const { locale } = usePreferences();
  const copy = copies[locale];
  const details = (mode: 'flow' | 'comparison', entries: string[][]) => {
    const List = mode === 'flow' ? 'ol' : 'ul';
    return (
      <>
        <List className={`lesson-visual-summary lesson-visual-${mode}`}>
          {entries.map(([heading, body]) => (
            <li key={heading}>
              <strong>{heading}</strong>
              <span>{body}</span>
            </li>
          ))}
        </List>
        <details className="lesson-related-reading">
          <summary>{copy.detail}</summary>
          <div className="lesson-related-content">{children}</div>
        </details>
      </>
    );
  };
  switch (stepId) {
    case 'fundamentals.observability:section:improvement:concept:1':
      return details('flow', copy.review);
    case 'fundamentals.release-rollback:section:deployment-strategies:concept:1':
      return details('comparison', copy.deployment);
    case 'fundamentals.core-services:section:database:concept:1':
      return details('comparison', copy.database);
    default:
      return children;
  }
}
