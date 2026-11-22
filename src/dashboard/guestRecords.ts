import type { Attempt } from '../attempts';
import type { LessonAssets } from '../fundamentals/delivery/assets';
import { readGuestLessonSource } from '../fundamentals/state/guestSourceCodec';
import type { GuestLessonSource } from '../fundamentals/state/types';
import { guestLessonPrefix } from '../learningStorage';
import { type Locale, localePath } from '../locales';
import { type BrowserStorage, canPersistGuestProgress } from '../progress/guest';
import type { LegacyQuestionResolver } from '../progress/migrationTypes';
import type { DashboardRecords } from './eventTypes';
import { dashboardGuestAttempts } from './guestAttempts';
import { dashboardGuestLesson } from './guestLessonEvents';
import type { DashboardLessonData } from './viewTypes';

type Input = {
  storage: BrowserStorage;
  attempts: Attempt[];
  corruptRows: number;
  resolve: LegacyQuestionResolver;
  assets: LessonAssets;
  locale: Locale;
  isCurrent: () => boolean;
};

export async function loadGuestDashboard(input: Input) {
  const current = () => {
    if (!input.isCurrent() || !canPersistGuestProgress(input.storage))
      throw new Error('Guest dashboard access changed.');
  };
  current();
  const index = await input.assets.index(input.locale);
  const editions = await input.assets.editions(input.locale);
  current();
  const currentVersions = new Map(index.units.map((entry) => [entry.unitId, entry.contentVersion]));
  const known = new Map<string, (typeof index.units)[number]>();
  for (const edition of editions) {
    for (const entry of edition.index.units) {
      const key = `${guestLessonPrefix}${entry.unitId}.${entry.contentVersion}`;
      if (!known.has(key)) known.set(key, entry);
    }
  }
  const rawSources = [...known].map(([key, entry]) => ({ entry, raw: input.storage.getItem(key) }));
  let unknownSources = 0;
  if (input.storage.key && input.storage.length !== undefined) {
    for (let position = 0; position < input.storage.length; position++) {
      const key = input.storage.key(position);
      if (key?.startsWith(guestLessonPrefix) && !known.has(key)) unknownSources++;
    }
  }
  const normal = await dashboardGuestAttempts(input.attempts, input.resolve);
  current();
  const records: DashboardRecords = {
    ...normal,
    lessonFinals: [],
    excludedRecords: normal.excludedRecords + input.corruptRows + unknownSources,
  };
  const lessons: DashboardLessonData[] = [];
  for (const { entry, raw } of rawSources) {
    current();
    const currentVersion = currentVersions.get(entry.unitId) === entry.contentVersion;
    const common = {
      unitId: entry.unitId,
      title: entry.title,
      href: localePath(input.locale, `study/fundamentals/${entry.slug}`),
    };
    if (raw === null) {
      if (!currentVersion) continue;
      lessons.push({
        ...common,
        summary: {
          unitId: entry.unitId,
          contentVersion: entry.contentVersion,
          completedSlides: 0,
          totalSlides: entry.totalSteps - entry.checkpointCount - entry.finalQuestionCount,
          completedCheckpoints: 0,
          totalCheckpoints: entry.checkpointCount,
          activeFinalSessionId: null,
          passedAt: null,
          latestScore: null,
          requiredScore: null,
        },
      });
      continue;
    }
    const asset = await input.assets.unit(entry.unitId, entry.contentVersion);
    current();
    let source: GuestLessonSource;
    try {
      source = readGuestLessonSource(JSON.parse(raw), asset);
    } catch {
      records.excludedRecords++;
      continue;
    }
    const derived = dashboardGuestLesson(source, asset);
    records.events.push(...derived.events);
    records.lessonFinals.push(...derived.lessonFinals);
    if (currentVersion) lessons.push({ ...common, summary: derived.summary });
  }
  current();
  if (new Set(records.events.map((event) => event.eventId)).size !== records.events.length)
    throw new Error('Guest dashboard contains conflicting event identities.');
  return { records, lessons };
}
