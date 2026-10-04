import { describe, expect, it } from 'vitest';

import {
  createDefaultBackpackPlannerToolState,
} from './backpack-planner-state';
import {
  createDefaultLootBoxAnalysisState,
  type LootBoxAnalysisState,
} from './loot-box-analysis';
import {
  inspectPlayerDataFile,
  playerDataContractLimits,
} from './player-data-contract';
import {
  createPlayerDataExport,
  createPlayerDataExportFile,
  createStoredPlayerDataExport,
  downloadPlayerDataExportFile,
  serializePlayerDataExport,
} from './player-data-export';
import {
  defaultSharedUserInputs,
  sharedUserInputsSchema,
  type SharedUserInputs,
} from './shared-user-inputs';
import {
  getToolStorageKey,
  saveSharedUserInputs,
  saveToolState,
  sharedUserInputsStorageKey,
  type StorageLike,
} from './storage';

class NamedStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  readonly readKeys: string[] = [];

  get length(): number {
    throw new Error('匯出服務不可列舉 storage');
  }

  key(): string | null {
    throw new Error('匯出服務不可列舉 storage');
  }

  getItem(key: string): string | null {
    this.readKeys.push(key);
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function createSharedSnapshot(): SharedUserInputs {
  return sharedUserInputsSchema.parse({
    progression: {
      player: { level: 500 },
      skills: [
        { id: 'scavenge-skill', level: 341 },
        { id: 'mining-skill', level: 250 },
      ],
    },
    economy: {
      prices: [{ itemId: 'hash', currencyId: 'ai', amount: 999 }],
      exchangeRates: [{ id: 'btc-per-ai', value: 9000 }],
      cacheRates: [{ id: 'trash', value: 7 }],
    },
    effects: {
      buffs: [{ id: 'btc-buff-percent', percentage: 40 }],
    },
    equipment: {
      bargainPercent: 40,
      maxHealth: 1000,
      armor: 500,
      destructiveWeaponDamage: 250,
      criticalDamagePercent: 220,
      damageReductionPercent: 25,
    },
  });
}

function createBackpackState() {
  const state = createDefaultBackpackPlannerToolState();
  return {
    ...state,
    targetTierId: 'quantum-storage-unit',
    quantities: {
      ...state.quantities,
      'old-pouch': '2',
      'tech-scrap': '1200',
    },
  };
}

function createLootBoxState(): LootBoxAnalysisState {
  return {
    schemaVersion: 2,
    records: [{
      id: 'toolkit-record-1',
      recordedAt: Date.parse('2026-08-30T01:02:03.000Z'),
      boxType: 'yellow',
      openings: 8,
      drops: [
        { dropId: 'item-hash', quantity: 512 },
        { dropId: 'item-old-pouch', quantity: 1 },
      ],
    }],
    rollups: [],
  };
}

function createLargeUnknownSectionEnvelope(payload: string) {
  return {
    format: 'cco-player-data',
    formatVersion: 1,
    exportedAt: '2026-08-30T00:00:00.000Z',
    producer: { app: 'future-tool', appVersion: '1.0.0' },
    sections: [{
      id: 'future-large-section',
      schemaVersion: 1,
      data: { payload },
    }],
  };
}

describe('玩家資料網站匯出服務', () => {
  it('將共用設定解析為完整等級與玩家屬性，不匯出 economy 或 BUFF', () => {
    const result = createPlayerDataExport(
      { sharedUserInputs: createSharedSnapshot() },
      { exportedAt: new Date('2026-08-30T00:00:00.000Z') },
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.envelope.sections.map((section) => section.id)).toEqual([
      'progression',
      'player-attributes',
    ]);
    const text = JSON.stringify(result.envelope);
    expect(text).toContain('"scavenge-skill","value":341');
    expect(text).toContain('"printing-rank","value":1');
    expect(text).toContain('"critical-damage-percent","value":220');
    expect(text).not.toMatch(/prices|exchangeRates|cacheRates|buffs|btc-buff-percent/);
  });

  it('只匯出背包物品數量，不帶入目標背包或科技碎片等值結果', () => {
    const result = createPlayerDataExport(
      {
        sharedUserInputs: defaultSharedUserInputs,
        backpackPlannerState: createBackpackState(),
      },
      { exportedAt: new Date('2026-08-30T00:00:00.000Z') },
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    const inventory = result.envelope.sections.find((section) => section.id === 'inventory');
    expect(inventory).toMatchObject({
      id: 'inventory',
      schemaVersion: 1,
      data: {
        completeness: 'manual',
        items: expect.arrayContaining([
          { itemId: 'old-pouch', quantity: 2 },
          { itemId: 'tech-scrap', quantity: 1200 },
        ]),
      },
    });
    expect(inventory?.data).not.toHaveProperty('targetTierId');
    expect(inventory?.data).not.toHaveProperty('techScrapEquivalent');
  });

  it('將網站開箱毫秒時間轉成 ISO 8601，且不匯出價值或模擬結果', () => {
    const result = createPlayerDataExport(
      {
        sharedUserInputs: defaultSharedUserInputs,
        lootBoxAnalysisState: createLootBoxState(),
      },
      { exportedAt: new Date('2026-08-30T00:00:00.000Z') },
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    const history = result.envelope.sections.find(
      (section) => section.id === 'loot-box-history',
    );
    expect(history).toMatchObject({
      data: {
        records: [{
          id: 'toolkit-record-1',
          recordedAt: '2026-08-30T01:02:03.000Z',
          boxType: 'yellow',
          openings: 8,
        }],
        rollups: [],
      },
    });
    expect(JSON.stringify(history)).not.toMatch(/gross|net|price|simulation|percentile/);
  });

  it('拒絕背包無效草稿、無效匯出日期與無法轉換的開箱日期', () => {
    const invalidBackpack = createBackpackState();
    invalidBackpack.quantities['tech-scrap'] = '-1';
    const backpackResult = createPlayerDataExport({
      sharedUserInputs: defaultSharedUserInputs,
      backpackPlannerState: invalidBackpack,
    });
    expect(backpackResult).toMatchObject({
      success: false,
      issues: [{ source: 'inventory', path: ['quantities', 'tech-scrap'] }],
    });

    const invalidExportDate = createPlayerDataExport(
      { sharedUserInputs: defaultSharedUserInputs },
      { exportedAt: new Date(Number.NaN) },
    );
    expect(invalidExportDate).toMatchObject({
      success: false,
      issues: [{ source: 'contract', path: ['exportedAt'] }],
    });

    const validHistory = createLootBoxState();
    const invalidHistory: LootBoxAnalysisState = {
      ...validHistory,
      records: validHistory.records.map((record, index) =>
        index === 0 ? { ...record, recordedAt: Number.MAX_SAFE_INTEGER } : record),
    };
    const historyResult = createPlayerDataExport({
      sharedUserInputs: defaultSharedUserInputs,
      lootBoxAnalysisState: invalidHistory,
    });
    expect(historyResult).toMatchObject({
      success: false,
      issues: [{ source: 'loot-box-history', path: ['records', 0, 'recordedAt'] }],
    });
  });

  it('只透過具名 storage API 讀取三個正式來源', () => {
    const storage = new NamedStorage();
    const backpack = createBackpackState();
    const history = createLootBoxState();
    expect(saveSharedUserInputs(createSharedSnapshot(), { storage })).toBe(true);
    expect(saveToolState('backpack-planner', backpack, { storage })).toBe(true);
    expect(saveToolState('loot-box-analysis', history, { storage })).toBe(true);

    const result = createStoredPlayerDataExport({
      storage,
      exportedAt: new Date('2026-08-30T00:00:00.000Z'),
    });

    expect(result.success).toBe(true);
    expect(storage.readKeys).toEqual([
      sharedUserInputsStorageKey,
      getToolStorageKey('backpack-planner'),
      getToolStorageKey('loot-box-analysis'),
    ]);
    if (!result.success) return;
    expect(result.envelope.sections.map((section) => section.id)).toEqual([
      'progression',
      'player-attributes',
      'inventory',
      'loot-box-history',
    ]);
  });

  it('儲存空間不可用或共用設定版本不支援時不產生誤導性備份', () => {
    expect(createStoredPlayerDataExport({ storage: null })).toMatchObject({
      success: false,
      issues: [{ source: 'storage' }],
    });

    const storage = new NamedStorage();
    storage.setItem(sharedUserInputsStorageKey, JSON.stringify({
      storageVersion: 999,
      schemaVersion: 999,
      value: {},
    }));
    expect(createStoredPlayerDataExport({ storage })).toMatchObject({
      success: false,
      issues: [{ source: 'shared-user-inputs' }],
    });
  });

  it('產生固定檔名、MIME、UTF-8 JSON，且可由契約重新解析', () => {
    const result = createPlayerDataExport(
      {
        sharedUserInputs: createSharedSnapshot(),
        backpackPlannerState: createBackpackState(),
        lootBoxAnalysisState: createLootBoxState(),
      },
      { exportedAt: new Date('2026-08-30T23:59:59.000Z') },
    );
    expect(result.success).toBe(true);
    if (!result.success) return;

    const serialized = serializePlayerDataExport(result.envelope);
    const file = createPlayerDataExportFile(result.envelope);
    expect(serialized).toBeDefined();
    expect(file).toMatchObject({
      filename: 'cco-player-data-2026-08-30.json',
      mimeType: 'application/json',
    });
    expect(file?.text.endsWith('\n')).toBe(true);
    expect(file?.size).toBe(new TextEncoder().encode(file?.text).byteLength);
    const decoded = JSON.parse(file?.text ?? '') as unknown;
    expect(decoded).toEqual(result.envelope);
    const inspected = inspectPlayerDataFile(decoded);
    expect(inspected.success).toBe(true);
    if (inspected.success) {
      expect(inspected.unsupportedSections).toEqual([]);
      expect(inspected.supportedSections).toHaveLength(4);
    }
  });

  it('檔案恰好 5 MB 可建立，超過上限則不建立下載檔', () => {
    const base = createLargeUnknownSectionEnvelope('');
    const baseText = serializePlayerDataExport(base);
    expect(baseText).toBeDefined();
    if (!baseText) return;

    const baseSize = new TextEncoder().encode(baseText).byteLength;
    const payload = 'x'.repeat(playerDataContractLimits.maxFileBytes - baseSize);
    const exact = createLargeUnknownSectionEnvelope(payload);
    const exactText = serializePlayerDataExport(exact);
    expect(exactText).toBeDefined();
    if (!exactText) return;
    expect(new TextEncoder().encode(exactText).byteLength).toBe(
      playerDataContractLimits.maxFileBytes,
    );
    expect(createPlayerDataExportFile(exact)).toMatchObject({
      size: playerDataContractLimits.maxFileBytes,
    });

    expect(createPlayerDataExportFile(
      createLargeUnknownSectionEnvelope(`${payload}x`),
    )).toBeUndefined();
  });

  it('非瀏覽器環境不嘗試下載檔案', () => {
    const result = createPlayerDataExport(
      { sharedUserInputs: defaultSharedUserInputs },
      { exportedAt: new Date('2026-08-30T00:00:00.000Z') },
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    const file = createPlayerDataExportFile(result.envelope);
    expect(file).toBeDefined();
    if (!file) return;

    expect(downloadPlayerDataExportFile(file)).toBe(false);
  });

  it('空開箱狀態仍是合法且明確的紀錄 section', () => {
    const result = createPlayerDataExport({
      sharedUserInputs: defaultSharedUserInputs,
      lootBoxAnalysisState: createDefaultLootBoxAnalysisState(),
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.envelope.sections.at(-1)).toMatchObject({
      id: 'loot-box-history',
      data: { records: [], rollups: [] },
    });
  });
});
