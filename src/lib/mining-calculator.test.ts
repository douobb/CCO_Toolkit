import { describe, expect, it } from 'vitest';

import {
  aiOutputPerGroup,
  calculateMining,
  MINING_LEVEL_MAX,
  miningBaseExp,
  miningBtcBase,
  miningDefaults,
  miningExpPerAction,
  neededMiningActions,
  requiredMiningExp,
} from './mining-calculator';

describe('mining calculator', () => {
  it('依規格在基礎公式明示的位置取 ceil', () => {
    expect(miningDefaults).toMatchObject({
      aiPerHash: 1.85,
      btcPerAi: 8_150,
      aiPerThousandTechScrap: 110,
    });
    expect(miningBaseExp(1)).toBe(102);
    expect(miningBaseExp(400)).toBe(960_096);
    expect(requiredMiningExp(400)).toBe(577_179_850);
    expect(miningBtcBase(400)).toBe(10_286);
  });

  it('以單次實際操作的 8 hash 計算 EXP 與 BTC，Buff 不額外取整', () => {
    expect(miningExpPerAction(1, 80)).toBe(1_468.8);
    expect(miningExpPerAction(400, 80)).toBe(13_825_382.4);
    expect(miningExpPerAction(1, 0)).toBe(816);
  });

  it('製作 AI 的階梯在 Lv.400（含）封頂 40', () => {
    expect(aiOutputPerGroup(1)).toBe(1);
    expect(aiOutputPerGroup(10)).toBe(1);
    expect(aiOutputPerGroup(11)).toBe(2);
    expect(aiOutputPerGroup(399)).toBe(40);
    expect(aiOutputPerGroup(800)).toBe(40);
  });

  it('一次製作 AI 明確分開消耗與 AI 成本', () => {
    const result = calculateMining({
      miningLevel: 400,
      aiPerHash: 1.85,
      btcPerAi: 8_150,
      aiPerThousandTechScrap: 110,
      cortexBonusPercent: 0,
      tradeExploitPercent: 0,
    });
    expect(result?.aiCraft).toMatchObject({
      hashConsumption: 2_000,
      techScrapConsumption: 1_000,
      hashCostAi: 3_700,
      techScrapCostAi: 110,
      totalCostAi: 3_810,
      revenueAi: 4_000,
      profitAi: 190,
    });
  });

  it('最低正收益固定從 Lv.1 搜尋，嚴格排除零收益', () => {
    const result = calculateMining({
      miningLevel: 1,
      aiPerHash: 1,
      btcPerAi: 1_812,
      aiPerThousandTechScrap: 100,
      cortexBonusPercent: 0,
      tradeExploitPercent: 0,
    });
    expect(result?.btc.breakEvenLevel).toBe(2);
    const aiResult = calculateMining({
      miningLevel: 1,
      aiPerHash: 0,
      btcPerAi: 0,
      aiPerThousandTechScrap: 100,
      cortexBonusPercent: 0,
      tradeExploitPercent: 0,
    });
    expect(aiResult?.aiCraft.breakEvenLevel).toBe(11);
    expect(aiResult?.aiCraft.profitAi).toBe(0);
  });

  it('每級操作數先累加，最後才取 ceil 並換算 hash', () => {
    expect(neededMiningActions(1, 11, 0)).toBe(9);
    const result = calculateMining({
      miningLevel: 1,
      aiPerHash: 0,
      btcPerAi: 0,
      aiPerThousandTechScrap: 200,
      cortexBonusPercent: 0,
      tradeExploitPercent: 0,
    });
    expect(result?.aiCraft).toMatchObject({ breakEvenLevel: 21, neededHashToProfit: 288 });
  });

  it('拒絕非整數等級、負價格與超出百分比', () => {
    expect(MINING_LEVEL_MAX).toBe(800);
    expect(calculateMining({
      miningLevel: 801,
      aiPerHash: 1,
      btcPerAi: 1,
      aiPerThousandTechScrap: 1,
      cortexBonusPercent: 0,
      tradeExploitPercent: 0,
    })).toBeNull();
    expect(calculateMining({
      miningLevel: 1.5,
      aiPerHash: 1,
      btcPerAi: 1,
      aiPerThousandTechScrap: 1,
      cortexBonusPercent: 0,
      tradeExploitPercent: 0,
    })).toBeNull();
    expect(calculateMining({
      miningLevel: 1,
      aiPerHash: -1,
      btcPerAi: 1,
      aiPerThousandTechScrap: 1,
      cortexBonusPercent: 0,
      tradeExploitPercent: 0,
    })).toBeNull();
    expect(calculateMining({
      miningLevel: 1,
      aiPerHash: 1,
      btcPerAi: 1,
      aiPerThousandTechScrap: 1,
      cortexBonusPercent: 101,
      tradeExploitPercent: 0,
    })).toBeNull();
  });
});
