export interface ChartSelectionState {
  readonly pointerIndex: number | null;
  readonly keyboardIndex: number | null;
  readonly pinnedIndex: number | null;
  readonly previewIndex: number | null;
}

export type ChartSelectionAction =
  | { readonly type: 'pointer-move'; readonly index: number }
  | { readonly type: 'pointer-leave' }
  | { readonly type: 'keyboard-focus'; readonly index: number }
  | { readonly type: 'keyboard-blur' }
  | { readonly type: 'pin'; readonly index: number }
  | { readonly type: 'reset' };

export const initialChartSelectionState: ChartSelectionState = {
  pointerIndex: null,
  keyboardIndex: null,
  pinnedIndex: null,
  previewIndex: null,
};

/** 共用兩張圖的 hover、鍵盤檢視、點擊鎖定與 Escape 重設狀態。 */
export function reduceChartSelection(
  state: ChartSelectionState,
  action: ChartSelectionAction,
): ChartSelectionState {
  switch (action.type) {
    case 'pointer-move':
      return {
        ...state,
        pointerIndex: action.index,
        keyboardIndex: null,
        previewIndex: action.index,
      };
    case 'pointer-leave':
      return state.pointerIndex === null
        ? state
        : { ...state, pointerIndex: null };
    case 'keyboard-focus':
      return {
        ...state,
        pointerIndex: null,
        keyboardIndex: action.index,
        previewIndex: action.index,
      };
    case 'keyboard-blur':
      return state.keyboardIndex === null
        ? state
        : { ...state, keyboardIndex: null };
    case 'pin':
      return {
        ...state,
        pointerIndex: null,
        keyboardIndex: null,
        pinnedIndex: action.index,
        previewIndex: action.index,
      };
    case 'reset':
      return initialChartSelectionState;
  }
}

/** 指標暫時預覽優先；離開後恢復 pin，否則保留最近檢視或預設等級。 */
export function getChartSelectionIndex(
  state: ChartSelectionState,
  defaultIndex: number | null,
) {
  return state.pointerIndex
    ?? state.keyboardIndex
    ?? state.pinnedIndex
    ?? state.previewIndex
    ?? defaultIndex;
}

export const chartTouchGestureMoveThreshold = 8;

/** 判斷觸控位移是否已超過點按範圍，避免拖動或頁面捲動誤成 pin。 */
export function hasChartTouchGestureMoved(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
) {
  return Math.hypot(currentX - startX, currentY - startY)
    > chartTouchGestureMoveThreshold;
}
