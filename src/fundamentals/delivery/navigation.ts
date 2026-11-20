import { type Locale, localePath, locales } from '../../locales.ts';

export type LessonRoute = {
  locale: Locale;
  unitId: string;
  contentVersion?: string;
} & (
  | { stage: 'resume' | 'result'; position?: never }
  | { stage: 'slides' | 'checkpoints' | 'final'; position: number }
);

const unitPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function lessonPath(route: LessonRoute) {
  const slug = route.unitId.replace(/^fundamentals\./, '');
  if (!route.unitId.startsWith('fundamentals.') || !unitPattern.test(slug)) {
    throw new Error('Invalid lesson unit.');
  }
  const base = `study/fundamentals/${slug}`;
  if (route.contentVersion !== undefined && !/^[0-9a-f]{64}$/.test(route.contentVersion))
    throw new Error('Invalid lesson version.');
  const version = route.contentVersion ? `?version=${route.contentVersion}` : '';
  if (route.stage === 'resume') return `${localePath(route.locale, base)}${version}`;
  if (route.stage === 'result') return `${localePath(route.locale, `${base}/result`)}${version}`;
  if (
    typeof route.position !== 'number' ||
    !Number.isSafeInteger(route.position) ||
    route.position < 1
  ) {
    throw new Error('Invalid lesson position.');
  }
  return `${localePath(route.locale, `${base}/${route.stage}/${route.position}`)}${version}`;
}

export function lessonRouteAt(pathname: string, search = ''): LessonRoute | undefined {
  const query = new URLSearchParams(search);
  if (
    (search && (query.size !== 1 || query.get('version') === null)) ||
    query.getAll('version').length > 1
  )
    return undefined;
  const contentVersion = query.get('version') ?? undefined;
  if (query.has('version') && !contentVersion) return undefined;
  if (contentVersion && !/^[0-9a-f]{64}$/.test(contentVersion)) return undefined;
  if (!pathname.startsWith('/')) return undefined;
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
  for (const locale of locales) {
    const base = localePath(locale, 'study/fundamentals');
    if (!normalized.startsWith(base)) continue;
    const parts = normalized.slice(base.length, -1).split('/');
    const slug = parts[0];
    if (!slug || !unitPattern.test(slug)) return undefined;
    const unitId = `fundamentals.${slug}`;
    if (parts.length === 1)
      return { locale, unitId, stage: 'resume', ...(contentVersion ? { contentVersion } : {}) };
    if (parts.length === 2 && parts[1] === 'result')
      return { locale, unitId, stage: 'result', ...(contentVersion ? { contentVersion } : {}) };
    if (parts.length !== 3 || !/^[1-9]\d*$/.test(parts[2] ?? '')) return undefined;
    const position = Number(parts[2]);
    if (!Number.isSafeInteger(position)) return undefined;
    const stage = parts[1];
    if (stage === 'slides' || stage === 'checkpoints' || stage === 'final') {
      return { locale, unitId, stage, position, ...(contentVersion ? { contentVersion } : {}) };
    }
    return undefined;
  }
  return undefined;
}
