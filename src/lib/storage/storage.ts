export const storageNamespace = 'cco-toolkit';
export const storageSchemaVersion = 1;
export const storageKeyPrefix = `${storageNamespace}:`;
export const versionedStorageKeyPrefix = `${storageKeyPrefix}v${storageSchemaVersion}:`;
export const preferencesStorageKey = `${versionedStorageKeyPrefix}preferences`;

export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StorageOptions {
  storage?: StorageLike | null;
}

export interface LoadStorageOptions<T> extends StorageOptions {
  validate?: (value: unknown) => value is T;
  normalize?: (value: unknown) => T | undefined;
}

type StoredRecord<T> = {
  schemaVersion: typeof storageSchemaVersion;
  value: T;
};

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function resolveStorage(storage: StorageLike | null | undefined): StorageLike | null {
  return storage === undefined ? getBrowserStorage() : storage;
}

/** 取得目前可用的儲存實作；未在瀏覽器或瀏覽器拒絕存取時回傳 null。 */
export function getStorage(options: StorageOptions = {}): StorageLike | null {
  return resolveStorage(options.storage);
}

function isStoredRecord(value: unknown): value is StoredRecord<unknown> {
  if (typeof value !== 'object' || value === null) return false;

  const record = value as Record<string, unknown>;
  return (
    record.schemaVersion === storageSchemaVersion &&
    Object.prototype.hasOwnProperty.call(record, 'value')
  );
}

export function getToolStorageKey(toolId: string): string {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(toolId)) {
    throw new Error(`工具識別碼格式無效：${toolId}`);
  }

  return `${versionedStorageKeyPrefix}tool:${toolId}`;
}

export function loadStoredValue<T>(
  key: string,
  options: LoadStorageOptions<T> = {},
): T | undefined {
  const storage = resolveStorage(options.storage);
  if (!storage) return undefined;

  try {
    const rawValue = storage.getItem(key);
    if (rawValue === null) return undefined;

    const parsed: unknown = JSON.parse(rawValue);
    if (!isStoredRecord(parsed)) {
      storage.removeItem(key);
      return undefined;
    }

    if (options.normalize) {
      const normalized = options.normalize(parsed.value);
      if (normalized === undefined || (options.validate && !options.validate(normalized))) {
        storage.removeItem(key);
        return undefined;
      }

      return normalized;
    }

    if (options.validate && !options.validate(parsed.value)) {
      storage.removeItem(key);
      return undefined;
    }

    return parsed.value as T;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // 讀取或清理被瀏覽器限制時，維持安全的空結果。
    }

    return undefined;
  }
}

export function saveStoredValue<T>(
  key: string,
  value: T,
  options: StorageOptions = {},
): boolean {
  const storage = resolveStorage(options.storage);
  if (!storage || value === undefined) return false;

  try {
    const record: StoredRecord<T> = {
      schemaVersion: storageSchemaVersion,
      value,
    };
    const serialized = JSON.stringify(record);
    if (serialized === undefined) return false;

    storage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

export function clearStoredValue(
  key: string,
  options: StorageOptions = {},
): boolean {
  const storage = resolveStorage(options.storage);
  if (!storage) return false;

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function resetStoredValues(options: StorageOptions = {}): number {
  const storage = resolveStorage(options.storage);
  if (!storage) return 0;

  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(storageKeyPrefix)) keys.push(key);
    }

    let removedCount = 0;
    for (const key of keys) {
      try {
        storage.removeItem(key);
        removedCount += 1;
      } catch {
        // 單一項目失敗時仍繼續清除其他 CCO Toolkit 資料。
      }
    }

    return removedCount;
  } catch {
    return 0;
  }
}
