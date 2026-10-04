// @vitest-environment happy-dom

import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SITE_TITLE_PHASE_STYLE_ID,
  setSiteTitlePhase,
} from '@/lib/site-title-phase';

const { routeState } = vi.hoisted(() => ({ routeState: { pathname: '/zh-tw' } }));

vi.mock('fumadocs-core/framework', () => ({
  usePathname: () => routeState.pathname,
}));

import { SiteTitlePhaseInitializer } from './site-title-phase-initializer';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.replaceChildren();
  document.getElementById(SITE_TITLE_PHASE_STYLE_ID)?.remove();
  document.documentElement.removeAttribute('style');
  vi.restoreAllMocks();
});

describe('SiteTitlePhaseInitializer', () => {
  it('keeps the parser-selected phase through hydration and changes it only on pathname changes', async () => {
    const phaseStyle = document.createElement('style');
    phaseStyle.id = SITE_TITLE_PHASE_STYLE_ID;
    document.head.append(phaseStyle);
    setSiteTitlePhase(2);

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);

    routeState.pathname = '/initial';
    await act(async () => {
      root.render(<StrictMode><SiteTitlePhaseInitializer /></StrictMode>);
    });
    expect(phaseStyle.sheet?.cssRules[0] && (phaseStyle.sheet.cssRules[0] as CSSStyleRule)
      .style.getPropertyValue('--site-title-glow-delay')).toBe('-6s');

    for (let phase = 0; phase < 8; phase += 1) {
      random.mockReturnValue((phase + 0.5) / 8);
      routeState.pathname = `/phase-${phase}`;
      await act(async () => {
        root.render(<StrictMode><SiteTitlePhaseInitializer /></StrictMode>);
      });
      expect((phaseStyle.sheet?.cssRules[0] as CSSStyleRule).style
        .getPropertyValue('--site-title-glow-delay'))
        .toBe(`${phase === 0 ? 0 : -phase * 3}s`);
    }

    random.mockReturnValue(0.99);
    await act(async () => {
      root.render(<StrictMode><SiteTitlePhaseInitializer /></StrictMode>);
    });
    expect((phaseStyle.sheet?.cssRules[0] as CSSStyleRule).style
      .getPropertyValue('--site-title-glow-delay')).toBe('-21s');

    random.mockReturnValue(0.3125);
    routeState.pathname = '/after-navigation';
    await act(async () => {
      root.render(<StrictMode><SiteTitlePhaseInitializer /></StrictMode>);
    });
    expect((phaseStyle.sheet?.cssRules[0] as CSSStyleRule).style
      .getPropertyValue('--site-title-glow-delay')).toBe('-6s');
    expect(document.documentElement.hasAttribute('style')).toBe(false);

    await act(async () => root.unmount());
  });

  it('keeps server output stable without randomness or render-time style mutation', () => {
    routeState.pathname = '/zh-tw';
    const phaseStyle = document.createElement('style');
    phaseStyle.id = SITE_TITLE_PHASE_STYLE_ID;
    document.head.append(phaseStyle);
    setSiteTitlePhase(4);
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const firstRender = renderToStaticMarkup(<SiteTitlePhaseInitializer />);
    const secondRender = renderToStaticMarkup(<SiteTitlePhaseInitializer />);

    expect(firstRender).toBe('');
    expect(secondRender).toBe(firstRender);
    expect(random).not.toHaveBeenCalled();
    expect((phaseStyle.sheet?.cssRules[0] as CSSStyleRule).style
      .getPropertyValue('--site-title-glow-delay')).toBe('-12s');
    expect(document.documentElement.hasAttribute('style')).toBe(false);
  });
});
