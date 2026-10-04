import {
  createDefaultBackpackPlannerToolState,
  isBackpackPlannerToolState,
  type BackpackPlannerToolState,
} from './backpack-planner-state';
import {
  compactLootBoxAnalysisState,
  createDefaultLootBoxAnalysisState,
  isLootBoxAnalysisState,
  lootBoxAnalysisSchemaVersion,
  type LootBoxAnalysisRecord,
  type LootBoxAnalysisRollup,
  type LootBoxAnalysisState,
} from './loot-box-analysis';
import {
  inspectPlayerDataFile,
  playerDataContractLimits,
  type PlayerDataEnvelope,
  type PlayerDataKnownSection,
  type PlayerDataSectionId,
  type UnsupportedPlayerDataSection,
} from './player-data-contract';
import {
  parseSharedUserInputs,
  type SharedEquipmentInputs,
  type SharedSkillInput,
  type SharedUserInputs,
} from './shared-user-inputs';
import {
  getStorage,
  getToolStorageKey,
  loadSharedUserInputs,
  loadToolState,
  saveSharedUserInputs,
  saveToolState,
  serializeSharedUserInputsStorageRecord,
  sharedUserInputsStorageKey,
  type StorageLike,
  type StorageOptions,
} from './storage';

export type PlayerDataConflictStrategy = 'keep-current' | 'overwrite';
export type PlayerDataInventoryStrategy = 'merge' | 'replace';

export interface PlayerDataImportOptions {
  readonly selectedSections?: readonly PlayerDataSectionId[];
  readonly progressionStrategy?: PlayerDataConflictStrategy;
  readonly playerAttributesStrategy?: PlayerDataConflictStrategy;
  readonly inventoryStrategy?: PlayerDataInventoryStrategy;
  readonly confirmCompleteInventoryReplacement?: boolean;
  readonly lootBoxStrategy?: PlayerDataConflictStrategy;
}

export interface PlayerDataImportIssue {
  readonly code:
    | 'file-too-large'
    | 'invalid-json'
    | 'invalid-contract'
    | 'storage-unavailable'
    | 'invalid-current-data'
    | 'confirmation-required'
    | 'mapping-failed';
  readonly source: 'file' | 'shared-user-inputs' | 'inventory' | 'loot-box-history' | 'storage';
  readonly path: readonly (string | number)[];
  readonly message: string;
}

export interface PlayerDataImportChange {
  readonly sectionId: PlayerDataSectionId;
  readonly key: string;
  readonly currentValue: unknown;
  readonly incomingValue: unknown;
  readonly action: 'add' | 'replace' | 'remove' | 'keep' | 'unchanged';
  readonly conflict: boolean;
}

export interface PlayerDataImportSectionSummary {
  readonly id: string;
  readonly schemaVersion: number;
  readonly status: 'ready' | 'unchanged' | 'skipped' | 'unsupported';
  readonly changeCount: number;
  readonly conflictCount: number;
}

interface PlayerDataImportTransaction {
  readonly expectedRawValues: Readonly<Record<string, string | null>>;
  readonly originalRawValues: Readonly<Record<string, string | null>>;
  readonly nextSharedUserInputs?: SharedUserInputs;
  readonly nextBackpackPlannerState?: BackpackPlannerToolState;
  readonly nextLootBoxAnalysisState?: LootBoxAnalysisState;
  readonly writeKeys: readonly string[];
}

export interface PlayerDataImportPlan {
  readonly source: {
    readonly formatVersion: number;
    readonly exportedAt: string;
    readonly producer: PlayerDataEnvelope['producer'];
  };
  readonly options: Required<PlayerDataImportOptions>;
  readonly changes: readonly PlayerDataImportChange[];
  readonly sections: readonly PlayerDataImportSectionSummary[];
  readonly unsupportedSections: readonly UnsupportedPlayerDataSection[];
  /** 僅供 commit service 使用；UI 不應自行修改或解讀 storage raw value。 */
  readonly transaction: PlayerDataImportTransaction;
}

