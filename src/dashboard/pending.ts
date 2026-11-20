import { lessonOutboxKey, readLessonOutboxEnvelope } from '../fundamentals/state/outboxCodec';
import type { BrowserStorage } from '../progress/guest';

export type DashboardSyncStatus = { pending: boolean; unreadable: boolean };
export const clearDashboardSync: DashboardSyncStatus = { pending: false, unreadable: false };

export function dashboardLessonSyncStatus(
  storage: BrowserStorage,
  userId: string,
  generation: number,
): DashboardSyncStatus {
  try {
    const raw = storage.getItem(lessonOutboxKey(userId));
    if (raw === null) return { ...clearDashboardSync };
    const row = readLessonOutboxEnvelope(raw, userId);
    if (row.generation > generation) return { pending: false, unreadable: true };
    return { pending: row.generation === generation && row.commands.length > 0, unreadable: false };
  } catch {
    return { pending: false, unreadable: true };
  }
}
