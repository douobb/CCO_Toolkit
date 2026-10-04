import {
  defaultSharedUserInputs,
  parseSharedUserInputs,
  sharedUserInputsSchema,
  sharedUserInputsSchemaVersion,
  sharedUserInputsStorageKey,
  sharedUserInputsStorageRecordSchema,
  sharedUserInputsStorageVersion,
  type SharedUserInputs,
  type SharedUserInputsStorageRecord,
} from '../shared-user-inputs';
import {
  getStorage,
  type StorageLike,
  type StorageOptions,
} from './storage';
import { normalizeLegacyBuffPercent } from '../buff-percent';

export type SharedUserInputsStorageReadStatus =
  | 'empty'
  | 'valid'
  | 'invalid'
  | 'unsupported'
  | 'unavailable';

export interface SharedUserInputsStorageReadResult {
  readonly status: SharedUserInputsStorageReadStatus;
  readonly value: SharedUserInputs;
  readonly storageVersion?: unknown;
  readonly schemaVersion?: unknown;
  readonly migrated?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getVersionMetadata(value: unknown) {
  if (!isRecord(value)) return {};

  return {
    storageVersion: value.storageVersion,
    schemaVersion: value.schemaVersion,
  };
}

function migrateLegacyBuffPercentages(value: unknown): {
  readonly value: unknown;
  readonly migrated: boolean;
} {
  if (!isRecord(value) || !isRecord(value.value)) {
    return { value, migrated: false };
  }

  const payload = value.value;
  if (!isRecord(payload) || !isRecord(payload.effects) || !Array.isArray(payload.effects.buffs)) {
    return { value, migrated: false };
  }

  let migrated = false;
  const buffs = payload.effects.buffs.map((buff) => {
    if (!isRecord(buff)) return buff;
    if (buff.id !== 'btc-buff-percent' && buff.id !== 'exp-buff-percent') return buff;

    const normalized = normalizeLegacyBuffPercent(buff.percentage);
    if (normalized === undefined || normalized === buff.percentage) return buff;

    migrated = true;
    return { ...buff, percentage: normalized };
  });

  if (!migrated) return { value, migrated: false };

  return {
    value: {
      ...value,
      value: {
        ...payload,
        effects: {
          ...payload.effects,
          buffs,
        },
      },
    },
    migrated: true,
  };
}

/**
 * 解析 storage envelope，將目前版本、未支援版本與無效 payload 分開辨識。
 * 未支援版本不會被轉成部分資料，讓未來明確規劃的版本演進保持可辨識。
 */
export function parseSharedUserInputsStorageRecord(
  value: unknown,
):
  | {
      readonly status: 'valid';
      readonly value: SharedUserInputs;
      readonly migrated?: boolean;
    }
  | {
      readonly status: 'invalid' | 'unsupported';
      readonly value: typeof defaultSharedUserInputs;
      readonly storageVersion?: unknown;
      readonly schemaVersion?: unknown;
} {
  const migratedValue = migrateLegacyBuffPercentages(value);
  const parsed = sharedUserInputsStorageRecordSchema.safeParse(migratedValue.value);
  if (parsed.success) {
    return {
      status: 'valid',
      value: parseSharedUserInputs(parsed.data.value) ?? defaultSharedUserInputs,
      migrated: migratedValue.migrated,
    };
  }

  const versions = getVersionMetadata(value);
  const hasUnsupportedVersion =
    versions.storageVersion !== undefined &&
    versions.storageVersion !== sharedUserInputsStorageVersion;
  const hasUnsupportedSchemaVersion =
    versions.schemaVersion !== undefined &&
    versions.schemaVersion !== sharedUserInputsSchemaVersion;

  return {
    status:
      hasUnsupportedVersion || hasUnsupportedSchemaVersion
        ? 'unsupported'
        : 'invalid',
    value: defaultSharedUserInputs,
    ...versions,
  };
}

/** 將合法 snapshot 編碼為獨立的 Shared User Inputs storage envelope。 */
export function serializeSharedUserInputsStorageRecord(
  value: unknown,
): string | undefined {
  const parsedValue = parseSharedUserInputs(value);
  if (!parsedValue) return undefined;

  try {
    const record: SharedUserInputsStorageRecord = {
      storageVersion: sharedUserInputsStorageVersion,
      schemaVersion: sharedUserInputsSchemaVersion,
      value: parsedValue,
    };
    const serialized = JSON.stringify(record);
    return serialized === undefined ? undefined : serialized;
  } catch {
    return undefined;
  }
}

function removeInvalidRecord(storage: StorageLike) {
  try {
    storage.removeItem(sharedUserInputsStorageKey);
  } catch {
    // 清理失敗時仍使用安全預設值，不讓儲存例外中斷工具。
  }
}

/** 從指定 storage 載入合法 Shared User Inputs；失敗一律回到安全預設值。 */
export function loadSharedUserInputs(
  options: StorageOptions = {},
): SharedUserInputsStorageReadResult {
  const storage = getStorage(options);
  if (!storage) {
    return { status: 'unavailable', value: defaultSharedUserInputs };
  }

  let rawValue: string | null;
  try {
    rawValue = storage.getItem(sharedUserInputsStorageKey);
  } catch {
    return { status: 'unavailable', value: defaultSharedUserInputs };
  }

  if (rawValue === null) {
    return { status: 'empty', value: defaultSharedUserInputs };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawValue) as unknown;
  } catch {
    removeInvalidRecord(storage);
    return { status: 'invalid', value: defaultSharedUserInputs };
  }

  const parsed = parseSharedUserInputsStorageRecord(decoded);
  if (parsed.status === 'valid') {
    if (parsed.migrated) {
      // 舊值只做局部正規化後回寫；同一 envelope 的其他使用者資料保持不變。
      saveSharedUserInputs(parsed.value, { storage });
    }
    return parsed;
  }

  if (parsed.status === 'invalid') {
    removeInvalidRecord(storage);
  }

  return parsed;
}

/** 儲存合法 Shared User Inputs；storage 不可用或寫入失敗時回傳 false。 */
export function saveSharedUserInputs(
  value: unknown,
  options: StorageOptions = {},
): boolean {
  const storage = getStorage(options);
  if (!storage) return false;

  const serialized = serializeSharedUserInputsStorageRecord(value);
  if (serialized === undefined) return false;

  try {
    storage.setItem(sharedUserInputsStorageKey, serialized);
    return true;
  } catch {
    return false;
  }
}

/** 清除 Shared User Inputs 的持久化記錄；不會觸及其他 app key。 */
export function clearSharedUserInputs(options: StorageOptions = {}): boolean {
  const storage = getStorage(options);
  if (!storage) return false;

  try {
    storage.removeItem(sharedUserInputsStorageKey);
    return true;
  } catch {
    return false;
  }
}

/** 供 store／測試引用目前 payload schema，避免建立第二套驗證。 */
export { sharedUserInputsSchema };
