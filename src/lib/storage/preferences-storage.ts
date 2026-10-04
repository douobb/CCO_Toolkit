import {
  clearStoredValue,
  loadStoredValue,
  preferencesStorageKey,
  resetStoredValues,
  saveStoredValue,
  type LoadStorageOptions,
  type StorageOptions,
} from './storage';

export function loadPreferences<T = Record<string, unknown>>(
  options: Omit<LoadStorageOptions<T>, 'storage'> & StorageOptions = {},
): T | undefined {
  return loadStoredValue(preferencesStorageKey, options);
}

export function savePreferences<T>(
  preferences: T,
  options: StorageOptions = {},
): boolean {
  return saveStoredValue(preferencesStorageKey, preferences, options);
}

export function clearPreferences(options: StorageOptions = {}): boolean {
  return clearStoredValue(preferencesStorageKey, options);
}

export function resetAllStorage(options: StorageOptions = {}): number {
  return resetStoredValues(options);
}
