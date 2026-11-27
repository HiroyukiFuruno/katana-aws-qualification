import { usePreferences } from '../preferences';
import { type Question, questionKey } from '../questions';
import figures from './ans-c01.json';
import './question-figure.css';

const figureKeys = new Map<string, keyof typeof figures>([
  [questionKey({ id: 'ans-c01-practice-01', revision: 1 }), 'dns'],
  [questionKey({ id: 'ans-c01-practice-04', revision: 1 }), 'appliance'],
  [questionKey({ id: 'ans-c01-practice-05', revision: 1 }), 'privateLink'],
  [questionKey({ id: 'ans-c01-practice-06', revision: 1 }), 's3'],
  [questionKey({ id: 'ans-c01-practice-01', revision: 3 }), 'resolverPaths'],
  [questionKey({ id: 'ans-c01-practice-04', revision: 3 }), 'appliance'],
  [questionKey({ id: 'ans-c01-practice-05', revision: 3 }), 'privateLink'],
  [questionKey({ id: 'ans-c01-practice-06', revision: 3 }), 's3SecurityGroup'],
]);

export function QuestionFigure({ question }: { question: Pick<Question, 'id' | 'revision'> }) {
  const { locale } = usePreferences();
  const key = figureKeys.get(questionKey(question));
  if (!key) return null;
  const figure = figures[key];
  return (
    <figure className="question-figure">
      {figure.routes.map((nodes) => (
        <ol
          key={nodes.join(' → ')}
          lang="en"
          className={figure.bidirectional ? 'question-figure-bidirectional' : undefined}
        >
          {nodes.map((node) => (
            <li key={node}>
              <span>{node}</span>
            </li>
          ))}
        </ol>
      ))}
      <figcaption>{figure.caption[locale]}</figcaption>
    </figure>
  );
}
