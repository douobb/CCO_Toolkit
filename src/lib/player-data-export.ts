import packageMetadata from '../../package.json';

import { progressionLevelCatalog } from '@/data/game/progression';
import {
  type BackpackPlannerItemId,
  getBackpackPlannerItemCatalog,
} from './backpack-planner';
import {
  isBackpackPlannerToolState,
  type BackpackPlannerToolState,
} from './backpack-planner-state';
import {
  isLootBoxAnalysisState,
  type LootBoxAnalysisState,
} from './loot-box-analysis';
import {
  playerDataContractLimits,
  playerDataFileSchema,
  playerDataFormat,
  playerDataFormatVersion,
  type PlayerDataEnvelope,
  type PlayerDataKnownSection,
} from './player-data-contract';
import {
  parseSharedUserInputs,
  SHARED_CRITICAL_DAMAGE_PERCENT_DEFAULT,
  SHARED_DESTRUCTIVE_WEAPON_DAMAGE_DEFAULT,
  type SharedUserInputs,
} from './shared-user-inputs';
import {
  getStorage,
  loadSharedUserInputs,
  loadToolState,
  type StorageOptions,
} from './storage';

export const playerDataExportMimeType = 'application/json' as const;
export const defaultPlayerDataProducer = Object.freeze({
  app: 'cco-toolkit',
  appVersion: packageMetadata.version,
});

export interface PlayerDataExportSources {
  readonly sharedUserInputs: SharedUserInputs;
  readonly backpackPlannerState?: BackpackPlannerToolState;
  readonly lootBoxAnalysisState?: LootBoxAnalysisState;
}

export interface PlayerDataExportOptions {
  readonly exportedAt?: Date;
  readonly producer?: {
    readonly app: string;
    readonly appVersion: string;
  };
}

export interface PlayerDataExportIssue {
  readonly source:
    | 'shared-user-inputs'
    | 'inventory'
    | 'loot-box-history'
    | 'contract'
    | 'storage';
  readonly path: readonly (string | number)[];
  readonly message: string;
}

export type PlayerDataExportResult =
  | {
      readonly success: true;
      readonly envelope: PlayerDataEnvelope;
    }
  | {
      readonly success: false;
      readonly issues: readonly PlayerDataExportIssue[];
    };

export interface PlayerDataExportFile {
  readonly filename: string;
  readonly mimeType: typeof playerDataExportMimeType;
  readonly text: string;
  readonly size: number;
}

function createProgressionSection(
  snapshot: SharedUserInputs,
): PlayerDataKnownSection {
  return {
    id: 'progression',
    schemaVersion: 1,
    data: {
      levels: progressionLevelCatalog.map((definition) => {
        if (definition.id === 'level') {
          return { id: definition.id, value: snapshot.progression.player.level };
        }

        const stored = snapshot.progression.skills.find(
          (skill) => skill.id === definition.id,
        );
        return { id: definition.id, value: stored?.level ?? definition.defaultValue };
      }),
    },
  };
}

function createPlayerAttributesSection(
  snapshot: SharedUserInputs,
): PlayerDataKnownSection {
  const equipment = snapshot.equipment;
  return {
    id: 'player-attributes',
    schemaVersion: 1,
    data: {
      values: [
        { id: 'max-health', value: equipment.maxHealth ?? 0 },
        { id: 'armor', value: equipment.armor ?? 0 },
        {
          id: 'destructive-weapon-damage',
          value: equipment.destructiveWeaponDamage
            ?? SHARED_DESTRUCTIVE_WEAPON_DAMAGE_DEFAULT,
        },
        {
          id: 'critical-damage-percent',
          value: equipment.criticalDamagePercent ?? SHARED_CRITICAL_DAMAGE_PERCENT_DEFAULT,
        },
        { id: 'bargain-percent', value: equipment.bargainPercent ?? 0 },
        {
          id: 'damage-reduction-percent',
          value: equipment.damageReductionPercent ?? 0,
        },
      ],
    },
  };
}

