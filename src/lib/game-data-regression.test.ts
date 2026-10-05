import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  backpackProgressionDataEnvelopeSchema,
  backpackProgressionDataSet,
} from '@/data/game/backpack-progression';
import {
  economyDataEnvelopeSchema,
  economyDataSet,
} from '@/data/game/economy';
import {
  blackMarketDataEnvelopeSchema,
  blackMarketDataSet,
} from '@/data/game/black-market';
import {
  dungeonDataEnvelopeSchema,
  dungeonDataSet,
} from '@/data/game/dungeon';
import {
  effectsDataEnvelopeSchema,
  effectsDataSet,
} from '@/data/game/effects';
import {
  earningsActivitiesDataEnvelopeSchema,
  earningsActivitiesDataSet,
} from '@/data/game/earnings-activities';
import {
  lootBoxesDataEnvelopeSchema,
  lootBoxesDataSet,
} from '@/data/game/loot-boxes';
import {
  progressionDataEnvelopeSchema,
  progressionDataSet,
} from '@/data/game/progression';
import {
  searchRewardDataEnvelopeSchema,
  searchRewardDataSet,
} from '@/data/game/search-rewards';
import { ccoFoundDataSource } from './data-source';
import { calculateSearchReward } from './search-reward-calculator';
import { defaultSearchRewards } from './search-reward';

interface RegressionDataSet {
  readonly datasetId: string;
  readonly schemaVersion: string;
  readonly dataVersion: string;
  readonly updatedAt: string;
  readonly sources: readonly { readonly name: string; readonly url: string }[];
  readonly payload: unknown;
}

interface SafeParseSchema {
  safeParse(value: unknown): { readonly success: boolean };
}

const dataUpdateBaselines = {
  'search-rewards': {
    schemaVersion: '1.0.0',
    dataVersion: 'cco-found-initial-snapshot',
    updatedAt: '2026-08-27',
    payloadSha256: 'd6ca5c106b3938acb77fdcb5ea586286f6c9d9818141153dd879bc061bff83c9',
  },
  progression: {
    schemaVersion: '1.0.0',
    dataVersion: 'cco-found-initial-snapshot',
    updatedAt: '2026-08-28',
    payloadSha256: '03a9748ec09e87e8fd406fb3ddf8c5949128baff79883c566754c1ef1eeb2b70',
  },
  'backpack-progression': {
    schemaVersion: '1.0.0',
    dataVersion: 'cco-found-initial-snapshot',
    updatedAt: '2026-08-29',
    payloadSha256: '6b02ae6c7944dd2909df17b2be16d13d4f69a8f4bf06dfad4496b656ef7fe57d',
  },
  economy: {
    schemaVersion: '1.0.0',
    dataVersion: 'cco-found-price-update-2026-10-05',
    updatedAt: '2026-10-05',
    payloadSha256: '09dcbe21246eb8831a662efd53717c1cfdc6058ae0f9ac42f721a22f8b13f6e5',
  },
  effects: {
    schemaVersion: '1.0.0',
    dataVersion: 'cco-found-initial-snapshot',
    updatedAt: '2026-08-28',
    payloadSha256: '59f0792d8c5cb848008eb27ff9ad25bb94887198fd6fe2f8212cb2adc393102a',
  },
  'earnings-activities': {
    schemaVersion: '1.1.0',
    dataVersion: 'cco-found-pack-btc-cost-update-2026-10-05',
    updatedAt: '2026-10-05',
    payloadSha256: 'c94b6fa2b1ed08d0b9ac677b99fced3ce70f22e3963fae02b5f774cc1c3c1cb2',
  },
  'loot-boxes': {
    schemaVersion: '1.0.0',
    dataVersion: 'cco-found-initial-snapshot',
    updatedAt: '2026-08-29',
    payloadSha256: 'f1975fd04528a0666da1193bb526d1823039e7b69658014e0917c722b5728969',
  },
  'black-market': {
    schemaVersion: '1.1.0',
    dataVersion: 'cco-found-initial-snapshot',
    updatedAt: '2026-08-28',
    payloadSha256: '36f0733e92831d01bd559ffa59300d1588a8f25c04588e19d2cb4591f89a3bfd',
  },
  dungeon: {
    schemaVersion: '1.0.0',
    dataVersion: 'cco-found-initial-snapshot',
    updatedAt: '2026-08-28',
    payloadSha256: '38122d0c209ebca32eee5b3b31a79b9d47b02b1ede7623116dba90c1810f36af',
  },
} as const;

const regressionDataSets = [
  {
    name: 'search-rewards',
    dataset: searchRewardDataSet,
    schema: searchRewardDataEnvelopeSchema,
  },
  {
    name: 'progression',
    dataset: progressionDataSet,
    schema: progressionDataEnvelopeSchema,
  },
  {
    name: 'backpack-progression',
    dataset: backpackProgressionDataSet,
    schema: backpackProgressionDataEnvelopeSchema,
  },
  {
    name: 'economy',
    dataset: economyDataSet,
    schema: economyDataEnvelopeSchema,
  },
  {
    name: 'effects',
    dataset: effectsDataSet,
    schema: effectsDataEnvelopeSchema,
  },
  {
    name: 'earnings-activities',
    dataset: earningsActivitiesDataSet,
    schema: earningsActivitiesDataEnvelopeSchema,
  },
  {
    name: 'loot-boxes',
    dataset: lootBoxesDataSet,
    schema: lootBoxesDataEnvelopeSchema,
  },
  {
    name: 'black-market',
    dataset: blackMarketDataSet,
    schema: blackMarketDataEnvelopeSchema,
  },
  {
    name: 'dungeon',
    dataset: dungeonDataSet,
    schema: dungeonDataEnvelopeSchema,
  },
] satisfies ReadonlyArray<{
  readonly name: keyof typeof dataUpdateBaselines;
  readonly dataset: RegressionDataSet;
  readonly schema: SafeParseSchema;
}>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function payloadSha256(payload: unknown): string {
  const serialized = JSON.stringify(canonicalize(payload));
  if (serialized === undefined) throw new Error('資料 payload 無法序列化');
  return createHash('sha256').update(serialized).digest('hex');
}

