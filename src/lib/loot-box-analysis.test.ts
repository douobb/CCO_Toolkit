import { describe, expect, it } from 'vitest';

import {
  getLootBoxDropDefinition,
  getLootBoxDropIdsForBox,
} from '@/data/game/loot-box-drops';
import { resolveMarketPrices } from './market-prices';
import {
  calculateLootBoxTypeAnalysis,
  createLootBoxAnalysisRecord,
  createDefaultLootBoxAnalysisState,
  isLootBoxAnalysisState,
  maxLootBoxAnalysisDropsPerEntry,
  maxLootBoxAnalysisRecords,
  maxLootBoxAnalysisRollups,
  simulateLootBoxValues,
  summarizeLootBoxSimulation,
  upsertLootBoxAnalysisRecord,
  valueOfLootBoxAnalysisRecord,
  lootBoxAnalysisRollupBatchSize,
  type LootBoxAnalysisState,
} from './loot-box-analysis';

function getStateTotals(state: LootBoxAnalysisState): {
  readonly recordCount: number;
  readonly openings: number;
  readonly drops: Readonly<Record<string, number>>;
} {
  const drops = new Map<string, number>();
  let recordCount = 0;
  let openings = 0;
  for (const record of state.records) {
    recordCount += 1;
    openings += record.openings;
    for (const drop of record.drops) {
      drops.set(drop.dropId, (drops.get(drop.dropId) ?? 0) + drop.quantity);
    }
  }
  for (const rollup of state.rollups) {
    recordCount += rollup.recordCount;
    openings += rollup.openings;
    for (const drop of rollup.drops) {
      drops.set(drop.dropId, (drops.get(drop.dropId) ?? 0) + drop.quantity);
    }
  }
  return { recordCount, openings, drops: Object.fromEntries(drops) };
}

