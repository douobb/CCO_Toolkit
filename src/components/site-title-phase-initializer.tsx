'use client';

import { usePathname } from 'fumadocs-core/framework';
import { useEffect, useRef } from 'react';

const SITE_TITLE_PHASE_COUNT = 8;
const SITE_TITLE_PHASE_STEP_SECONDS = 3;

export function SiteTitlePhaseInitializer() {
  const pathname = usePathname();
  const initializedPath = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (initializedPath.current === pathname) return;
    initializedPath.current = pathname;

    const phase = Math.floor(Math.random() * SITE_TITLE_PHASE_COUNT);
    document.documentElement.style.setProperty(
      '--site-title-glow-delay',
      `${-phase * SITE_TITLE_PHASE_STEP_SECONDS}s`,
    );
  }, [pathname]);

  return null;
}