describe('TASK-404 Game Data update regression', () => {
  it('驗證每份 dataset 的 schema、來源、版本、日期與 payload 指紋', () => {
    for (const { name, dataset, schema } of regressionDataSets) {
      const baseline = dataUpdateBaselines[name];
      expect(schema.safeParse(dataset).success, `${name} envelope／payload schema`).toBe(true);
      expect(dataset.sources, `${name} 必須保留 CCO Found 來源`).toContainEqual(ccoFoundDataSource);
      expect(dataset.schemaVersion, `${name} schemaVersion`).toBe(baseline.schemaVersion);
      expect(dataset.dataVersion, `${name} dataVersion`).toBe(baseline.dataVersion);
      expect(dataset.updatedAt, `${name} updatedAt`).toBe(baseline.updatedAt);
      expect(
        payloadSha256(dataset.payload),
        `${name} payload 已變更；確認來源後同步更新 dataVersion、updatedAt 與本檢查的 payload 指紋基線`,
      ).toBe(baseline.payloadSha256);
    }
  });

  it('維持目前各資料領域的記錄數、穩定 ID 與邊界', () => {
    const searchLevels = searchRewardDataSet.payload.map((entry) => entry.level);
    expect(searchLevels).toHaveLength(240);
    expect(new Set(searchLevels).size).toBe(searchLevels.length);
    expect(Math.min(...searchLevels)).toBe(1);
    expect(Math.max(...searchLevels)).toBe(797);

    const progression = progressionDataSet.payload;
    expect(progression.levels).toHaveLength(6);
    expect(Object.keys(progression.methods)).toHaveLength(6);
    expect(Object.values(progression.methods).flat()).toHaveLength(12);
    expect(progression.methods['scavenge-skill'].find((method) => method.id === 'scavenge')?.batchSize)
      .toBe(10);

    const earnings = earningsActivitiesDataSet.payload;
    expect(earnings.activities.find((activity) => activity.id === 'search')?.batchSize).toBe(12);

    const backpack = backpackProgressionDataSet.payload;
    expect(backpack.tiers).toHaveLength(6);
    expect(backpack.materials).toHaveLength(8);
    expect(new Set(backpack.tiers.map((tier) => tier.id)).size).toBe(6);
    expect(new Set(backpack.materials.map((material) => material.id)).size).toBe(8);

    expect(earnings.activities).toHaveLength(16);
    expect(new Set(earnings.activities.map((activity) => activity.id)).size).toBe(16);

    const lootBoxes = lootBoxesDataSet.payload;
    expect(lootBoxes.boxes).toHaveLength(3);
    expect(lootBoxes.boxes.map((box) => box.id)).toEqual(['white', 'yellow', 'purple']);
    expect(lootBoxes.boxes.map((box) =>
      box.entries.reduce((sum, entry) => sum + entry.weight, 0),
    )).toEqual([590, 5703, 1606]);

    const economy = economyDataSet.payload;
    expect(economy.currencies).toHaveLength(2);
    expect(economy.items).toHaveLength(13);
    expect(economy.prices).toHaveLength(13);
    expect(economy.exchangeRates).toHaveLength(1);
    expect(economy.cacheRates).toHaveLength(4);

    const effects = effectsDataSet.payload;
    expect(effects.statusEffects).toHaveLength(26);
    expect(effects.manualInputs).toHaveLength(2);

    const blackMarket = blackMarketDataSet.payload;
    expect(blackMarket.qualities).toHaveLength(4);
    expect(new Set(blackMarket.qualities.map((quality) => quality.id)).size).toBe(4);
    expect(blackMarket.levelRange).toEqual({ min: 1, max: 800, step: 1 });

    const dungeon = dungeonDataSet.payload;
    expect(dungeon.levelRange).toEqual({ min: 1, max: 600, step: 1 });
    expect(dungeon.prefixes).toHaveLength(8);
    expect(dungeon.summaryPrefixes).toHaveLength(7);
    expect(dungeon.enemyTypeModifiers.invasion.tiers).toHaveLength(3);
    expect(dungeon.roomOffsets).toEqual([0, 4, 7]);
  });

  it('以正式 Search Reward snapshot 保留可重現的計算結果', () => {
    expect(defaultSearchRewards).toBe(searchRewardDataSet.payload);

    const result = calculateSearchReward(defaultSearchRewards, {
      playerLevel: '350',
      searchCount: '10',
      mtPrice: '50',
      atpPrice: '100',
      matpPrice: '100',
    });

    expect(result.errors).toEqual({});
    expect(result.result?.optimalArea?.level).toBe(341);
    expect(result.result?.optimalArea?.totalExpectedValue).toBeCloseTo(
      54.289755784403475,
      10,
    );
    expect(result.result?.ladder.find((entry) => entry.level === 341)?.isCurrentOptimal)
      .toBe(true);
  });
});
