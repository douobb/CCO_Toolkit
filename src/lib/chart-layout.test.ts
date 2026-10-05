import { describe, expect, it } from 'vitest';

import { getResponsiveChartDimensions } from './chart-layout';

describe('responsive chart dimensions', () => {
  const insets = {
    compactTop: 24,
    wideTop: 30,
  };

  it('以容器寬度配置手機高度，並保留軸刻度安全空間', () => {
    const narrow = getResponsiveChartDimensions(320, insets);
    const medium = getResponsiveChartDimensions(360, insets);
    const wideMobile = getResponsiveChartDimensions(400, insets);

    expect([narrow.width, medium.width, wideMobile.width]).toEqual([320, 360, 400]);
    expect([narrow.height, medium.height, wideMobile.height]).toEqual([210, 220, 230]);
    expect([narrow.left, narrow.right, narrow.bottom]).toEqual([44, 8, 44]);
  });

  it('沿用桌面高度比例與 400px 上限', () => {
    expect(getResponsiveChartDimensions(500, insets).height).toBe(255);
    expect(getResponsiveChartDimensions(639, insets).height).toBe(290);
    expect(getResponsiveChartDimensions(640, insets).height).toBe(320);
    expect(getResponsiveChartDimensions(960, insets).height).toBe(400);
    expect(getResponsiveChartDimensions(1280, insets).height).toBe(400);
  });
});