function parseInventoryQuantity(value: string | undefined): number | undefined {
  const normalized = value?.trim() ?? '';
  if (!/^\d+$/.test(normalized)) return undefined;

  const quantity = Number(normalized);
  return Number.isSafeInteger(quantity) ? quantity : undefined;
}

function createInventorySection(
  state: BackpackPlannerToolState,
): PlayerDataKnownSection | PlayerDataExportIssue {
  if (!isBackpackPlannerToolState(state)) {
    return {
      source: 'inventory',
      path: [],
      message: '背包規劃狀態不符合目前資料契約',
    };
  }

  const items: { itemId: BackpackPlannerItemId; quantity: number }[] = [];
  for (const item of getBackpackPlannerItemCatalog()) {
    const quantity = parseInventoryQuantity(state.quantities[item.id]);
    if (quantity === undefined) {
      return {
        source: 'inventory',
        path: ['quantities', item.id],
        message: '背包物品數量必須是 0 以上的安全整數',
      };
    }
    items.push({ itemId: item.id, quantity });
  }

  return {
    id: 'inventory',
    schemaVersion: 1,
    data: {
      completeness: 'manual',
      items,
    },
  };
}

function toIsoDateTime(timestamp: number): string | undefined {
  try {
    return new Date(timestamp).toISOString();
  } catch {
    return undefined;
  }
}

function createLootBoxHistorySection(
  state: LootBoxAnalysisState,
): PlayerDataKnownSection | PlayerDataExportIssue {
  if (!isLootBoxAnalysisState(state)) {
    return {
      source: 'loot-box-history',
      path: [],
      message: '開箱紀錄不符合目前資料契約',
    };
  }

  const records = [];
  for (const [index, record] of state.records.entries()) {
    const recordedAt = toIsoDateTime(record.recordedAt);
    if (!recordedAt) {
      return {
        source: 'loot-box-history',
        path: ['records', index, 'recordedAt'],
        message: '開箱紀錄時間無法轉成 ISO 8601 日期',
      };
    }

    records.push({
      id: record.id,
      recordedAt,
      boxType: record.boxType,
      openings: record.openings,
      drops: record.drops.map((drop) => ({
        dropId: drop.dropId,
        quantity: drop.quantity,
      })),
    });
  }

  return {
    id: 'loot-box-history',
    schemaVersion: 1,
    data: {
      records,
      rollups: state.rollups.map((rollup) => ({
        id: rollup.id,
        boxType: rollup.boxType,
        recordCount: rollup.recordCount,
        openings: rollup.openings,
        drops: rollup.drops.map((drop) => ({
          dropId: drop.dropId,
          quantity: drop.quantity,
        })),
      })),
    },
  };
}

function isExportIssue(
  value: PlayerDataKnownSection | PlayerDataExportIssue,
): value is PlayerDataExportIssue {
  return 'source' in value;
}

/** 從已驗證的正式資料來源建立交換 envelope；不讀取或寫入 storage。 */
export function createPlayerDataExport(
  sources: PlayerDataExportSources,
  options: PlayerDataExportOptions = {},
): PlayerDataExportResult {
  const sharedUserInputs = parseSharedUserInputs(sources.sharedUserInputs);
  if (!sharedUserInputs) {
    return {
      success: false,
      issues: [{
        source: 'shared-user-inputs',
        path: [],
        message: '玩家共用設定不符合目前資料契約',
      }],
    };
  }

  const exportedAt = options.exportedAt ?? new Date();
  if (!Number.isFinite(exportedAt.getTime())) {
    return {
      success: false,
      issues: [{
        source: 'contract',
        path: ['exportedAt'],
        message: '匯出日期無效',
      }],
    };
  }

  const sections: PlayerDataKnownSection[] = [
    createProgressionSection(sharedUserInputs),
    createPlayerAttributesSection(sharedUserInputs),
  ];

  if (sources.backpackPlannerState) {
    const inventory = createInventorySection(sources.backpackPlannerState);
    if (isExportIssue(inventory)) return { success: false, issues: [inventory] };
    sections.push(inventory);
  }

  if (sources.lootBoxAnalysisState) {
    const history = createLootBoxHistorySection(sources.lootBoxAnalysisState);
    if (isExportIssue(history)) return { success: false, issues: [history] };
    sections.push(history);
  }

  const result = playerDataFileSchema.safeParse({
    format: playerDataFormat,
    formatVersion: playerDataFormatVersion,
    exportedAt: exportedAt.toISOString(),
    producer: options.producer ?? defaultPlayerDataProducer,
    sections,
  });
  if (!result.success) {
    return {
      success: false,
      issues: result.error.issues.map((issue) => ({
        source: 'contract' as const,
        path: issue.path.map((part) =>
          typeof part === 'symbol' ? (part.description ?? part.toString()) : part),
        message: issue.message,
      })),
    };
  }

  return { success: true, envelope: result.data };
}

