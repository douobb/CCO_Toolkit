// @vitest-environment happy-dom

import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SITE_TITLE_PHASE_BOOTSTRAP_SCRIPT,
  SITE_TITLE_PHASE_COUNT,
  SITE_TITLE_PHASE_STYLE_ID,
  setSiteTitlePhase,
} from './site-title-phase';

afterEach(() => {
  document.getElementById(SITE_TITLE_PHASE_STYLE_ID)?.remove();
  document.documentElement.removeAttribute('style');
  vi.restoreAllMocks();
});

function addPhaseStyle() {
  const style = document.createElement('style');
  style.id = SITE_TITLE_PHASE_STYLE_ID;
  document.head.append(style);
  return style;
}

describe('site title phase bootstrap', () => {
  it.each(Array.from({ length: SITE_TITLE_PHASE_COUNT }, (_, phase) => phase))(
    'installs phase %i through a synchronous CSSOM rule',
    (phase) => {
      const style = addPhaseStyle();
      const random = vi.fn(() => (phase + 0.5) / SITE_TITLE_PHASE_COUNT);

      runInNewContext(SITE_TITLE_PHASE_BOOTSTRAP_SCRIPT, {
        document,
        Math: { floor: Math.floor, random },
      });

      const rule = style.sheet?.cssRules[0] as CSSStyleRule | undefined;
      expect(random).toHaveBeenCalledOnce();
      expect(rule?.selectorText).toBe(':root:root');
      expect(rule?.style.getPropertyValue('--site-title-glow-delay'))
        .toBe(`${-phase * 3}s`);
      expect(style.textContent).toBe('');
      expect(document.documentElement.hasAttribute('style')).toBe(false);
    },
  );

  it('updates the existing CSSOM rule without changing the React-owned html style attribute', () => {
    const style = addPhaseStyle();
    style.sheet?.insertRule(':root:root{--site-title-glow-delay:0s}', 0);

    setSiteTitlePhase(5);

    const rule = style.sheet?.cssRules[0] as CSSStyleRule | undefined;
    expect(rule?.selectorText).toBe(':root:root');
    expect(rule?.style.getPropertyValue('--site-title-glow-delay')).toBe('-15s');
    expect(style.textContent).toBe('');
    expect(document.documentElement.hasAttribute('style')).toBe(false);
  });
});
