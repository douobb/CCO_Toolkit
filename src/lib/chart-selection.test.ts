import { describe, expect, it } from 'vitest';

import {
  getChartSelectionIndex,
  hasChartTouchGestureMoved,
  initialChartSelectionState,
  reduceChartSelection,
} from './chart-selection';

describe('chart selection state', () => {
  it('無 pin 時 pointerleave 保留最後檢視等級', () => {
    const previewing = reduceChartSelection(initialChartSelectionState, {
      type: 'pointer-move',
      index: 42,
    });

    expect(getChartSelectionIndex(previewing, 10)).toBe(42);
    expect(getChartSelectionIndex(
      reduceChartSelection(previewing, { type: 'pointer-leave' }),
      10,
    )).toBe(42);
  });

  it('hover 優先於鍵盤記憶；已有 pin 時移動同步更新並在離開後保留', () => {
    const pinned = reduceChartSelection(initialChartSelectionState, {
      type: 'pin',
      index: 18,
    });
    const keyboard = reduceChartSelection(pinned, {
      type: 'keyboard-focus',
      index: 21,
    });
    const hovered = reduceChartSelection(keyboard, {
      type: 'pointer-move',
      index: 36,
    });

    expect(getChartSelectionIndex(hovered, 10)).toBe(36);
    expect(getChartSelectionIndex(
      reduceChartSelection(hovered, { type: 'pointer-leave' }),
      10,
    )).toBe(36);
  });

  it('觸控放開可保留 preview，取消或拖動不符合點按距離', () => {
    const previewing = reduceChartSelection(initialChartSelectionState, {
      type: 'pointer-move',
      index: 55,
    });

    expect(getChartSelectionIndex(
      reduceChartSelection(previewing, { type: 'pointer-leave' }),
      1,
    )).toBe(55);
    expect(hasChartTouchGestureMoved(20, 30, 25, 35)).toBe(false);
    expect(hasChartTouchGestureMoved(20, 30, 20, 50)).toBe(true);
    expect(hasChartTouchGestureMoved(20, 30, 40, 30)).toBe(true);
  });

  it('Escape 重設 pin 與 preview，回傳呼叫端預設等級', () => {
    const pinned = reduceChartSelection(initialChartSelectionState, {
      type: 'pin',
      index: 99,
    });

    expect(getChartSelectionIndex(
      reduceChartSelection(pinned, { type: 'reset' }),
      12,
    )).toBe(12);
  });
});