export type PlayerDataImportPreparationResult =
  | { readonly success: true; readonly plan: PlayerDataImportPlan }
  | { readonly success: false; readonly issues: readonly PlayerDataImportIssue[] };

export interface PlayerDataStorageChange {
  readonly key: string;
  readonly newValue: string | null;
}

export type PlayerDataImportCommitResult =
  | {
      readonly success: true;
      readonly changedKeys: readonly string[];
    }
  | {
      readonly success: false;
      readonly status: 'storage-unavailable' | 'stale-plan' | 'write-failed' | 'rollback-failed';
      readonly failedKey?: string;
    };

export interface PlayerDataImportCommitOptions extends StorageOptions {
  /** 測試或非瀏覽器 host 可注入；正式環境預設派發同頁 storage event。 */
  readonly notify?: (changes: readonly PlayerDataStorageChange[]) => void;
}

const allSectionIds: readonly PlayerDataSectionId[] = [
  'progression',
  'player-attributes',
  'inventory',
  'loot-box-history',
];

const sharedStorageKey = sharedUserInputsStorageKey;
const backpackStorageKey = getToolStorageKey('backpack-planner');
const lootBoxStorageKey = getToolStorageKey('loot-box-analysis');

function resolveOptions(options: PlayerDataImportOptions): Required<PlayerDataImportOptions> {
  const selected = options.selectedSections ?? allSectionIds;
  return {
    selectedSections: allSectionIds.filter((id) => selected.includes(id)),
    progressionStrategy: options.progressionStrategy ?? 'keep-current',
    playerAttributesStrategy: options.playerAttributesStrategy ?? 'keep-current',
    inventoryStrategy: options.inventoryStrategy ?? 'merge',
    confirmCompleteInventoryReplacement:
      options.confirmCompleteInventoryReplacement ?? false,
    lootBoxStrategy: options.lootBoxStrategy ?? 'keep-current',
  };
}

function normalizeIssuePath(path: readonly PropertyKey[]): readonly (string | number)[] {
  return path.map((part) =>
    typeof part === 'symbol' ? (part.description ?? part.toString()) : part);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  return Object.freeze(value);
}

function findSection<TId extends PlayerDataSectionId>(
  sections: readonly PlayerDataKnownSection[],
  id: TId,
): Extract<PlayerDataKnownSection, { readonly id: TId }> | undefined {
  return sections.find((section) => section.id === id) as
    | Extract<PlayerDataKnownSection, { readonly id: TId }>
    | undefined;
}

function parseImportText(text: string):
  | {
      readonly success: true;
      readonly envelope: PlayerDataEnvelope;
      readonly sections: readonly PlayerDataKnownSection[];
      readonly unsupportedSections: readonly UnsupportedPlayerDataSection[];
    }
  | { readonly success: false; readonly issues: readonly PlayerDataImportIssue[] } {
  if (new TextEncoder().encode(text).byteLength > playerDataContractLimits.maxFileBytes) {
    return {
      success: false,
      issues: [{
        code: 'file-too-large',
        source: 'file',
        path: [],
        message: '玩家資料檔案超過 5 MB 上限',
      }],
    };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(text) as unknown;
  } catch {
    return {
      success: false,
      issues: [{
        code: 'invalid-json',
        source: 'file',
        path: [],
        message: '檔案不是有效的 JSON',
      }],
    };
  }

  const inspected = inspectPlayerDataFile(decoded);
  if (!inspected.success) {
    return {
      success: false,
      issues: inspected.error.issues.map((issue) => ({
        code: 'invalid-contract' as const,
        source: 'file' as const,
        path: normalizeIssuePath(issue.path),
        message: issue.message,
      })),
    };
  }

  return {
    success: true,
    envelope: inspected.envelope,
    sections: inspected.supportedSections,
    unsupportedSections: inspected.unsupportedSections,
  };
}

