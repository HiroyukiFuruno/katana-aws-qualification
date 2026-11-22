import type { ReactNode } from 'react';
import { AuthProvider } from './auth/AuthContext';
import { PreferencesProvider } from './preferences';
import { ProgressProvider } from './progress/ProgressProvider';
import { SitePreferencesProvider } from './sitePreferences/Provider';

export function SiteProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SitePreferencesProvider>
        <PreferencesProvider>
          <ProgressProvider>{children}</ProgressProvider>
        </PreferencesProvider>
      </SitePreferencesProvider>
    </AuthProvider>
  );
}
