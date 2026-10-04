// @vitest-environment happy-dom

import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { routeState } = vi.hoisted(() => ({ routeState: { pathname: '/zh-tw' } }));

vi.mock('fumadocs-core/framework', () => ({
  usePathname: () => routeState.pathname,
}));

import { SiteTitlePhaseInitializer } from './site-title-phase-initializer';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.style.removeProperty('--site-title-glow-delay');
  vi.restoreAllMocks();
});

describe('SiteTitlePhaseInitializer', () => {
  it('selects all eight discrete phases and changes phase only when the pathname changes', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    for (let phase = 0; phase < 8; phase += 1) {
      random.mockReturnValue((phase + 0.5) / 8);
      routeState.pathname = `/phase-${phase}`;
      await act(async () => {
        root.render(<StrictMode><SiteTitlePhaseInitializer /></StrictMode>);
      });
      expect(document.documentElement.style.getPropertyValue('--site-title-glow-delay'))
        .toBe(`${phase === 0 ? 0 : -phase * 3}s`);
    }

    random.mockReturnValue(0.99);
    await act(async () => {
      root.render(<StrictMode><SiteTitlePhaseInitializer /></StrictMode>);
    });
    expect(document.documentElement.style.getPropertyValue('--site-title-glow-delay')).toBe('-21s');

    random.mockReturnValue(0.3125);
    routeState.pathname = '/after-navigation';
    await act(async () => {
      root.render(<StrictMode><SiteTitlePhaseInitializer /></StrictMode>);
    });
    expect(document.documentElement.style.getPropertyValue('--site-title-glow-delay')).toBe('-6s');

    await act(async () => root.unmount());
  });

  it('keeps server output stable without randomness or render-time style mutation', () => {
    routeState.pathname = '/zh-tw';
    document.documentElement.style.setProperty('--site-title-glow-delay', '0s');
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const firstRender = renderToStaticMarkup(<SiteTitlePhaseInitializer />);
    const secondRender = renderToStaticMarkup(<SiteTitlePhaseInitializer />);

    expect(firstRender).toBe('');
    expect(secondRender).toBe(firstRender);
    expect(random).not.toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue('--site-title-glow-delay')).toBe('0s');
  });
});
