// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';

import {
  commitPlayerDataImport,
  prepareStoredPlayerDataImport,
} from './player-data-import';
import { defaultSharedUserInputs } from './shared-user-inputs';
import {
  createSharedUserInputsStore,
  saveSharedUserInputs,
} from './storage';

afterEach(() => window.localStorage.clear());

describe('玩家資料匯入通知', () => {
  it('提交完成後讓同頁共用設定 store 立即取得新值', () => {
    saveSharedUserInputs(defaultSharedUserInputs);
    const store = createSharedUserInputsStore();
    let notifications = 0;
    const unsubscribe = store.subscribe(() => { notifications += 1; });
    const text = JSON.stringify({
      format: 'cco-player-data',
      formatVersion: 1,
      exportedAt: '2026-08-30T00:00:00.000Z',
      producer: { app: 'cco-toolkit', appVersion: '0.1.0' },
      sections: [{
        id: 'player-attributes',
        schemaVersion: 1,
        data: { values: [{ id: 'max-health', value: 4321 }] },
      }],
    });
    const prepared = prepareStoredPlayerDataImport(text, {
      playerAttributesStrategy: 'overwrite',
    });
    expect(prepared.success).toBe(true);
    if (!prepared.success) return;

    expect(commitPlayerDataImport(prepared.plan).success).toBe(true);
    expect(store.getSnapshot().equipment.maxHealth).toBe(4321);
    expect(notifications).toBe(1);

    unsubscribe();
    store.dispose();
  });
});
