import { certifications } from '../certifications';
import { localePath } from '../locales';
import { usePreferences } from '../preferences';
import type { Milestone } from './types';

export function MilestoneLink({ row }: { row: Milestone }) {
  const { locale, t } = usePreferences();
  const course = certifications.find(({ id }) => id === row.certificationId)?.course;
  const practice = course && (row.kind === 'study' || row.kind === 'mock_exam');
  const path = practice ? `study/${row.certificationId}` : `certifications/${row.certificationId}`;
  const search = practice && row.kind === 'mock_exam' ? '?mode=exam' : '';
  const label = practice ? (row.kind === 'mock_exam' ? 'exam' : 'study') : 'certGuides';
  return <a href={`${localePath(locale, path)}${search}`}>{t(label)}</a>;
}
