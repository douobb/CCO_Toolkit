'use client';

import { usePathname } from 'fumadocs-core/framework';
import { useEffect, useRef } from 'react';
import {
  SITE_TITLE_PHASE_COUNT,
  setSiteTitlePhase,
} from '@/lib/site-title-phase';

export function SiteTitlePhaseInitializer() {
  const pathname = usePathname();
  const initializedPath = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (initializedPath.current === undefined) {
      initializedPath.current = pathname;
      return;
    }
    if (initializedPath.current === pathname) return;

    initializedPath.current = pathname;
    setSiteTitlePhase(Math.floor(Math.random() * SITE_TITLE_PHASE_COUNT));
  }, [pathname]);

  return null;
}
