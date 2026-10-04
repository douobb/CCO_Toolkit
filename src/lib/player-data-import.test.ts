import { describe, expect, it } from 'vitest';

import { createDefaultBackpackPlannerToolState } from './backpack-planner-state';
import {
  isLootBoxAnalysisState,
  lootBoxAnalysisSchemaVersion,
  type LootBoxAnalysisState,
} from './loot-box-analysis';
import {
  commitPlayerDataImport,
  prepareStoredPlayerDataImport,
} from './player-data-import';
import {
  createPlayerDataExportFile,
  createStoredPlayerDataExport,
} from './player-data-export';
import { playerDataContractLimits } from './player-data-contract';
import {
  defaultSharedUserInputs,
  sharedUserInputsSchema,
  type SharedUserInputs,
} from './shared-user-inputs';
import {
  getToolStorageKey,
  loadSharedUserInputs,
  loadToolState,
  saveSharedUserInputs,
  saveToolState,
  type StorageLike,
} from './storage';

class TransactionStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  private setCall = 0;
  private failSetCalls = new Set<number>();

  get length() {
    return this.values.size;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.setCall += 1;
    if (this.failSetCalls.has(this.setCall)) throw new Error(`setItem ${this.setCall} failed`);
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  failOnRelativeSetCalls(...calls: number[]) {
    this.failSetCalls = new Set(calls.map((call) => this.setCall + call));
  }
}

function createSharedSnapshot(overrides: {
  readonly level?: number;
  readonly skills?: readonly { id: 'mining-skill' | 'scavenge-skill'; level: number }[];
  readonly maxHealth?: number;
  readonly armor?: number;
} = {}): SharedUserInputs {
  return sharedUserInputsSchema.parse({
    progression: {
      player: { level: overrides.level ?? 100 },
      skills: overrides.skills ?? [],
    },
    economy: {
      prices: [{ itemId: 'hash', currencyId: 'ai', amount: 9.5 }],
      exchangeRates: [{ id: 'btc-per-ai', value: 8150 }],
      cacheRates: [{ id: 'trash', value: 9 }],
    },
    effects: {
      buffs: [{ id: 'btc-buff-percent', percentage: 40 }],
    },
    equipment: {
      maxHealth: overrides.maxHealth ?? 1000,
      ...(overrides.armor === undefined ? {} : { armor: overrides.armor }),
    },
  });
}

function createEnvelope(sections: readonly unknown[]) {
  return JSON.stringify({
    format: 'cco-player-data',
    formatVersion: 1,
    exportedAt: '2026-08-30T00:00:00.000Z',
    producer: { app: 'cco-toolkit', appVersion: '0.1.0' },
    sections,
  });
}

function progressionSection(level = 200, mining = 80) {
  return {
    id: 'progression',
    schemaVersion: 1,
    data: {
      levels: [
        { id: 'level', value: level },
        { id: 'mining-skill', value: mining },
      ],
    },
  };
}

function attributesSection() {
  return {
    id: 'player-attributes',
    schemaVersion: 1,
    data: {
      values: [
        { id: 'max-health', value: 2000 },
        { id: 'armor', value: 500 },
      ],
    },
  };
}

function inventorySection(
  completeness: 'manual' | 'partial' | 'complete',
  items = [{ itemId: 'tech-scrap', quantity: 20 }],
) {
  return {
    id: 'inventory',
    schemaVersion: 1,
    data: { completeness, items },
  };
}

function lootBoxSection() {
  return {
    id: 'loot-box-history',
    schemaVersion: 1,
    data: {
      records: [{
        id: 'portable-record-1',
        recordedAt: '2026-08-30T01:00:00.000Z',
        boxType: 'white',
        openings: 12,
        drops: [{ dropId: 'item-hash', quantity: 192 }],
      }],
      rollups: [{
        id: 'portable-rollup-1',
        boxType: 'yellow',
        recordCount: 2,
        openings: 16,
        drops: [{ dropId: 'item-old-pouch', quantity: 2 }],
      }],
    },
  };
}

function createBackpackState(techScrap = '10', oldPouch = '5') {
  const state = createDefaultBackpackPlannerToolState();
  return {
    ...state,
    quantities: {
      ...state.quantities,
      'tech-scrap': techScrap,
      'old-pouch': oldPouch,
    },
  };
}

