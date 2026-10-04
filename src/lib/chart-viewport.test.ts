import { describe, expect, it } from 'vitest';

import {
  chartViewportMinimumSpan,
  chartViewportSliderMax,
  ensureChartViewportLevelVisible,
  getChartViewportSliderValue,
  getChartViewportTicks,
  isChartViewportFull,
  setChartViewportSliderValue,
  zoomChartViewport,
} from './chart-viewport';

const domain = { min: 1, max: 801 };

describe('chart viewport', () => {
  it('zooms around the center, stops at a readable minimum, and resets to the full domain', () => {
    const zoomed = zoomChartViewport(domain, domain, 'in');
    const deeplyZoomed = Array.from(
      { length: 20 },
      (_, index) => index,
    ).reduce((viewport) => zoomChartViewport(viewport, domain, 'in'), domain);

    expect(zoomed.max - zoomed.min).toBeCloseTo(800 / 1.5);
    expect((zoomed.min + zoomed.max) / 2).toBe(401);
    expect(deeplyZoomed.max - deeplyZoomed.min).toBeCloseTo(
      Math.max(chartViewportMinimumSpan, 800 / 64),
    );
    expect(isChartViewportFull(domain, domain)).toBe(true);
    expect(isChartViewportFull(zoomed, domain)).toBe(false);
    expect(zoomChartViewport(domain, domain, 'out')).toEqual(domain);
  });

  it('moves the slider across both domain edges while preserving the zoomed span', () => {
    const viewport = { min: 201, max: 401 };
    const leftEdge = setChartViewportSliderValue(viewport, domain, 0);
    const rightEdge = setChartViewportSliderValue(viewport, domain, chartViewportSliderMax);

    expect(leftEdge).toEqual({ min: 1, max: 201 });
    expect(rightEdge).toEqual({ min: 601, max: 801 });
    expect(rightEdge.max).toBe(domain.max);
    expect(leftEdge.max - leftEdge.min).toBe(viewport.max - viewport.min);
    expect(rightEdge.max - rightEdge.min).toBe(viewport.max - viewport.min);
    expect(setChartViewportSliderValue(viewport, domain, -10)).toEqual(leftEdge);
    expect(setChartViewportSliderValue(viewport, domain, chartViewportSliderMax + 10))
      .toEqual(rightEdge);
    expect(getChartViewportSliderValue(leftEdge, domain)).toBe(0);
    expect(getChartViewportSliderValue(rightEdge, domain)).toBe(chartViewportSliderMax);
    expect(getChartViewportSliderValue(domain, domain)).toBe(0);
    expect(setChartViewportSliderValue(domain, domain, 500)).toEqual(domain);
  });

  it('only moves enough to reveal a level while preserving span and clamping domain edges', () => {
    const viewport = { min: 201, max: 401 };

    expect(ensureChartViewportLevelVisible(viewport, domain, 300)).toBe(viewport);
    expect(ensureChartViewportLevelVisible(viewport, domain, 100)).toEqual({ min: 100, max: 300 });
    expect(ensureChartViewportLevelVisible(viewport, domain, 500)).toEqual({ min: 300, max: 500 });
    expect(ensureChartViewportLevelVisible(viewport, domain, 1)).toEqual({ min: 1, max: 201 });
    expect(ensureChartViewportLevelVisible(viewport, domain, 801)).toEqual({ min: 601, max: 801 });
    expect(ensureChartViewportLevelVisible(viewport, domain, -20)).toEqual({ min: 1, max: 201 });
    expect(ensureChartViewportLevelVisible({ min: 0, max: 900 }, domain, 500)).toEqual(domain);
    expect(ensureChartViewportLevelVisible(viewport, { min: 3, max: 3 }, 3)).toEqual({ min: 3, max: 3 });
  });

  it('zooms out from the slider edge back to the exact domain', () => {
    const zoomed = zoomChartViewport(domain, domain, 'in');
    const rightEdge = setChartViewportSliderValue(zoomed, domain, chartViewportSliderMax);

    expect(rightEdge.max).toBe(domain.max);
    expect(zoomChartViewport(rightEdge, domain, 'out')).toEqual(domain);
  });

  it('always returns five evenly spaced ticks, including at narrow viewports', () => {
    const ticks = getChartViewportTicks({ min: 10, max: 22 });

    expect(ticks).toHaveLength(5);
    expect(ticks).toEqual([10, 13, 16, 19, 22]);
  });
});
