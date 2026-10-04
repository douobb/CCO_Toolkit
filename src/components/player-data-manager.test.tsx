/* @vitest-environment happy-dom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createPlayerDataExportFile,
  createStoredPlayerDataExport,
  downloadPlayerDataExportFile,
  type PlayerDataExportFile,
  type PlayerDataExportResult,
} from '@/lib/player-data-export';
import {
  commitPlayerDataImport,
  prepareStoredPlayerDataImport,
  type PlayerDataImportOptions,
  type PlayerDataImportPlan,
  type PlayerDataImportPreparationResult,
} from '@/lib/player-data-import';
import type { PlayerDataEnvelope, PlayerDataSectionId } from '@/lib/player-data-contract';
import type { StorageLike } from '@/lib/storage';
import {
  PlayerDataManager,
  type PlayerDataManagerLabels,
  type PlayerDataManagerProps,
  type PlayerDataManagerServices,
} from './player-data-manager';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels: PlayerDataManagerLabels = {
  title: 'Player data manager',
  description: 'Keep player data in this browser.',
  exportTitle: 'Export',
  exportDescription: 'Download a browser-only backup.',
  exportButton: 'Export player data',
  exporting: 'Exporting…',
  exportIncludes: 'Included data',
  progression: 'Progression',
  playerAttributes: 'Player attributes',
  inventory: 'Inventory',
  lootBoxHistory: 'Loot-box history',
  exportExcludes: 'Not included',
  prices: 'Prices',
  exchangeRates: 'Exchange rates',
  buffs: 'BUFF',
  exportSuccess: 'Export downloaded.',
  exportFailure: 'Export failed.',
  importTitle: 'Import',
  importDescription: 'Choose a JSON file; it stays in this browser.',
  fileLabel: 'Player data JSON file',
  fileHint: 'Files are read locally and are not uploaded.',
  selectedFile: 'Selected file',
  readingFile: 'Reading file…',
  preparingImport: 'Preparing preview…',
  fileReadFailure: 'The file could not be read.',
  invalidFile: 'The file is not a valid player-data export.',
  prepareFailure: 'The import preview could not be prepared.',
  currentDataUnavailable: 'Current player data is unavailable.',
  mappingFailed: 'The file cannot be mapped to current data.',
  cancel: 'Cancel import',
  reselect: 'Choose another file',
  previewTitle: 'Import preview',
  sourceApp: 'Source app',
  sourceAppVersion: 'Source app version',
  formatVersion: 'Format version',
  exportedAt: 'Exported at',
  sectionSummary: 'Section summary',
  schemaVersion: 'Schema version',
  status: 'Status',
  changeCount: 'Changes',
  conflictCount: 'Conflicts',
  statusReady: 'Ready',
  statusUnchanged: 'Unchanged',
  statusSkipped: 'Skipped',
  statusUnsupported: 'Unsupported',
  statusNotInFile: 'Not in file',
  unsupportedSections: 'Unsupported sections',
  unsupportedUnknownSection: 'Unknown section',
  unsupportedVersion: 'Unsupported version',
  selectionTitle: 'Data categories',
  sectionNotInFile: 'Not in file',
  sectionUnsupported: 'Unsupported',
  progressionStrategy: 'Progression conflicts',
  playerAttributesStrategy: 'Player-attribute conflicts',
  lootBoxStrategy: 'Loot-box conflicts',
  keepCurrent: 'Keep current',
  overwrite: 'Overwrite',
  inventoryStrategy: 'Inventory strategy',
  merge: 'Merge listed items',
  replace: 'Replace inventory',
  replaceDisabled: 'Replace is available only for a complete inventory file.',
  inventoryCompleteness: 'Inventory completeness',
  completenessComplete: 'Complete',
  completenessPartial: 'Partial',
  completenessManual: 'Manual',
  replaceConfirmation: 'I understand unlisted inventory items will be set to zero.',
  replaceConfirmationDescription: 'This confirmation is separate from the replace option.',
  replaceConfirmationRequired: 'Confirm inventory replacement before continuing.',
  changesTitle: 'Differences',
  diffTableLabel: 'Player data differences',
  section: 'Section',
  key: 'Key',
  currentValue: 'Current value',
  fileValue: 'File value',
  action: 'Action',
  conflict: 'Conflict',
  conflictYes: 'Yes',
  conflictNo: 'No',
  actionAdd: 'Add',
  actionReplace: 'Replace',
  actionRemove: 'Remove',
  actionKeep: 'Keep current',
  actionUnchanged: 'Unchanged',
  noChanges: 'No changes.',
  applyButton: 'Apply import',
  applying: 'Applying…',
  importSuccess: 'Import completed.',
  importFailure: 'Import failed.',
  stalePlan: 'The preview is stale; choose the file again.',
  writeFailed: 'The import could not be written.',
  rollbackFailed: 'The import failed and rollback was incomplete.',
  storageUnavailable: 'Browser storage is unavailable.',
  genericImportFailure: 'The import could not be completed.',
  importCancelled: 'Import cancelled.',
  completedTitle: 'Import complete',
  changedItems: 'Changed stores',
  unavailableValue: 'Unavailable',
};

const sectionIds: readonly PlayerDataSectionId[] = [
  'progression',
  'player-attributes',
  'inventory',
  'loot-box-history',
];

const validText = JSON.stringify({
  format: 'cco-player-data',
  formatVersion: 1,
  exportedAt: '2026-08-30T00:00:00.000Z',
  producer: { app: 'cco-toolkit', appVersion: '0.1.0' },
  sections: [
    {
      id: 'progression',
      schemaVersion: 1,
      data: { levels: [{ id: 'level', value: 10 }] },
    },
    {
      id: 'player-attributes',
      schemaVersion: 1,
      data: { values: [{ id: 'armor', value: 2 }] },
    },
    {
      id: 'inventory',
      schemaVersion: 1,
      data: { completeness: 'complete', items: [] },
    },
    {
      id: 'loot-box-history',
      schemaVersion: 1,
      data: { records: [], rollups: [] },
    },
  ],
});

const defaultManagerOptions: PlayerDataImportOptions = {
  selectedSections: [...sectionIds],
  progressionStrategy: 'keep-current',
  playerAttributesStrategy: 'keep-current',
  inventoryStrategy: 'merge',
  confirmCompleteInventoryReplacement: false,
  lootBoxStrategy: 'keep-current',
};

function createPlan(options: PlayerDataImportOptions = {}): PlayerDataImportPlan {
  const resolved = {
    ...defaultManagerOptions,
    ...options,
    selectedSections: [...(options.selectedSections ?? sectionIds)],
  };

  return {
    source: {
      formatVersion: 1,
      exportedAt: '2026-08-30T00:00:00.000Z',
      producer: { app: 'cco-toolkit', appVersion: '0.1.0' },
    },
    options: resolved,
    changes: [
      {
        sectionId: 'progression',
        key: 'level',
        currentValue: 1,
        incomingValue: 10,
        action: 'keep',
        conflict: true,
      },
      {
        sectionId: 'player-attributes',
        key: 'armor',
        currentValue: undefined,
        incomingValue: 2,
        action: 'add',
        conflict: false,
      },
    ],
    sections: sectionIds.map((id) => ({
      id,
      schemaVersion: 1,
      status: resolved.selectedSections.includes(id) ? 'ready' : 'skipped',
      changeCount: id === 'progression' || id === 'player-attributes' ? 1 : 0,
      conflictCount: id === 'progression' ? 1 : 0,
    })),
    unsupportedSections: [],
    transaction: {
      expectedRawValues: {},
      originalRawValues: {},
      writeKeys: [],
    },
  } as PlayerDataImportPlan;
}

function createStorage(): StorageLike & { setCalls: number } {
  return {
    setCalls: 0,
    length: 0,
    key: () => null,
    getItem: () => null,
    setItem() {
      this.setCalls += 1;
    },
    removeItem() {},
  };
}

function createServices(
  prepareImpl?: (
    text: string,
    options: PlayerDataImportOptions,
  ) => PlayerDataImportPreparationResult,
) {
  const envelope = JSON.parse(validText) as PlayerDataEnvelope;
  const exportFile: PlayerDataExportFile = {
    filename: 'cco-player-data-2026-08-30.json',
    mimeType: 'application/json',
    text: validText,
    size: new TextEncoder().encode(validText).byteLength,
  };
  const createStored = vi.fn((
    _options: Parameters<typeof createStoredPlayerDataExport>[0] = {},
  ): PlayerDataExportResult => ({ success: true, envelope }));
  const createFile = vi.fn((
    _value: unknown,
  ): PlayerDataExportFile | undefined => exportFile);
  const download = vi.fn((
    _file: PlayerDataExportFile,
  ) => true);
  const prepare = vi.fn((
    text: string,
    options: Parameters<typeof prepareStoredPlayerDataImport>[1] = {},
  ): PlayerDataImportPreparationResult => prepareImpl
    ? prepareImpl(text, options)
    : { success: true, plan: createPlan(options) });
  const commit = vi.fn((
    _plan: PlayerDataImportPlan,
    _options: Parameters<typeof commitPlayerDataImport>[1] = {},
  ) => ({ success: true as const, changedKeys: ['player-data'] }));
  const readFile = vi.fn(async (_file: File) => validText);

  const services: PlayerDataManagerServices = {
    createStoredPlayerDataExport: createStored,
    createPlayerDataExportFile: createFile,
    downloadPlayerDataExportFile: download,
    prepareStoredPlayerDataImport: prepare,
    commitPlayerDataImport: commit,
    readFile,
  };
  return { services, createStored, createFile, download, prepare, commit, readFile };
}

const roots: Root[] = [];

afterEach(() => {
  roots.splice(0).forEach((root) => root.unmount());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

async function renderManager(
  services: PlayerDataManagerServices,
  props: Partial<PlayerDataManagerProps> = {},
) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<PlayerDataManager labels={labels} services={services} {...props} />);
  });
  return container;
}

async function selectFile(container: HTMLElement, text = validText) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['fixture'], 'player-data.json', { type: 'application/json' });
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [file],
  });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
  return { input, file, text };
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(text));
  if (!button) throw new Error(`找不到按鈕：${text}`);
  return button as HTMLButtonElement;
}

function findLabeledControl(container: HTMLElement, text: string): HTMLInputElement {
  const label = [...container.querySelectorAll('label')].find((candidate) =>
    candidate.textContent?.includes(text));
  const control = label?.querySelector('input');
  if (!control) throw new Error(`找不到控制項：${text}`);
  return control;
}

async function click(element: HTMLElement) {
  await act(async () => {
    element.click();
  });
}

describe('PlayerDataManager', () => {
  it('匯出只呼叫正式 API 並清楚顯示四類包含／排除摘要', async () => {
    const { services, createStored, createFile, download } = createServices();
    const container = await renderManager(services);

    await click(findButton(container, labels.exportButton));

    expect(createStored).toHaveBeenCalledTimes(1);
    expect(createFile).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledTimes(1);
    for (const label of [labels.progression, labels.playerAttributes, labels.inventory, labels.lootBoxHistory]) {
      expect(container.textContent).toContain(label);
    }
    for (const label of [labels.prices, labels.exchangeRates, labels.buffs]) {
      expect(container.textContent).toContain(label);
    }
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(labels.exportSuccess);
  });

  it('非同步讀檔期間顯示等待，無效檔案顯示可聚焦 alert', async () => {
    const pending: { resolve: (value: string) => void } = {
      resolve: () => {},
    };
    const { services, readFile } = createServices(() => ({
      success: false,
      issues: [{
        code: 'invalid-json',
        source: 'file',
        path: [],
        message: 'invalid',
      }],
    }));
    readFile.mockImplementation(() => new Promise((resolve) => {
      pending.resolve = resolve;
    }));
    const container = await renderManager(services);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['bad'], 'bad.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('[role="status"]')?.textContent).toContain(labels.readingFile);

    await act(async () => {
      pending.resolve('{bad');
      await Promise.resolve();
      await Promise.resolve();
    });
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain(labels.invalidFile);
    expect(alert?.getAttribute('tabindex')).toBe('-1');
    const fileLabel = [...container.querySelectorAll('label')]
      .find((candidate) => candidate.textContent === labels.fileLabel);
    expect(fileLabel?.htmlFor).toBe(input.id);
  });

  it('合法預覽只讀取資料且尚未提交或直接寫入 storage', async () => {
    const storage = createStorage();
    const { services, prepare, commit } = createServices();
    const container = await renderManager(services, { storage });

    await selectFile(container);

    expect(prepare).toHaveBeenCalledWith(validText, expect.objectContaining({
      selectedSections: sectionIds,
    }));
    expect(container.textContent).toContain(labels.previewTitle);
    expect(container.textContent).toContain('cco-toolkit');
    expect(container.textContent).toContain('0.1.0');
    expect(container.textContent).toContain('2026-08-30T00:00:00.000Z');
    expect(commit).not.toHaveBeenCalled();
    expect(storage.setCalls).toBe(0);
  });

  it('類別與策略變動都以原始文字重新建立 plan', async () => {
    const { services, prepare } = createServices();
    const container = await renderManager(services);
    await selectFile(container);

    const progression = findLabeledControl(container, labels.progression);
    await click(progression);
    const progressionOptions = prepare.mock.calls.at(-1)?.[1];
    expect(prepare.mock.calls.at(-1)?.[0]).toBe(validText);
    expect(progressionOptions?.selectedSections).not.toContain('progression');

    const overwrite = container.querySelector(
      'input[name="player-data-manager-progressionStrategy"][value="overwrite"]',
    ) as HTMLInputElement;
    await click(overwrite);
    expect(prepare.mock.calls.at(-1)?.[0]).toBe(validText);
    expect(prepare.mock.calls.at(-1)?.[1]).toMatchObject({ progressionStrategy: 'overwrite' });
  });

  it('complete inventory replace 需要獨立二次確認，成功後以同一份 plan 提交一次', async () => {
    let confirmedPlan: PlayerDataImportPlan | undefined;
    const { services, prepare, commit } = createServices((_text, options) => {
      if (options.inventoryStrategy === 'replace' && !options.confirmCompleteInventoryReplacement) {
        return {
          success: false,
          issues: [{
            code: 'confirmation-required',
            source: 'inventory',
            path: [],
            message: 'confirm',
          }],
        };
      }
      confirmedPlan = createPlan(options);
      return { success: true, plan: confirmedPlan };
    });
    const container = await renderManager(services);
    await selectFile(container);

    const replace = container.querySelector(
      'input[name="player-data-manager-inventory-strategy"][value="replace"]',
    ) as HTMLInputElement;
    expect(replace.disabled).toBe(false);
    await click(replace);
    expect(prepare.mock.calls.at(-1)?.[1]).toMatchObject({
      inventoryStrategy: 'replace',
      confirmCompleteInventoryReplacement: false,
    });
    const confirmation = findLabeledControl(container, labels.replaceConfirmation);
    expect(confirmation.checked).toBe(false);
    await click(confirmation);
    expect(prepare.mock.calls.at(-1)?.[1]).toMatchObject({
      inventoryStrategy: 'replace',
      confirmCompleteInventoryReplacement: true,
    });
    expect(confirmedPlan).toBeDefined();

    await click(findButton(container, labels.applyButton));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0]?.[0]).toBe(confirmedPlan);
    expect(container.textContent).toContain(labels.completedTitle);
    expect(findButton(container, labels.applyButton).disabled).toBe(true);
  });

  it('取消選取背包區塊後，不會要求確認未套用的完整背包取代', async () => {
    const { services } = createServices();
    const container = await renderManager(services);
    await selectFile(container);

    const replace = container.querySelector(
      'input[name="player-data-manager-inventory-strategy"][value="replace"]',
    ) as HTMLInputElement;
    await click(replace);
    expect(container.querySelector('[role="alert"]')?.textContent)
      .toContain(labels.replaceConfirmationRequired);

    await click(findLabeledControl(container, labels.inventory));

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(findButton(container, labels.applyButton).disabled).toBe(false);
  });

  it('可取消目前匯入並重新選檔，取消後不保留舊 plan', async () => {
    const { services, commit } = createServices();
    const container = await renderManager(services);
    const { input } = await selectFile(container);
    expect(container.textContent).toContain(labels.previewTitle);

    await click(findButton(container, labels.cancel));

    expect(input.value).toBe('');
    expect(container.textContent).not.toContain(labels.previewTitle);
    expect(commit).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(labels.importCancelled);
  });
});