describe('玩家資料匯入計畫與原子提交', () => {
  it('在寫入前拒絕超量、無效 JSON 與不符合契約的檔案', () => {
    const storage = new TransactionStorage();
    expect(prepareStoredPlayerDataImport('{bad', { storage })).toMatchObject({
      success: false,
      issues: [{ code: 'invalid-json' }],
    });
    expect(prepareStoredPlayerDataImport('x'.repeat(5 * 1024 * 1024 + 1), {
      storage,
    })).toMatchObject({
      success: false,
      issues: [{ code: 'file-too-large' }],
    });

    const atLimit = createEnvelope([progressionSection(1, 1)]).padEnd(
      playerDataContractLimits.maxFileBytes,
      ' ',
    );
    expect(new TextEncoder().encode(atLimit).byteLength).toBe(
      playerDataContractLimits.maxFileBytes,
    );
    const atLimitResult = prepareStoredPlayerDataImport(atLimit, { storage });
    expect(atLimitResult.success).toBe(true);

    const invalidContract = prepareStoredPlayerDataImport(JSON.stringify({ format: 'wrong' }), {
      storage,
    });
    expect(invalidContract.success).toBe(false);
    if (invalidContract.success) return;
    expect(invalidContract.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid-contract' }),
    ]));

    const unsupportedEnvelope = JSON.parse(createEnvelope([progressionSection()])) as {
      formatVersion: number;
    };
    unsupportedEnvelope.formatVersion = 2;
    expect(prepareStoredPlayerDataImport(JSON.stringify(unsupportedEnvelope), {
      storage,
    })).toMatchObject({
      success: false,
      issues: [expect.objectContaining({ code: 'invalid-contract' })],
    });
    expect(storage.length).toBe(0);
  });

  it('網站匯出產物可直接預覽、提交並再次匯出相同可攜資料', () => {
    const sourceStorage = new TransactionStorage();
    const sourceLootBox: LootBoxAnalysisState = {
      schemaVersion: lootBoxAnalysisSchemaVersion,
      records: [{
        id: 'roundtrip-record-1',
        recordedAt: Date.parse('2026-08-30T01:00:00.000Z'),
        boxType: 'white',
        openings: 12,
        drops: [{ dropId: 'item-hash', quantity: 192 }],
      }],
      rollups: [{
        id: 'roundtrip-rollup-1',
        boxType: 'yellow',
        recordCount: 2,
        openings: 16,
        drops: [{ dropId: 'item-old-pouch', quantity: 2 }],
      }],
    };
    expect(saveSharedUserInputs(createSharedSnapshot({ level: 300 }), {
      storage: sourceStorage,
    })).toBe(true);
    expect(saveToolState('backpack-planner', createBackpackState('120', '3'), {
      storage: sourceStorage,
    })).toBe(true);
    expect(saveToolState('loot-box-analysis', sourceLootBox, {
      storage: sourceStorage,
    })).toBe(true);

    const exported = createStoredPlayerDataExport({
      storage: sourceStorage,
      exportedAt: new Date('2026-08-30T00:00:00.000Z'),
    });
    expect(exported.success).toBe(true);
    if (!exported.success) return;
    const file = createPlayerDataExportFile(exported.envelope);
    expect(file).toBeDefined();
    if (!file) return;

    const targetStorage = new TransactionStorage();
    const prepared = prepareStoredPlayerDataImport(file.text, {
      storage: targetStorage,
      progressionStrategy: 'overwrite',
      playerAttributesStrategy: 'overwrite',
    });
    expect(prepared.success).toBe(true);
    if (!prepared.success) return;
    expect(targetStorage.length).toBe(0);

    expect(commitPlayerDataImport(prepared.plan, { storage: targetStorage })).toMatchObject({
      success: true,
    });
    const reExported = createStoredPlayerDataExport({
      storage: targetStorage,
      exportedAt: new Date('2026-08-30T00:00:00.000Z'),
    });
    expect(reExported).toEqual(exported);
  });

  it('預設只填缺少的等級／屬性，保留衝突現值及 economy／BUFF', () => {
    const storage = new TransactionStorage();
    expect(saveSharedUserInputs(createSharedSnapshot(), { storage })).toBe(true);
    const prepared = prepareStoredPlayerDataImport(
      createEnvelope([progressionSection(), attributesSection()]),
      { storage },
    );

    expect(prepared.success).toBe(true);
    if (!prepared.success) return;
    expect(Object.isFrozen(prepared.plan)).toBe(true);
    expect(prepared.plan.source).toMatchObject({
      formatVersion: 1,
      exportedAt: '2026-08-30T00:00:00.000Z',
      producer: { app: 'cco-toolkit', appVersion: '0.1.0' },
    });
    expect(prepared.plan.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'level', action: 'keep', conflict: true }),
      expect.objectContaining({ key: 'mining-skill', action: 'add', conflict: false }),
      expect.objectContaining({ key: 'max-health', action: 'keep', conflict: true }),
      expect.objectContaining({ key: 'armor', action: 'add', conflict: false }),
    ]));

    const commit = commitPlayerDataImport(prepared.plan, { storage });
    expect(commit.success).toBe(true);
    const imported = loadSharedUserInputs({ storage }).value;
    expect(imported.progression.player.level).toBe(100);
    expect(imported.progression.skills).toContainEqual({ id: 'mining-skill', level: 80 });
    expect(imported.equipment).toMatchObject({ maxHealth: 1000, armor: 500 });
    expect(imported.economy.prices).toContainEqual({
      itemId: 'hash', currencyId: 'ai', amount: 9.5,
    });
    expect(imported.effects.buffs).toContainEqual({
      id: 'btc-buff-percent', percentage: 40,
    });
  });

  it('只有明確選擇 overwrite 時才覆寫既有等級與戰鬥值', () => {
    const storage = new TransactionStorage();
    saveSharedUserInputs(createSharedSnapshot(), { storage });
    const prepared = prepareStoredPlayerDataImport(
      createEnvelope([progressionSection(), attributesSection()]),
      {
        storage,
        progressionStrategy: 'overwrite',
        playerAttributesStrategy: 'overwrite',
      },
    );
    expect(prepared.success).toBe(true);
    if (!prepared.success) return;
    expect(commitPlayerDataImport(prepared.plan, { storage }).success).toBe(true);

    const imported = loadSharedUserInputs({ storage }).value;
    expect(imported.progression.player.level).toBe(200);
    expect(imported.equipment.maxHealth).toBe(2000);
  });

  it('partial／manual inventory 只更新列出項目', () => {
    const storage = new TransactionStorage();
    saveToolState('backpack-planner', createBackpackState(), { storage });
    const prepared = prepareStoredPlayerDataImport(
      createEnvelope([inventorySection('partial')]),
      { storage },
    );
    expect(prepared.success).toBe(true);
    if (!prepared.success) return;
    expect(commitPlayerDataImport(prepared.plan, { storage }).success).toBe(true);

    const imported = loadToolState('backpack-planner', { storage }) as ReturnType<
      typeof createBackpackState
    >;
    expect(imported.quantities['tech-scrap']).toBe('20');
    expect(imported.quantities['old-pouch']).toBe('5');
  });

  it('complete inventory 只有明確確認後才整體取代並清零未列出項目', () => {
    const storage = new TransactionStorage();
    saveToolState('backpack-planner', createBackpackState(), { storage });
    const text = createEnvelope([inventorySection('complete')]);

    expect(prepareStoredPlayerDataImport(text, {
      storage,
      inventoryStrategy: 'replace',
    })).toMatchObject({
      success: false,
      issues: [{ code: 'confirmation-required' }],
    });

    const prepared = prepareStoredPlayerDataImport(text, {
      storage,
      inventoryStrategy: 'replace',
      confirmCompleteInventoryReplacement: true,
    });
    expect(prepared.success).toBe(true);
    if (!prepared.success) return;
    expect(commitPlayerDataImport(prepared.plan, { storage }).success).toBe(true);

    const imported = loadToolState('backpack-planner', { storage }) as ReturnType<
      typeof createBackpackState
    >;
    expect(imported.quantities['tech-scrap']).toBe('20');
    expect(imported.quantities['old-pouch']).toBe('0');
  });

  it('開箱 records／rollups 以 ID 去重，重複匯入不重複計數', () => {
    const storage = new TransactionStorage();
    const text = createEnvelope([lootBoxSection()]);
    const first = prepareStoredPlayerDataImport(text, { storage });
    expect(first.success).toBe(true);
    if (!first.success) return;
    expect(commitPlayerDataImport(first.plan, { storage }).success).toBe(true);

    const second = prepareStoredPlayerDataImport(text, { storage });
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(second.plan.sections).toContainEqual(expect.objectContaining({
      id: 'loot-box-history', status: 'unchanged', changeCount: 0,
    }));
    expect(commitPlayerDataImport(second.plan, { storage })).toEqual({
      success: true,
      changedKeys: [],
    });

    const state = loadToolState<LootBoxAnalysisState>('loot-box-analysis', {
      storage,
      validate: isLootBoxAnalysisState,
    });
    expect(state?.records).toHaveLength(1);
    expect(state?.rollups).toHaveLength(1);
    expect(state?.rollups[0]).toMatchObject({ recordCount: 2, openings: 16 });
  });

  it('合併匯入超過 2,000 筆時封存最舊批次，而不是讓整批匯入失敗', () => {
    const storage = new TransactionStorage();
    const current: LootBoxAnalysisState = {
      schemaVersion: lootBoxAnalysisSchemaVersion,
      records: Array.from({ length: 1_950 }, (_, index) => ({
        id: `current-${index}`,
        recordedAt: index,
        boxType: 'white' as const,
        openings: 1,
        drops: [{ dropId: 'item-hash' as const, quantity: 1 }],
      })),
      rollups: [],
    };
    expect(saveToolState('loot-box-analysis', current, { storage })).toBe(true);

    const incomingRecords = Array.from({ length: 100 }, (_, index) => ({
      id: `incoming-${index}`,
      recordedAt: new Date(2_000 + index).toISOString(),
      boxType: 'white',
      openings: 1,
      drops: [{ dropId: 'item-hash', quantity: 1 }],
    }));
    const prepared = prepareStoredPlayerDataImport(createEnvelope([{
      id: 'loot-box-history',
      schemaVersion: 1,
      data: { records: incomingRecords, rollups: [] },
    }]), { storage, lootBoxStrategy: 'overwrite' });

    expect(prepared.success).toBe(true);
    if (!prepared.success) return;
    const next = prepared.plan.transaction.nextLootBoxAnalysisState;
    expect(next?.records).toHaveLength(1_950);
    expect(next?.rollups).toEqual([
      expect.objectContaining({ boxType: 'white', recordCount: 100, openings: 100 }),
    ]);
    expect(isLootBoxAnalysisState(next)).toBe(true);
  });

  it('未知 section 只列為不支援，不阻止已知 section 建立計畫', () => {
    const storage = new TransactionStorage();
    const text = createEnvelope([
      attributesSection(),
      { id: 'future-history', schemaVersion: 1, data: { entries: [] } },
    ]);
    const prepared = prepareStoredPlayerDataImport(text, { storage });
    expect(prepared.success).toBe(true);
    if (!prepared.success) return;
    expect(prepared.plan.unsupportedSections).toEqual([
      { id: 'future-history', schemaVersion: 1, reason: 'unknown-section' },
    ]);
    expect(prepared.plan.sections).toContainEqual(expect.objectContaining({
      id: 'future-history', status: 'unsupported',
    }));
  });

  it('preview 後資料被修改時拒絕過期 plan', () => {
    const storage = new TransactionStorage();
    saveSharedUserInputs(createSharedSnapshot(), { storage });
    const prepared = prepareStoredPlayerDataImport(
      createEnvelope([attributesSection()]),
      { storage, playerAttributesStrategy: 'overwrite' },
    );
    expect(prepared.success).toBe(true);
    if (!prepared.success) return;

    saveSharedUserInputs(createSharedSnapshot({ armor: 999 }), { storage });
    expect(commitPlayerDataImport(prepared.plan, { storage })).toMatchObject({
      success: false,
      status: 'stale-plan',
    });
  });

  it('第二個 store 寫入失敗時反向回復，且不發布通知', () => {
    const storage = new TransactionStorage();
    saveSharedUserInputs(createSharedSnapshot(), { storage });
    saveToolState('backpack-planner', createBackpackState(), { storage });
    const sharedKey = getToolStorageKey('backpack-planner');
    const originalShared = storage.getItem('cco-toolkit:shared-inputs:v4');
    const originalBackpack = storage.getItem(sharedKey);
    const prepared = prepareStoredPlayerDataImport(
      createEnvelope([attributesSection(), inventorySection('partial')]),
      { storage, playerAttributesStrategy: 'overwrite' },
    );
    expect(prepared.success).toBe(true);
    if (!prepared.success) return;

    storage.failOnRelativeSetCalls(2);
    let notifications = 0;
    const result = commitPlayerDataImport(prepared.plan, {
      storage,
      notify: () => { notifications += 1; },
    });
    expect(result).toMatchObject({ success: false, status: 'write-failed' });
    expect(storage.getItem('cco-toolkit:shared-inputs:v4')).toBe(originalShared);
    expect(storage.getItem(sharedKey)).toBe(originalBackpack);
    expect(notifications).toBe(0);
  });

  it('第三個 store 寫入失敗時回復前兩個 store', () => {
    const storage = new TransactionStorage();
    saveSharedUserInputs(createSharedSnapshot(), { storage });
    saveToolState('backpack-planner', createBackpackState(), { storage });
    const keys = [
      'cco-toolkit:shared-inputs:v4',
      getToolStorageKey('backpack-planner'),
      getToolStorageKey('loot-box-analysis'),
    ];
    const originals = keys.map((key) => storage.getItem(key));
    const prepared = prepareStoredPlayerDataImport(
      createEnvelope([attributesSection(), inventorySection('partial'), lootBoxSection()]),
      { storage, playerAttributesStrategy: 'overwrite' },
    );
    expect(prepared.success).toBe(true);
    if (!prepared.success) return;

    storage.failOnRelativeSetCalls(3);
    expect(commitPlayerDataImport(prepared.plan, { storage })).toMatchObject({
      success: false,
      status: 'write-failed',
      failedKey: keys[2],
    });
    expect(keys.map((key) => storage.getItem(key))).toEqual(originals);
  });

  it('單一回復失敗時仍嘗試還原其餘已寫入 store', () => {
    const storage = new TransactionStorage();
    saveSharedUserInputs(createSharedSnapshot(), { storage });
    saveToolState('backpack-planner', createBackpackState(), { storage });
    saveToolState('loot-box-analysis', {
      schemaVersion: 2,
      records: [],
      rollups: [],
    }, { storage });
    const sharedKey = 'cco-toolkit:shared-inputs:v4';
    const backpackKey = getToolStorageKey('backpack-planner');
    const originalShared = storage.getItem(sharedKey);
    const originalBackpack = storage.getItem(backpackKey);
    const prepared = prepareStoredPlayerDataImport(
      createEnvelope([attributesSection(), inventorySection('partial'), lootBoxSection()]),
      { storage, playerAttributesStrategy: 'overwrite' },
    );
    expect(prepared.success).toBe(true);
    if (!prepared.success) return;

    // 第三次是 loot box 寫入失敗，第四次是該 key 的回復失敗；
    // 其餘兩個已寫入 store 仍必須繼續還原。
    storage.failOnRelativeSetCalls(3, 4);
    expect(commitPlayerDataImport(prepared.plan, { storage })).toMatchObject({
      success: false,
      status: 'rollback-failed',
    });
    expect(storage.getItem(sharedKey)).toBe(originalShared);
    expect(storage.getItem(backpackKey)).toBe(originalBackpack);
  });

  it('全部提交成功後才一次發布實際變更 key', () => {
    const storage = new TransactionStorage();
    saveSharedUserInputs(defaultSharedUserInputs, { storage });
    const prepared = prepareStoredPlayerDataImport(
      createEnvelope([attributesSection(), inventorySection('manual'), lootBoxSection()]),
      { storage },
    );
    expect(prepared.success).toBe(true);
    if (!prepared.success) return;

    const notifications: string[][] = [];
    const result = commitPlayerDataImport(prepared.plan, {
      storage,
      notify: (changes) => notifications.push(changes.map((change) => change.key)),
    });
    expect(result.success).toBe(true);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual([
      'cco-toolkit:shared-inputs:v4',
      getToolStorageKey('backpack-planner'),
      getToolStorageKey('loot-box-analysis'),
    ]);
  });
});
