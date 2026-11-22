import { SiteAd, siteAdServingEnabled } from '../../SiteAd';

export function LessonAdSlot({ consent, final }: { consent: string | null; final: boolean }) {
  return !final && siteAdServingEnabled && consent === 'granted' ? (
    <SiteAd fullWidth={false} />
  ) : undefined;
}
