import { describe, expect, it } from 'vitest';

import {
  clearPreferences,
  clearToolState,
  getToolStorageKey,
  loadPreferences,
  loadStoredValue,
  loadToolState,
  preferencesStorageKey,
  resetAllStorage,
  savePreferences,
  saveStoredValue,
  saveToolState,
  storageSchemaVersion,
  type StorageLike,
} from './index';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

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
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe('client storage layer', () => {
  it('generates versioned preference and tool keys', () => {
    expect(preferencesStorageKey).toBe('cco-toolkit:v1:preferences');
    expect(getToolStorageKey('search-reward')).toBe(
      'cco-toolkit:v1:tool:search-reward',
    );
    expect(() => getToolStorageKey('Search Reward')).toThrow();
  });

  it('saves and loads versioned tool and preference state', () => {
    const storage = new MemoryStorage();
    const toolState = { level: 10, atp: 20 };
    const preferences = { theme: 'dark', decimalPlaces: 2 };

    expect(saveToolState('search-reward', toolState, { storage })).toBe(true);
    expect(savePreferences(preferences, { storage })).toBe(true);
    expect(
      JSON.parse(storage.getItem(getToolStorageKey('search-reward')) ?? ''),
    ).toEqual({ schemaVersion: storageSchemaVersion, value: toolState });
    expect(loadStoredValue(getToolStorageKey('search-reward'), { storage })).toEqual(
      toolState,
    );
    expect(loadPreferences({ storage })).toEqual(preferences);
  });

  it('normalize 成功時回傳轉換值並保留 storage', () => {
    const storage = new MemoryStorage();
    const key = getToolStorageKey('normalize-success');

    saveToolState('normalize-success', { level: 10 }, { storage });

    expect(loadToolState('normalize-success', {
      storage,
      normalize: (value) => {
        if (
          typeof value !== 'object'
          || value === null
          || !('level' in value)
          || typeof value.level !== 'number'
        ) return undefined;
        return { level: value.level + 1 };
      },
    })).toEqual({ level: 11 });
    expect(storage.getItem(key)).not.toBeNull();
  });

  it('normalize 失敗或轉換值未通過 validate 時移除 storage', () => {
    const storage = new MemoryStorage();
    const normalizeFailureKey = getToolStorageKey('normalize-failure');
    const validateFailureKey = getToolStorageKey('normalize-validate-failure');

    saveToolState('normalize-failure', { level: 10 }, { storage });
    expect(loadToolState('normalize-failure', {
      storage,
      normalize: () => undefined,
    })).toBeUndefined();
    expect(storage.getItem(normalizeFailureKey)).toBeNull();

    saveToolState('normalize-validate-failure', { level: 10 }, { storage });
    expect(loadToolState('normalize-validate-failure', {
      storage,
      normalize: () => ({ level: 0 }),
      validate: (value): value is { level: number } =>
        typeof value === 'object'
        && value !== null
        && 'level' in value
        && typeof value.level === 'number'
        && value.level > 0,
    })).toBeUndefined();
    expect(storage.getItem(validateFailureKey)).toBeNull();
  });

  it('returns safe fallback values when storage is unavailable during SSR', () => {
    expect(loadPreferences()).toBeUndefined();
    expect(savePreferences({ theme: 'dark' })).toBe(false);
    expect(clearPreferences()).toBe(false);
    expect(clearToolState('search-reward')).toBe(false);
    expect(resetAllStorage()).toBe(0);
  });

  it('removes corrupted or invalid records instead of throwing', () => {
    const storage = new MemoryStorage();
    const key = getToolStorageKey('search-reward');

    storage.setItem(key, '{broken');
    expect(loadStoredValue(key, { storage })).toBeUndefined();
    expect(storage.getItem(key)).toBeNull();

    storage.setItem(key, JSON.stringify({ schemaVersion: 1, value: 'bad' }));
    expect(
      loadStoredValue(key, {
        storage,
        validate: (value): value is { level: number } =>
          typeof value === 'object' &&
          value !== null &&
          'level' in value &&
          typeof value.level === 'number',
      }),
    ).toBeUndefined();
    expect(storage.getItem(key)).toBeNull();
  });

  it('clears one scope or resets all CCO Toolkit data only', () => {
    const storage = new MemoryStorage();

    saveToolState('search-reward', { level: 10 }, { storage });
    savePreferences({ theme: 'dark' }, { storage });
    saveStoredValue('other-app:data', { keep: true }, { storage });

    expect(clearToolState('search-reward', { storage })).toBe(true);
    expect(loadToolState('search-reward', { storage })).toBeUndefined();
    expect(clearPreferences({ storage })).toBe(true);
    expect(loadPreferences({ storage })).toBeUndefined();
    expect(savePreferences({ theme: 'dark' }, { storage })).toBe(true);
    expect(resetAllStorage({ storage })).toBe(1);
    expect(loadStoredValue('other-app:data', { storage })).toEqual({ keep: true });
  });
});
