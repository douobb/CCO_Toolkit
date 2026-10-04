import {
  clearStoredValue,
  getToolStorageKey,
  loadStoredValue,
  saveStoredValue,
  type LoadStorageOptions,
  type StorageOptions,
} from './storage';

export function loadToolState<T>(
  toolId: string,
  options: Omit<LoadStorageOptions<T>, 'storage'> & StorageOptions = {},
): T | undefined {
  return loadStoredValue(getToolStorageKey(toolId), options);
}

export function saveToolState<T>(
  toolId: string,
  state: T,
  options: StorageOptions = {},
): boolean {
  return saveStoredValue(getToolStorageKey(toolId), state, options);
}

export function clearToolState(
  toolId: string,
  options: StorageOptions = {},
): boolean {
  return clearStoredValue(getToolStorageKey(toolId), options);
}
