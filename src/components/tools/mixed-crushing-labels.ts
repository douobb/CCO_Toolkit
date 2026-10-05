import type { Locale } from '@/lib/i18n';

export interface MixedCrushingUiLabels {
  readonly activity: string;
  readonly recommended: string;
  readonly manual: string;
  readonly manualControls: string;
  readonly useRecommended: string;
  readonly noRecommendation: string;
  readonly count: string;
  readonly timesUnit: string;
  readonly medical: string;
  readonly ammunition: string;
  readonly military: string;
  readonly composition: string;
  readonly output: string;
  readonly stateHint: string;
  readonly invalidCount: string;
  readonly overBudget: string;
}

export const mixedCrushingUiLabels = {
  'zh-tw': {
    activity: '混合壓碎',
    recommended: '推薦組合',
    manual: '手動組合',
    manualControls: '手動調整混合數量',
    useRecommended: '改回推薦組合',
    noRecommendation: '沒有正淨收益的混合組合',
    count: '壓碎次數',
    timesUnit: '次',
    medical: '醫療科技零件',
    ammunition: '彈藥科技零件',
    military: '軍用彈藥科技零件',
    composition: '醫療 {medical} 次 · 彈藥 {ammunition} 次 · 軍用 {military} 次',
    output: '科技碎片產出',
    stateHint: '有效數量會同步到收益總覽與固定圖表。',
    invalidCount: '請輸入 0 到 {max} 的整數。',
    overBudget: '總基準時間 {used} 秒，超過目前上限 {budget} 秒；請調整數量。',
  },
  'zh-cn': {
    activity: '混合压碎',
    recommended: '推荐组合',
    manual: '手动组合',
    manualControls: '手动调整混合数量',
    useRecommended: '改回推荐组合',
    noRecommendation: '没有正净收益的混合组合',
    count: '压碎次数',
    timesUnit: '次',
    medical: '医疗科技零件',
    ammunition: '弹药科技零件',
    military: '军用弹药科技零件',
    composition: '医疗 {medical} 次 · 弹药 {ammunition} 次 · 军用 {military} 次',
    output: '科技碎片产出',
    stateHint: '有效数量会同步到收益总览与固定图表。',
    invalidCount: '请输入 0 到 {max} 的整数。',
    overBudget: '总基准时间 {used} 秒，超过当前上限 {budget} 秒；请调整数量。',
  },
  en: {
    activity: 'Mixed crushing',
    recommended: 'Recommended mix',
    manual: 'Manual mix',
    manualControls: 'Adjust mix manually',
    useRecommended: 'Use recommended mix',
    noRecommendation: 'No mixed combination has positive net earnings',
    count: 'Crushing count',
    timesUnit: 'runs',
    medical: 'Medical tech parts',
    ammunition: 'Ammunition tech parts',
    military: 'Military ammunition parts',
    composition: 'Medical {medical} · ammunition {ammunition} · military {military}',
    output: 'Tech scrap output',
    stateHint: 'Valid counts update both the overview row and fixed chart.',
    invalidCount: 'Enter an integer from 0 to {max}.',
    overBudget: 'Base time is {used} seconds, over the current {budget}-second limit.',
  },
} satisfies Record<Locale, MixedCrushingUiLabels>;

export function formatMixedCrushingMessage(
  template: string,
  values: Readonly<Record<string, number | string>>,
): string {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replace(`{${key}}`, String(value)),
    template,
  );
}
