'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import { loadToolState, saveToolState } from './tool-storage';
import { getToolStorageKey } from './storage';

export interface UseToolStateOptions<T> {
  readonly validate?: (value: unknown) => value is T;
  readonly normalize?: (value: unknown) => T | undefined;
  /** 未找到工具專屬狀態時，在 storage hydration 完成後建立的初始值。 */
  readonly initialize?: () => T;
}

/**
 * 管理工具本機狀態的安全 hydration 與保存生命週期。
 *
 * 初始 render 不讀取瀏覽器 storage；讀取完成後才允許保存。使用 state
 * 旗標而非只依賴 ref，讓 React Strict Mode 重跑 mount effects 時不會把
 * 尚未載入的預設值寫回並覆蓋既有紀錄。
 */
export function useToolStateStorage<T>(
  toolId: string,
  initialState: T | (() => T),
  options: UseToolStateOptions<T> = {},
): readonly [T, Dispatch<SetStateAction<T>>] {
  const { initialize, normalize, validate } = options;
  const [state, setState] = useState(initialState);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [stateInitialized, setStateInitialized] = useState(false);
  const externalUpdate = useRef(false);

  useEffect(() => {
    const stored = loadToolState<T>(toolId, {
      normalize,
      validate,
    });

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;

      if (stored !== undefined) {
        setState(stored);
        setStateInitialized(true);
      }

      setStorageLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [normalize, toolId, validate]);

  useEffect(() => {
    if (!storageLoaded || stateInitialized) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (initialize) setState(initialize());
      setStateInitialized(true);
    });

    return () => {
      cancelled = true;
    };
  }, [initialize, stateInitialized, storageLoaded]);

  const setInitializedState = useCallback<Dispatch<SetStateAction<T>>>((nextState) => {
    setStateInitialized(true);
    setState(nextState);
  }, []);

  useEffect(() => {
    if (!storageLoaded || !stateInitialized) return;
    if (externalUpdate.current) {
      externalUpdate.current = false;
      return;
    }
    saveToolState(toolId, state);
  }, [state, stateInitialized, storageLoaded, toolId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storageKey = getToolStorageKey(toolId);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      const stored = loadToolState<T>(toolId, { normalize, validate });
      if (stored === undefined) return;

      externalUpdate.current = true;
      setStateInitialized(true);
      setState(stored);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [normalize, toolId, validate]);

  return [state, setInitializedState];
}
