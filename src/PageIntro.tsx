import type { ReactNode } from 'react';
import { SiteAd } from './SiteAd';

export function PageIntro({ children, showAd = true }: { children: ReactNode; showAd?: boolean }) {
  return (
    <>
      {children}
      {showAd && <SiteAd placement="inline" />}
    </>
  );
}
