import {
  CertificationOverviewContent,
  copyForCertificationOverview,
} from './CertificationOverviewContent';
import { usePreferences } from './preferences';
import { SiteAd } from './SiteAd';
import { useContent } from './useContent';

export function CertificationOverview() {
  const { locale, t } = usePreferences();
  const { content } = useContent();
  return (
    <CertificationOverviewContent
      locale={locale}
      copy={copyForCertificationOverview(t)}
      certifications={content.certifications}
      ad={<SiteAd placement="inline" />}
    />
  );
}
