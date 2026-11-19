import { assessmentData } from './assessmentData';
import { assessmentExtra } from './assessmentExtra';
import { certifications, type Skill } from './certifications';

export const profileKey = 'katana.certification-profile.v1';
export const assessment = [...assessmentData, ...assessmentExtra];

export function remainingCertifications(earned: string[], today: string) {
  return certifications.filter(
    (cert) => !earned.includes(cert.id) && (!cert.retireOn || cert.retireOn >= today),
  );
}

export function assessmentItems(earned: string[], today: string) {
  const relevant = new Set(remainingCertifications(earned, today).flatMap((cert) => cert.skills));
  return assessment.filter((item) => relevant.has(item.skill));
}

export function recommend(earned: string[], answers: Record<string, number>, today: string) {
  const questions = assessmentItems(earned, today);
  const scores = new Map<Skill, number>();
  for (const item of questions) {
    const group = questions.filter((question) => question.skill === item.skill);
    scores.set(
      item.skill,
      group.filter((question) => answers[question.id] === question.correct).length / group.length,
    );
  }
  const candidates = remainingCertifications(earned, today).map((cert) => {
    const readiness =
      cert.skills.reduce((sum, skill) => sum + (scores.get(skill) ?? 0), 0) / cert.skills.length;
    const gaps = cert.skills.filter((skill) => scores.get(skill) !== 1);
    const days = cert.retireOn ? (Date.parse(cert.retireOn) - Date.parse(today)) / 86_400_000 : Infinity;
    const priority = cert.beta ? -1 : days <= 60 && readiness >= 0.75 ? 3 : 0;
    return { cert, readiness, gaps, priority };
  });
  const ordered: typeof candidates = [];
  const completed = new Set(earned);
  const levels = { 基礎: 0, アソシエイト: 1, プロフェッショナル: 2, 専門: 2, ビジネス: 1 };
  while (candidates.length) {
    const eligible = candidates.filter(
      ({ cert }) =>
        cert.buildsOn?.every(
          (id) => completed.has(id) || !candidates.some((candidate) => candidate.cert.id === id),
        ) ?? true,
    );
    const next = (eligible.length ? eligible : candidates).sort(
      (a, b) =>
        b.priority - a.priority ||
        b.readiness - levels[b.cert.level] * 0.24 - (a.readiness - levels[a.cert.level] * 0.24),
    )[0];
    candidates.splice(candidates.indexOf(next), 1);
    completed.add(next.cert.id);
    ordered.push(next);
  }
  return ordered;
}
