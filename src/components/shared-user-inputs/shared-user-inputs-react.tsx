'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import {
  createSharedUserInputsStore,
  defaultSharedUserInputs,
  type SharedUserInputs,
  type SharedUserInputsStore,
} from '@/lib/storage';

const SharedUserInputsStoreContext = createContext<SharedUserInputsStore | null>(null);

/** SSR 與第一次 client render 共用的穩定 snapshot，避免 localStorage 造成 hydration 差異。 */
export function getSharedUserInputsServerSnapshot(): SharedUserInputs {
  return defaultSharedUserInputs;
}

export function SharedUserInputsProvider({
  children,
  store: injectedStore,
}: {
  children: ReactNode;
  /** 僅供測試或非瀏覽器 host 注入；正式頁面只建立一個內部 store。 */
  store?: SharedUserInputsStore;
}) {
  const [ownedStore] = useState(
    () => injectedStore ?? createSharedUserInputsStore({ autoHydrate: false }),
  );
  const activeEffects = useRef(0);

  useEffect(() => {
    activeEffects.current += 1;
    ownedStore.hydrate();

    return () => {
      activeEffects.current -= 1;
      if (injectedStore) return;

      // React Strict Mode 會立即重跑 effect；延後一個 microtask 可辨識真正卸載。
      queueMicrotask(() => {
        if (activeEffects.current === 0) ownedStore.dispose();
      });
    };
  }, [injectedStore, ownedStore]);

  return (
    <SharedUserInputsStoreContext.Provider value={ownedStore}>
      {children}
    </SharedUserInputsStoreContext.Provider>
  );
}

export function useSharedUserInputsStore(): SharedUserInputsStore {
  const store = useContext(SharedUserInputsStoreContext);
  if (!store) {
    throw new Error('Shared User Inputs consumer 必須放在 SharedUserInputsProvider 內。');
  }
  return store;
}

export function useSharedUserInputs(): SharedUserInputs {
  const store = useSharedUserInputsStore();
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    getSharedUserInputsServerSnapshot,
  );
}