/**
 * 只透過三個具名 storage API 載入網站正式資料；不列舉或傾印 localStorage。
 */
export function createStoredPlayerDataExport(
  options: PlayerDataExportOptions & StorageOptions = {},
): PlayerDataExportResult {
  const storage = getStorage(options);
  if (!storage) {
    return {
      success: false,
      issues: [{ source: 'storage', path: [], message: '目前無法讀取瀏覽器儲存空間' }],
    };
  }

  const shared = loadSharedUserInputs({ storage });
  if (shared.status === 'invalid' || shared.status === 'unsupported') {
    return {
      success: false,
      issues: [{
        source: 'shared-user-inputs',
        path: [],
        message: shared.status === 'unsupported'
          ? '玩家共用設定版本尚不支援'
          : '玩家共用設定已損壞',
      }],
    };
  }
  if (shared.status === 'unavailable') {
    return {
      success: false,
      issues: [{ source: 'storage', path: [], message: '目前無法讀取瀏覽器儲存空間' }],
    };
  }

  const backpackPlannerState = loadToolState<BackpackPlannerToolState>(
    'backpack-planner',
    { storage, validate: isBackpackPlannerToolState },
  );
  const lootBoxAnalysisState = loadToolState<LootBoxAnalysisState>(
    'loot-box-analysis',
    { storage, validate: isLootBoxAnalysisState },
  );

  return createPlayerDataExport(
    {
      sharedUserInputs: shared.value,
      backpackPlannerState,
      lootBoxAnalysisState,
    },
    options,
  );
}

/** 以固定縮排序列化已驗證 envelope，供下載與 fixture 比對。 */
export function serializePlayerDataExport(value: unknown): string | undefined {
  const result = playerDataFileSchema.safeParse(value);
  if (!result.success) return undefined;

  try {
    return `${JSON.stringify(result.data, null, 2)}\n`;
  } catch {
    return undefined;
  }
}

export function createPlayerDataExportFile(value: unknown): PlayerDataExportFile | undefined {
  const result = playerDataFileSchema.safeParse(value);
  if (!result.success) return undefined;

  const text = serializePlayerDataExport(result.data);
  if (!text) return undefined;
  const size = new TextEncoder().encode(text).byteLength;
  if (size > playerDataContractLimits.maxFileBytes) return undefined;

  return {
    filename: `cco-player-data-${result.data.exportedAt.slice(0, 10)}.json`,
    mimeType: playerDataExportMimeType,
    text,
    size,
  };
}

/** 觸發本機 JSON 下載；非瀏覽器環境或瀏覽器拒絕操作時安全回傳 false。 */
export function downloadPlayerDataExportFile(file: PlayerDataExportFile): boolean {
  if (
    typeof document === 'undefined'
    || typeof URL === 'undefined'
    || typeof URL.createObjectURL !== 'function'
  ) {
    return false;
  }

  let objectUrl: string | undefined;
  try {
    objectUrl = URL.createObjectURL(new Blob([file.text], { type: file.mimeType }));
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = file.filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    return true;
  } catch {
    return false;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