function rawValues(storage: StorageLike): Readonly<Record<string, string | null>> | undefined {
  try {
    return {
      [sharedStorageKey]: storage.getItem(sharedStorageKey),
      [backpackStorageKey]: storage.getItem(backpackStorageKey),
      [lootBoxStorageKey]: storage.getItem(lootBoxStorageKey),
    };
  } catch {
    return undefined;
  }
}

function valuesEqual(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function addChange(
  changes: PlayerDataImportChange[],
  sectionId: PlayerDataSectionId,
  key: string,
  currentValue: unknown,
  incomingValue: unknown,
  strategy: PlayerDataConflictStrategy,
  currentExists: boolean,
): boolean {
  if (valuesEqual(currentValue, incomingValue)) {
    changes.push({
      sectionId,
      key,
      currentValue,
      incomingValue,
      action: 'unchanged',
      conflict: false,
    });
    return false;
  }

  const conflict = currentExists;
  const overwrite = !conflict || strategy === 'overwrite';
  changes.push({
    sectionId,
    key,
    currentValue,
    incomingValue,
    action: overwrite ? (currentExists ? 'replace' : 'add') : 'keep',
    conflict,
  });
  return overwrite;
}

function mergeSharedSections(
  current: SharedUserInputs,
  sections: readonly PlayerDataKnownSection[],
  options: Required<PlayerDataImportOptions>,
  changes: PlayerDataImportChange[],
): SharedUserInputs | PlayerDataImportIssue {
  const nextSkills = current.progression.skills.map((skill) => ({ ...skill }));
  const nextEquipment: Record<string, number | undefined> = { ...current.equipment };
  let nextPlayerLevel = current.progression.player.level;

  const progression = findSection(sections, 'progression');
  if (progression && options.selectedSections.includes('progression')) {
    for (const level of progression.data.levels) {
      if (level.id === 'level') {
        if (addChange(
          changes,
          'progression',
          level.id,
          current.progression.player.level,
          level.value,
          options.progressionStrategy,
          true,
        )) {
          nextPlayerLevel = level.value;
        }
        continue;
      }

      const index = nextSkills.findIndex((skill) => skill.id === level.id);
      const existing = index >= 0 ? nextSkills[index] : undefined;
      if (addChange(
        changes,
        'progression',
        level.id,
        existing?.level,
        level.value,
        options.progressionStrategy,
        existing !== undefined,
      )) {
        const nextSkill: SharedSkillInput = { id: level.id, level: level.value };
        if (index >= 0) nextSkills[index] = nextSkill;
        else nextSkills.push(nextSkill);
      }
    }
  }

  const attributes = findSection(sections, 'player-attributes');
  if (attributes && options.selectedSections.includes('player-attributes')) {
    const keyById = {
      'max-health': 'maxHealth',
      armor: 'armor',
      'destructive-weapon-damage': 'destructiveWeaponDamage',
      'critical-damage-percent': 'criticalDamagePercent',
      'bargain-percent': 'bargainPercent',
      'damage-reduction-percent': 'damageReductionPercent',
    } as const satisfies Record<string, keyof SharedEquipmentInputs>;

    for (const attribute of attributes.data.values) {
      const key = keyById[attribute.id];
      const existing = current.equipment[key];
      if (addChange(
        changes,
        'player-attributes',
        attribute.id,
        existing,
        attribute.value,
        options.playerAttributesStrategy,
        existing !== undefined,
      )) {
        nextEquipment[key] = attribute.value;
      }
    }
  }

  const parsed = parseSharedUserInputs({
    progression: {
      player: { level: nextPlayerLevel },
      skills: nextSkills,
    },
    economy: current.economy,
    effects: current.effects,
    equipment: nextEquipment,
  });
  if (!parsed) {
    return {
      code: 'mapping-failed',
      source: 'shared-user-inputs',
      path: [],
      message: '匯入後的等級或玩家屬性與目前共用設定規則衝突',
    };
  }
  return parsed;
}

function mergeInventorySection(
  current: BackpackPlannerToolState,
  section: Extract<PlayerDataKnownSection, { readonly id: 'inventory' }>,
  options: Required<PlayerDataImportOptions>,
  changes: PlayerDataImportChange[],
): BackpackPlannerToolState | PlayerDataImportIssue {
  if (options.inventoryStrategy === 'replace') {
    if (section.data.completeness !== 'complete') {
      return {
        code: 'confirmation-required',
        source: 'inventory',
        path: ['completeness'],
        message: '只有 complete inventory 可使用整體取代',
      };
    }
    if (!options.confirmCompleteInventoryReplacement) {
      return {
        code: 'confirmation-required',
        source: 'inventory',
        path: [],
        message: '整體取代庫存前必須明確確認未列出項目會歸零',
      };
    }
  }

  const quantities: Record<string, string> = {
    ...current.quantities,
  };
  const incomingById = new Map<string, number>(
    section.data.items.map((item) => [item.itemId, item.quantity]),
  );

  if (options.inventoryStrategy === 'replace') {
    for (const itemId of Object.keys(quantities)) {
      const incoming = incomingById.get(itemId) ?? 0;
      const currentValue = Number(quantities[itemId]);
      if (!valuesEqual(currentValue, incoming)) {
        changes.push({
          sectionId: 'inventory',
          key: itemId,
          currentValue,
          incomingValue: incoming,
          action: incoming === 0 ? 'remove' : 'replace',
          conflict: currentValue !== 0,
        });
      }
      quantities[itemId] = String(incoming);
    }
  } else {
    for (const item of section.data.items) {
      const currentValue = Number(quantities[item.itemId] ?? 0);
      changes.push({
        sectionId: 'inventory',
        key: item.itemId,
        currentValue,
        incomingValue: item.quantity,
        action: currentValue === item.quantity
          ? 'unchanged'
          : (currentValue === 0 ? 'add' : 'replace'),
        conflict: currentValue !== 0 && currentValue !== item.quantity,
      });
      quantities[item.itemId] = String(item.quantity);
    }
  }

  const next = { ...current, quantities };
  if (!isBackpackPlannerToolState(next)) {
    return {
      code: 'mapping-failed',
      source: 'inventory',
      path: [],
      message: '匯入後的背包資料不符合目前工具狀態契約',
    };
  }
  return next;
}

function convertRecord(
  record: Extract<PlayerDataKnownSection, { readonly id: 'loot-box-history' }>['data']['records'][number],
): LootBoxAnalysisRecord | undefined {
  const recordedAt = Date.parse(record.recordedAt);
  if (!Number.isSafeInteger(recordedAt) || recordedAt < 0) return undefined;
  return {
    id: record.id,
    recordedAt,
    boxType: record.boxType,
    openings: record.openings,
    drops: record.drops.map((drop) => ({ ...drop })),
  };
}

function convertRollup(
  rollup: Extract<PlayerDataKnownSection, { readonly id: 'loot-box-history' }>['data']['rollups'][number],
): LootBoxAnalysisRollup {
  return {
    id: rollup.id,
    boxType: rollup.boxType,
    recordCount: rollup.recordCount,
    openings: rollup.openings,
    drops: rollup.drops.map((drop) => ({ ...drop })),
  };
}

function mergeLootBoxSection(
  current: LootBoxAnalysisState,
  section: Extract<PlayerDataKnownSection, { readonly id: 'loot-box-history' }>,
  strategy: PlayerDataConflictStrategy,
  changes: PlayerDataImportChange[],
): LootBoxAnalysisState | PlayerDataImportIssue {
  const records = current.records.map((record) => ({ ...record }));
  const rollups = current.rollups.map((rollup) => ({ ...rollup }));

  const mergeEntry = (
    incoming: LootBoxAnalysisRecord | LootBoxAnalysisRollup,
    kind: 'record' | 'rollup',
  ) => {
    const recordIndex = records.findIndex((record) => record.id === incoming.id);
    const rollupIndex = rollups.findIndex((rollup) => rollup.id === incoming.id);
    const existing = recordIndex >= 0 ? records[recordIndex] : rollups[rollupIndex];
    const shouldWrite = addChange(
      changes,
      'loot-box-history',
      `${kind}:${incoming.id}`,
      existing,
      incoming,
      strategy,
      existing !== undefined,
    );
    if (!shouldWrite) return;

    if (recordIndex >= 0) records.splice(recordIndex, 1);
    if (rollupIndex >= 0) rollups.splice(rollupIndex, 1);
    if (kind === 'record') records.push(incoming as LootBoxAnalysisRecord);
    else rollups.push(incoming as LootBoxAnalysisRollup);
  };

  for (const record of section.data.records) {
    const converted = convertRecord(record);
    if (!converted) {
      return {
        code: 'mapping-failed',
        source: 'loot-box-history',
        path: ['records', section.data.records.indexOf(record), 'recordedAt'],
        message: '開箱紀錄時間超出網站可保存範圍',
      };
    }
    mergeEntry(converted, 'record');
  }
  section.data.rollups.forEach((rollup) => mergeEntry(convertRollup(rollup), 'rollup'));

  const next = compactLootBoxAnalysisState({
    schemaVersion: lootBoxAnalysisSchemaVersion,
    records,
    rollups,
  });
  if (!isLootBoxAnalysisState(next)) {
    return {
      code: 'mapping-failed',
      source: 'loot-box-history',
      path: [],
      message: '匯入後的開箱資料不符合目前工具狀態契約',
    };
  }
  return next;
}

function createSummaries(
  sections: readonly PlayerDataKnownSection[],
  unsupportedSections: readonly UnsupportedPlayerDataSection[],
  selected: readonly PlayerDataSectionId[],
  changes: readonly PlayerDataImportChange[],
): readonly PlayerDataImportSectionSummary[] {
  const known = sections.map((section) => {
    const sectionChanges = changes.filter((change) => change.sectionId === section.id);
    const actionable = sectionChanges.filter((change) =>
      change.action === 'add' || change.action === 'replace' || change.action === 'remove');
    return {
      id: section.id,
      schemaVersion: section.schemaVersion,
      status: !selected.includes(section.id)
        ? 'skipped' as const
        : (actionable.length > 0 ? 'ready' as const : 'unchanged' as const),
      changeCount: actionable.length,
      conflictCount: sectionChanges.filter((change) => change.conflict).length,
    };
  });
  return [
    ...known,
    ...unsupportedSections.map((section) => ({
      id: section.id,
      schemaVersion: section.schemaVersion,
      status: 'unsupported' as const,
      changeCount: 0,
      conflictCount: 0,
    })),
  ];
}

/** 解析、驗證並依目前 storage 建立不可變預覽／提交計畫；不寫入資料。 */
export function prepareStoredPlayerDataImport(
  text: string,
  options: PlayerDataImportOptions & StorageOptions = {},
): PlayerDataImportPreparationResult {
  const parsed = parseImportText(text);
  if (!parsed.success) return parsed;

  const storage = getStorage(options);
  if (!storage) {
    return {
      success: false,
      issues: [{
        code: 'storage-unavailable',
        source: 'storage',
        path: [],
        message: '目前無法讀取瀏覽器儲存空間',
      }],
    };
  }

  const originals = rawValues(storage);
  if (!originals) {
    return {
      success: false,
      issues: [{
        code: 'storage-unavailable',
        source: 'storage',
        path: [],
        message: '目前無法讀取瀏覽器儲存空間',
      }],
    };
  }

  const shared = loadSharedUserInputs({ storage });
  if (shared.status === 'invalid' || shared.status === 'unsupported' || shared.status === 'unavailable') {
    return {
      success: false,
      issues: [{
        code: 'invalid-current-data',
        source: shared.status === 'unavailable' ? 'storage' : 'shared-user-inputs',
        path: [],
        message: '目前玩家共用設定無法安全建立匯入計畫',
      }],
    };
  }

  const currentBackpack = loadToolState<BackpackPlannerToolState>('backpack-planner', {
    storage,
    validate: isBackpackPlannerToolState,
  });
  if (originals[backpackStorageKey] !== null && currentBackpack === undefined) {
    return {
      success: false,
      issues: [{
        code: 'invalid-current-data',
        source: 'inventory',
        path: [],
        message: '目前背包工具資料已損壞，無法安全建立匯入計畫',
      }],
    };
  }

  const currentLootBox = loadToolState<LootBoxAnalysisState>('loot-box-analysis', {
    storage,
    validate: isLootBoxAnalysisState,
  });
  if (originals[lootBoxStorageKey] !== null && currentLootBox === undefined) {
    return {
      success: false,
      issues: [{
        code: 'invalid-current-data',
        source: 'loot-box-history',
        path: [],
        message: '目前開箱工具資料已損壞，無法安全建立匯入計畫',
      }],
    };
  }

  const resolved = resolveOptions(options);
  const changes: PlayerDataImportChange[] = [];
  const nextShared = mergeSharedSections(shared.value, parsed.sections, resolved, changes);
  if ('code' in nextShared) return { success: false, issues: [nextShared] };

  let nextBackpack: BackpackPlannerToolState | undefined;
  const inventory = findSection(parsed.sections, 'inventory');
  if (inventory && resolved.selectedSections.includes('inventory')) {
    const merged = mergeInventorySection(
      currentBackpack ?? createDefaultBackpackPlannerToolState(),
      inventory,
      resolved,
      changes,
    );
    if ('code' in merged) return { success: false, issues: [merged] };
    nextBackpack = merged;
  }

  let nextLootBox: LootBoxAnalysisState | undefined;
  const lootBox = findSection(parsed.sections, 'loot-box-history');
  if (lootBox && resolved.selectedSections.includes('loot-box-history')) {
    const merged = mergeLootBoxSection(
      currentLootBox ?? createDefaultLootBoxAnalysisState(),
      lootBox,
      resolved.lootBoxStrategy,
      changes,
    );
    if ('code' in merged) return { success: false, issues: [merged] };
    nextLootBox = merged;
  }

  const writeKeys: string[] = [];
  const selectedShared = resolved.selectedSections.includes('progression')
    || resolved.selectedSections.includes('player-attributes');
  if (selectedShared && !valuesEqual(shared.value, nextShared)) writeKeys.push(sharedStorageKey);
  if (nextBackpack && !valuesEqual(
    currentBackpack ?? createDefaultBackpackPlannerToolState(),
    nextBackpack,
  )) writeKeys.push(backpackStorageKey);
  if (nextLootBox && !valuesEqual(
    currentLootBox ?? createDefaultLootBoxAnalysisState(),
    nextLootBox,
  )) writeKeys.push(lootBoxStorageKey);

  return {
    success: true,
    plan: deepFreeze({
      source: {
        formatVersion: parsed.envelope.formatVersion,
        exportedAt: parsed.envelope.exportedAt,
        producer: parsed.envelope.producer,
      },
      options: resolved,
      changes,
      sections: createSummaries(
        parsed.sections,
        parsed.unsupportedSections,
        resolved.selectedSections,
        changes,
      ),
      unsupportedSections: parsed.unsupportedSections,
      transaction: {
        expectedRawValues: originals,
        originalRawValues: originals,
        nextSharedUserInputs: selectedShared ? nextShared : undefined,
        nextBackpackPlannerState: nextBackpack,
        nextLootBoxAnalysisState: nextLootBox,
        writeKeys,
      },
    }),
  };
}

function restoreRawValue(storage: StorageLike, key: string, rawValue: string | null): boolean {
  try {
    if (rawValue === null) storage.removeItem(key);
    else storage.setItem(key, rawValue);
    return true;
  } catch {
    return false;
  }
}

function dispatchSamePageStorageChanges(changes: readonly PlayerDataStorageChange[]) {
  if (typeof window === 'undefined' || typeof StorageEvent === 'undefined') return;
  changes.forEach((change) => {
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: change.key,
        newValue: change.newValue,
      }));
    } catch {
      // 通知失敗不回滾已完成的持久化；頁面重新載入仍會取得正確資料。
    }
  });
}