describe('loot box analysis', () => {
  it('以實際開箱數計算，並依箱型 batch size 驗證單筆紀錄上限', () => {
    const prices = resolveMarketPrices();
    const record = createLootBoxAnalysisRecord({
      id: 'record-1',
      recordedAt: 0,
      boxType: 'white',
      openings: 1,
      drops: [
        { dropId: 'item-hash', quantity: 16 },
        { dropId: 'item-ai-core', quantity: 2 },
      ],
    });
    const analysis = calculateLootBoxTypeAnalysis('white', [record], prices);

    expect(analysis.openings).toBe(1);
    expect(analysis.actualGrossAi).toBe(16 * 1.85 + 2);
    expect(analysis.actualNetAi).toBe(
      analysis.actualGrossAi! - (3000 / 8450 + 32 * 110 / 1000),
    );
    expect(analysis.drops.find((drop) => drop.dropId === 'item-hash')).toMatchObject({
      actualQuantity: 16,
      expectedQuantity: expect.any(Number),
      actualValueAi: 16 * 1.85,
    });
  });

  it('沿用目前共用物價重新估值歷史紀錄', () => {
    const record = createLootBoxAnalysisRecord({
      id: 'record-2',
      recordedAt: 0,
      boxType: 'yellow',
      openings: 2,
      drops: [{ dropId: 'item-hash', quantity: 64 }],
    });
    const defaultValue = valueOfLootBoxAnalysisRecord(record, resolveMarketPrices());
    const changedValue = valueOfLootBoxAnalysisRecord(record, resolveMarketPrices({
      economy: {
        prices: [{ itemId: 'hash', currencyId: 'ai', amount: 5 }],
        exchangeRates: [],
        cacheRates: [],
      },
    }));

    expect(defaultValue).toBe(64 * 1.85);
    expect(changedValue).toBe(64 * 5);
  });

  it('將匯入 rollup 納入紀錄數、開箱數與掉落統計', () => {
    const analysis = calculateLootBoxTypeAnalysis(
      'yellow',
      [],
      resolveMarketPrices(),
      [{
        id: 'rollup-1',
        boxType: 'yellow',
        recordCount: 3,
        openings: 16,
        drops: [{ dropId: 'item-hash', quantity: 1024 }],
      }],
    );

    expect(analysis.recordCount).toBe(3);
    expect(analysis.openings).toBe(16);
    expect(analysis.drops.find((drop) => drop.dropId === 'item-hash')).toMatchObject({
      actualQuantity: 1024,
    });
  });

  it('第 2,001 筆紀錄彙整最舊 100 筆、按箱型保留總量，且 rollup ID 穩定唯一', () => {
    const initialRecords = Array.from({ length: maxLootBoxAnalysisRecords }, (_, index) =>
      createLootBoxAnalysisRecord({
        id: `record-${index}`,
        recordedAt: index + 1,
        boxType: index < 40 ? 'white' : 'yellow',
        openings: 1,
        drops: [{ dropId: 'item-hash', quantity: index + 1 }],
      }));
    const initialState = initialRecords.reduce(
      (state, record) => upsertLootBoxAnalysisRecord(state, record),
      createDefaultLootBoxAnalysisState(),
    );
    const initialTotals = getStateTotals(initialState);
    const nextState = upsertLootBoxAnalysisRecord(initialState, createLootBoxAnalysisRecord({
      id: 'record-newest',
      recordedAt: maxLootBoxAnalysisRecords + 1,
      boxType: 'yellow',
      openings: 1,
      drops: [{ dropId: 'item-hash', quantity: 1 }],
    }));

    expect(nextState.records).toHaveLength(
      maxLootBoxAnalysisRecords - lootBoxAnalysisRollupBatchSize + 1,
    );
    expect(nextState.rollups).toHaveLength(2);
    expect(nextState.rollups.find((rollup) => rollup.boxType === 'white')).toMatchObject({
      id: 'loot-box-rollup-white',
      recordCount: 40,
      openings: 40,
      drops: [{ dropId: 'item-hash', quantity: 820 }],
    });
    expect(nextState.rollups.find((rollup) => rollup.boxType === 'yellow')).toMatchObject({
      id: 'loot-box-rollup-yellow',
      recordCount: 60,
      openings: 60,
      drops: [{ dropId: 'item-hash', quantity: 4_230 }],
    });
    expect(getStateTotals(nextState)).toEqual({
      recordCount: initialTotals.recordCount + 1,
      openings: initialTotals.openings + 1,
      drops: { 'item-hash': (initialTotals.drops['item-hash'] ?? 0) + 1 },
    });
    const ids = [
      ...nextState.records.map((record) => record.id),
      ...nextState.rollups.map((rollup) => rollup.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(isLootBoxAnalysisState(nextState)).toBe(true);

    const yellowRollupId = nextState.rollups.find((rollup) => rollup.boxType === 'yellow')?.id;
    let twiceCompacted = nextState;
    for (let index = 0; index < lootBoxAnalysisRollupBatchSize; index += 1) {
      twiceCompacted = upsertLootBoxAnalysisRecord(twiceCompacted, createLootBoxAnalysisRecord({
        id: `later-record-${index}`,
        recordedAt: maxLootBoxAnalysisRecords + 2 + index,
        boxType: 'yellow',
        openings: 1,
        drops: [{ dropId: 'item-hash', quantity: 1 }],
      }));
    }
    expect(twiceCompacted.rollups.find((rollup) => rollup.boxType === 'yellow')?.id)
      .toBe(yellowRollupId);
    expect(getStateTotals(twiceCompacted).recordCount).toBe(initialTotals.recordCount + 1 + 100);
  });

  it('同步拒絕超過 records、rollups、單 entry drops 上限及跨集合重複 ID', () => {
    const record = createLootBoxAnalysisRecord({
      id: 'limit-record',
      recordedAt: 1,
      boxType: 'yellow',
      openings: 1,
      drops: [{ dropId: 'item-hash', quantity: 1 }],
    });
    const state = upsertLootBoxAnalysisRecord(createDefaultLootBoxAnalysisState(), record);
    const rollup = {
      id: 'limit-rollup',
      boxType: 'yellow' as const,
      recordCount: 1,
      openings: 1,
      drops: [{ dropId: 'item-hash' as const, quantity: 1 }],
    };

    expect(isLootBoxAnalysisState({
      ...state,
      records: Array.from({ length: maxLootBoxAnalysisRecords + 1 }, (_, index) => ({
        ...record,
        id: `record-${index}`,
        recordedAt: index,
      })),
    })).toBe(false);
    expect(isLootBoxAnalysisState({
      ...state,
      rollups: Array.from({ length: maxLootBoxAnalysisRollups + 1 }, (_, index) => ({
        ...rollup,
        id: `rollup-${index}`,
      })),
    })).toBe(false);
    expect(isLootBoxAnalysisState({
      ...state,
      records: [{
        ...record,
        drops: Array.from({ length: maxLootBoxAnalysisDropsPerEntry + 1 }, (_, index) => ({
          dropId: 'item-hash' as const,
          quantity: index + 1,
        })),
      }],
    })).toBe(false);
    expect(isLootBoxAnalysisState({
      ...state,
      rollups: [{ ...rollup, id: record.id }],
    })).toBe(false);
  });

  it('rollups 已達上限時，新增缺少的箱型摘要會先合併同箱型而不突破上限', () => {
    const state: LootBoxAnalysisState = {
      ...createDefaultLootBoxAnalysisState(),
      records: Array.from({ length: maxLootBoxAnalysisRecords }, (_, index) =>
        createLootBoxAnalysisRecord({
          id: `purple-record-${index}`,
          recordedAt: index + 1,
          boxType: 'purple',
          openings: 1,
          drops: [{ dropId: 'item-ai-core', quantity: 1 }],
        })),
      rollups: Array.from({ length: maxLootBoxAnalysisRollups }, (_, index) => ({
        id: `white-rollup-${index}`,
        boxType: 'white' as const,
        recordCount: 1,
        openings: 1,
        drops: [{ dropId: 'item-hash' as const, quantity: 1 }],
      })),
    };
    const nextState = upsertLootBoxAnalysisRecord(state, createLootBoxAnalysisRecord({
      id: 'purple-newest',
      recordedAt: maxLootBoxAnalysisRecords + 1,
      boxType: 'purple',
      openings: 1,
      drops: [{ dropId: 'item-ai-core', quantity: 1 }],
    }));

    expect(nextState.rollups).toHaveLength(maxLootBoxAnalysisRollups);
    expect(nextState.rollups.find((rollup) => rollup.boxType === 'purple')).toMatchObject({
      recordCount: lootBoxAnalysisRollupBatchSize,
      openings: lootBoxAnalysisRollupBatchSize,
    });
    expect(isLootBoxAnalysisState(nextState)).toBe(true);
  });

  it('拒絕未知、重複或不屬於箱型的本機紀錄', () => {
    const state = createDefaultLootBoxAnalysisState();
    const valid = upsertLootBoxAnalysisRecord(state, createLootBoxAnalysisRecord({
      id: 'record-3',
      recordedAt: 0,
      boxType: 'purple',
      openings: 3,
      drops: [{ dropId: 'item-ai-core', quantity: 32 }],
    }));

    expect(isLootBoxAnalysisState(valid)).toBe(true);
    expect(isLootBoxAnalysisState({
      ...valid,
      records: [{
        ...valid.records[0],
        boxType: 'white',
        openings: 13,
      }],
    })).toBe(false);
    expect(isLootBoxAnalysisState({
      ...valid,
      records: [{
        ...valid.records[0],
        drops: [{ dropId: 'item-old-pouch', quantity: 1 }],
      }],
    })).toBe(false);
    expect(isLootBoxAnalysisState({
      ...valid,
      records: [
        ...valid.records,
        { ...valid.records[0] },
      ],
    })).toBe(false);
  });

  it('所有箱子目前的掉落都有 Helper 對照名稱，且模擬結果可重現', () => {
    for (const boxId of ['white', 'yellow', 'purple'] as const) {
      expect(getLootBoxDropIdsForBox(boxId).length).toBeGreaterThan(0);
      for (const dropId of getLootBoxDropIdsForBox(boxId)) {
        expect(getLootBoxDropDefinition(dropId).labels['zh-tw']).not.toBe('');
        expect(getLootBoxDropDefinition(dropId).labels['zh-cn']).not.toBe('');
        expect(getLootBoxDropDefinition(dropId).labels.en).not.toBe('');
      }
    }

    const prices = resolveMarketPrices();
    const first = simulateLootBoxValues('white', 3, 20, prices, 7);
    const second = simulateLootBoxValues('white', 3, 20, prices, 7);
    expect(first).toEqual(second);
    expect(first).toHaveLength(20);

    const summary = summarizeLootBoxSimulation('white', 3, first!, first![0]!);
    expect(summary?.simulations).toBe(20);
    expect(summary?.percentile).toBeTypeOf('number');
  });
});
