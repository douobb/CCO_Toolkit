'use client';
import SearchDialog from '@/components/search';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { i18nProvider } from 'fumadocs-ui/i18n';
import { type ReactNode } from 'react';
import type { Locale } from '@/lib/i18n';
import { fumadocsTranslations } from '@/lib/fumadocs-translations';
import { SharedUserInputsProvider } from '@/components/shared-user-inputs';
import { SiteTitlePhaseInitializer } from '@/components/site-title-phase-initializer';

const fixedThemeStorageKey = 'cco-toolkit:fixed-color-scheme';

export function Provider({ children, locale }: { children: ReactNode; locale: Locale }) {
  return (
    <RootProvider
      i18n={i18nProvider(fumadocsTranslations, locale)}
      search={{ SearchDialog }}
      theme={{
        attribute: 'class',
        defaultTheme: 'dark',
        forcedTheme: 'dark',
        enableSystem: false,
        enableColorScheme: true,
        storageKey: fixedThemeStorageKey,
        hotKey: false,
      }}
    >
      <SiteTitlePhaseInitializer />
      <SharedUserInputsProvider>{children}</SharedUserInputsProvider>
    </RootProvider>
  );
}