/** 以下具名 adapter 是匯入服務唯一的 store 寫入入口；UI 只可提交 import plan。 */
function importSharedUserInputsBatch(
  value: SharedUserInputs | undefined,
  storage: StorageLike,
): boolean {
  return value !== undefined && saveSharedUserInputs(value, { storage });
}

function importBackpackPlannerBatch(
  value: BackpackPlannerToolState | undefined,
  storage: StorageLike,
): boolean {
  return value !== undefined && saveToolState('backpack-planner', value, { storage });
}

function importLootBoxAnalysisBatch(
  value: LootBoxAnalysisState | undefined,
  storage: StorageLike,
): boolean {
  return value !== undefined && saveToolState('loot-box-analysis', value, { storage });
}

function serializeCommittedValue(plan: PlayerDataImportPlan, key: string): string | null {
  if (key === sharedStorageKey) {
    return serializeSharedUserInputsStorageRecord(
      plan.transaction.nextSharedUserInputs,
    ) ?? null;
  }
  if (key === backpackStorageKey) {
    return JSON.stringify(plan.transaction.nextBackpackPlannerState);
  }
  if (key === lootBoxStorageKey) {
    return JSON.stringify(plan.transaction.nextLootBoxAnalysisState);
  }
  return null;
}

/** 依不可變 plan 原子套用全部變更；任一步驟失敗時反向回復原始 raw value。 */
export function commitPlayerDataImport(
  plan: PlayerDataImportPlan,
  options: PlayerDataImportCommitOptions = {},
): PlayerDataImportCommitResult {
  const storage = getStorage(options);
  if (!storage) return { success: false, status: 'storage-unavailable' };

  for (const key of plan.transaction.writeKeys) {
    let currentRaw: string | null;
    try {
      currentRaw = storage.getItem(key);
    } catch {
      return { success: false, status: 'storage-unavailable' };
    }
    if (currentRaw !== plan.transaction.expectedRawValues[key]) {
      return { success: false, status: 'stale-plan', failedKey: key };
    }
  }

  const writtenKeys: string[] = [];
  const operations = [
    {
      key: sharedStorageKey,
      enabled: plan.transaction.writeKeys.includes(sharedStorageKey),
      write: () => importSharedUserInputsBatch(
        plan.transaction.nextSharedUserInputs,
        storage,
      ),
    },
    {
      key: backpackStorageKey,
      enabled: plan.transaction.writeKeys.includes(backpackStorageKey),
      write: () => importBackpackPlannerBatch(
        plan.transaction.nextBackpackPlannerState,
        storage,
      ),
    },
    {
      key: lootBoxStorageKey,
      enabled: plan.transaction.writeKeys.includes(lootBoxStorageKey),
      write: () => importLootBoxAnalysisBatch(
        plan.transaction.nextLootBoxAnalysisState,
        storage,
      ),
    },
  ];

  for (const operation of operations) {
    if (!operation.enabled) continue;
    if (operation.write()) {
      writtenKeys.push(operation.key);
      continue;
    }

    const rollbackKeys = [operation.key, ...[...writtenKeys].reverse()];
    let rollbackSucceeded = true;
    for (const key of rollbackKeys) {
      if (!restoreRawValue(
        storage,
        key,
        plan.transaction.originalRawValues[key] ?? null,
      )) {
        rollbackSucceeded = false;
      }
    }
    return {
      success: false,
      status: rollbackSucceeded ? 'write-failed' : 'rollback-failed',
      failedKey: operation.key,
    };
  }

  const changes: PlayerDataStorageChange[] = writtenKeys.map((key) => ({
    key,
    // 寫入已成功；通知只需提供可解析的新值，避免再次讀取 storage 造成額外失敗點。
    newValue: serializeCommittedValue(plan, key),
  }));
  try {
    (options.notify ?? dispatchSamePageStorageChanges)(changes);
  } catch {
    // 通知層不可讓已成功的原子提交回報為寫入失敗。
  }
  return { success: true, changedKeys: writtenKeys };
}
