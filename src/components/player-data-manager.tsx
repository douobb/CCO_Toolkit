'use client';

import * as React from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
} from 'react';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import {
  createPlayerDataExportFile,
  createStoredPlayerDataExport,
  downloadPlayerDataExportFile,
} from '@/lib/player-data-export';
import {
  commitPlayerDataImport,
  prepareStoredPlayerDataImport,
  type PlayerDataConflictStrategy,
  type PlayerDataImportChange,
  type PlayerDataImportCommitResult,
  type PlayerDataImportPlan,
  type PlayerDataImportPreparationResult,
  type PlayerDataImportSectionSummary,
  type PlayerDataInventoryStrategy,
} from '@/lib/player-data-import';
import {
  inspectPlayerDataFile,
  type PlayerDataKnownSection,
  type PlayerDataSectionId,
} from '@/lib/player-data-contract';
import type { StorageLike } from '@/lib/storage';
import { cn } from '@/lib/cn';

/**
 * 玩家資料管理元件的所有可見文字都由外部 labels 提供，方便設定頁直接
 * 將 zh-tw／en 字典映射進來，而不讓元件自行維護翻譯。
 */
export interface PlayerDataManagerLabels {
  title: string;
  exportTitle: string;
  exportDescription: string;
  exportButton: string;
  exporting: string;
  exportIncludes: string;
  progression: string;
  playerAttributes: string;
  inventory: string;
  lootBoxHistory: string;
  exportExcludes: string;
  prices: string;
  exchangeRates: string;
  buffs: string;
  exportSuccess: string;
  exportFailure: string;
  importTitle: string;
  importDescription: string;
  fileLabel: string;
  fileHint: string;
  selectedFile: string;
  readingFile: string;
  preparingImport: string;
  fileReadFailure: string;
  invalidFile: string;
  prepareFailure: string;
  currentDataUnavailable: string;
  mappingFailed: string;
  cancel: string;
  reselect: string;
  previewTitle: string;
  sourceApp: string;
  sourceAppVersion: string;
  formatVersion: string;
  exportedAt: string;
  sectionSummary: string;
  schemaVersion: string;
  status: string;
  changeCount: string;
  conflictCount: string;
  statusReady: string;
  statusUnchanged: string;
  statusSkipped: string;
  statusUnsupported: string;
  statusNotInFile: string;
  unsupportedSections: string;
  unsupportedUnknownSection: string;
  unsupportedVersion: string;
  selectionTitle: string;
  sectionNotInFile: string;
  sectionUnsupported: string;
  progressionStrategy: string;
  playerAttributesStrategy: string;
  lootBoxStrategy: string;
  keepCurrent: string;
  overwrite: string;
  inventoryStrategy: string;
  merge: string;
  replace: string;
  replaceDisabled: string;
  inventoryCompleteness: string;
  completenessComplete: string;
  completenessPartial: string;
  completenessManual: string;
  replaceConfirmation: string;
  replaceConfirmationDescription: string;
  replaceConfirmationRequired: string;
  changesTitle: string;
  diffTableLabel: string;
  section: string;
  key: string;
  currentValue: string;
  fileValue: string;
  action: string;
  conflict: string;
  conflictYes: string;
  conflictNo: string;
  actionAdd: string;
  actionReplace: string;
  actionRemove: string;
  actionKeep: string;
  actionUnchanged: string;
  noChanges: string;
  applyButton: string;
  applying: string;
  importSuccess: string;
  importFailure: string;
  stalePlan: string;
  writeFailed: string;
  rollbackFailed: string;
  storageUnavailable: string;
  genericImportFailure: string;
  importCancelled: string;
  completedTitle: string;
  changedItems: string;
  unavailableValue: string;
}

/** 僅供測試或非瀏覽器 host 注入；正式元件預設使用網站正式資料 API。 */
export interface PlayerDataManagerServices {
  createStoredPlayerDataExport?: typeof createStoredPlayerDataExport;
  createPlayerDataExportFile?: typeof createPlayerDataExportFile;
  downloadPlayerDataExportFile?: typeof downloadPlayerDataExportFile;
  prepareStoredPlayerDataImport?: typeof prepareStoredPlayerDataImport;
  commitPlayerDataImport?: typeof commitPlayerDataImport;
  readFile?: (file: File) => Promise<string>;
}

export type PlayerDataManagerProps = Omit<
  ComponentPropsWithoutRef<'section'>,
  'title' | 'children'
> & {
  labels: PlayerDataManagerLabels;
  services?: PlayerDataManagerServices;
  /** 僅供測試或非瀏覽器 host 注入；元件不會直接操作此 storage。 */
  storage?: StorageLike | null;
  /** 同頁放置多個元件時用來維持各自 label/input 的唯一 ID。 */
  idPrefix?: string;
};

type ImportOptions = {
  selectedSections: PlayerDataSectionId[];
  progressionStrategy: PlayerDataConflictStrategy;
  playerAttributesStrategy: PlayerDataConflictStrategy;
  inventoryStrategy: PlayerDataInventoryStrategy;
  confirmCompleteInventoryReplacement: boolean;
  lootBoxStrategy: PlayerDataConflictStrategy;
};

type ImportPhase = 'idle' | 'reading' | 'preparing' | 'preview' | 'committing' | 'completed';
type Feedback = { kind: 'success' | 'error'; message: string };
type InventoryCompleteness = 'complete' | 'partial' | 'manual';
type DisplaySummaryStatus = PlayerDataImportSectionSummary['status'] | 'not-in-file';

type DisplaySummary = {
  id: string;
  schemaVersion: number | null;
  status: DisplaySummaryStatus;
  changeCount: number;
  conflictCount: number;
};

const sectionDefinitions: readonly PlayerDataSectionId[] = [
  'progression',
  'player-attributes',
  'inventory',
  'loot-box-history',
];

const defaultImportOptions: ImportOptions = {
  selectedSections: [...sectionDefinitions],
  progressionStrategy: 'keep-current',
  playerAttributesStrategy: 'keep-current',
  inventoryStrategy: 'merge',
  confirmCompleteInventoryReplacement: false,
  lootBoxStrategy: 'keep-current',
};

const defaultReadFile = (file: File) => file.text();

function cloneDefaultImportOptions(): ImportOptions {
  return {
    ...defaultImportOptions,
    selectedSections: [...defaultImportOptions.selectedSections],
  };
}

function getSectionLabel(labels: PlayerDataManagerLabels, id: string): string {
  switch (id) {
    case 'progression': return labels.progression;
    case 'player-attributes': return labels.playerAttributes;
    case 'inventory': return labels.inventory;
    case 'loot-box-history': return labels.lootBoxHistory;
    default: return id;
  }
}

function getStatusLabel(labels: PlayerDataManagerLabels, status: DisplaySummaryStatus): string {
  switch (status) {
    case 'ready': return labels.statusReady;
    case 'unchanged': return labels.statusUnchanged;
    case 'skipped': return labels.statusSkipped;
    case 'unsupported': return labels.statusUnsupported;
    case 'not-in-file': return labels.statusNotInFile;
    default: return labels.statusNotInFile;
  }
}

function getActionLabel(
  labels: PlayerDataManagerLabels,
  action: PlayerDataImportChange['action'],
): string {
  switch (action) {
    case 'add': return labels.actionAdd;
    case 'replace': return labels.actionReplace;
    case 'remove': return labels.actionRemove;
    case 'keep': return labels.actionKeep;
    case 'unchanged': return labels.actionUnchanged;
    default: return labels.actionUnchanged;
  }
}

function getUnsupportedReasonLabel(
  labels: PlayerDataManagerLabels,
  reason: 'unknown-section' | 'unsupported-version',
): string {
  return reason === 'unknown-section'
    ? labels.unsupportedUnknownSection
    : labels.unsupportedVersion;
}

function getCompletenessLabel(
  labels: PlayerDataManagerLabels,
  completeness: InventoryCompleteness,
): string {
  switch (completeness) {
    case 'complete': return labels.completenessComplete;
    case 'partial': return labels.completenessPartial;
    case 'manual': return labels.completenessManual;
    default: return labels.unavailableValue;
  }
}

function inspectFileMetadata(text: string): {
  readonly availableSections: readonly PlayerDataSectionId[];
  readonly inventoryCompleteness?: InventoryCompleteness;
} {
  try {
    const decoded: unknown = JSON.parse(text);
    const inspected = inspectPlayerDataFile(decoded);
    if (!inspected.success) return { availableSections: [] };

    const availableSections = inspected.supportedSections
      .map((section) => section.id)
      .filter((id, index, ids): id is PlayerDataSectionId =>
        sectionDefinitions.includes(id) && ids.indexOf(id) === index);
    const inventory = inspected.supportedSections.find(
      (section): section is Extract<PlayerDataKnownSection, { readonly id: 'inventory' }> =>
        section.id === 'inventory',
    );

    return {
      availableSections,
      inventoryCompleteness: inventory?.data.completeness,
    };
  } catch {
    return { availableSections: [] };
  }
}

function formatValue(value: unknown, labels: PlayerDataManagerLabels): string {
  if (value === undefined) return labels.unavailableValue;
  if (typeof value === 'string') return value;

  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? labels.unavailableValue : serialized;
  } catch {
    return labels.unavailableValue;
  }
}

function getPreparationFailureMessage(
  labels: PlayerDataManagerLabels,
  result: Extract<PlayerDataImportPreparationResult, { readonly success: false }>,
): string {
  const issue = result.issues[0];
  if (!issue) return labels.prepareFailure;

  switch (issue.code) {
    case 'invalid-json':
    case 'file-too-large':
    case 'invalid-contract':
      return labels.invalidFile;
    case 'storage-unavailable':
      return labels.storageUnavailable;
    case 'invalid-current-data':
      return labels.currentDataUnavailable;
    case 'mapping-failed':
      return labels.mappingFailed;
    case 'confirmation-required':
      return labels.replaceConfirmationRequired;
    default:
      return labels.prepareFailure;
  }
}

function getCommitFailureMessage(
  labels: PlayerDataManagerLabels,
  result: Extract<PlayerDataImportCommitResult, { readonly success: false }>,
): string {
  const reason = (() => {
    switch (result.status) {
      case 'stale-plan': return labels.stalePlan;
      case 'write-failed': return labels.writeFailed;
      case 'rollback-failed': return labels.rollbackFailed;
      case 'storage-unavailable': return labels.storageUnavailable;
      default: return labels.genericImportFailure;
    }
  })();
  return `${labels.importFailure} ${reason}`;
}

function getDisplaySummaries(plan: PlayerDataImportPlan): readonly DisplaySummary[] {
  const knownSummaries = sectionDefinitions.map((id) => {
    const summary = plan.sections.find((section) => section.id === id);
    return summary ?? {
      id,
      schemaVersion: null,
      status: 'not-in-file' as const,
      changeCount: 0,
      conflictCount: 0,
    };
  });
  const unsupportedOrFutureSummaries = plan.sections.filter(
    (summary) => !sectionDefinitions.includes(summary.id as PlayerDataSectionId),
  );
  return [...knownSummaries, ...unsupportedOrFutureSummaries];
}

function getStorageOptions(storage: StorageLike | null | undefined):
  { readonly storage?: StorageLike | null } {
  return storage === undefined ? {} : { storage };
}

function isInventoryStrategy(
  value: string,
): value is PlayerDataInventoryStrategy {
  return value === 'merge' || value === 'replace';
}

function isConflictStrategy(value: string): value is PlayerDataConflictStrategy {
  return value === 'keep-current' || value === 'overwrite';
}

export function PlayerDataManager({
  labels,
  services,
  storage,
  idPrefix = 'player-data-manager',
  className,
  ...props
}: PlayerDataManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const operationRef = useRef(0);
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [exporting, setExporting] = useState(false);
  const [fileName, setFileName] = useState<string>();
  const [rawText, setRawText] = useState<string>();
  const [availableSections, setAvailableSections] = useState<readonly PlayerDataSectionId[]>([]);
  const [inventoryCompleteness, setInventoryCompleteness] = useState<InventoryCompleteness>();
  const [options, setOptions] = useState<ImportOptions>(cloneDefaultImportOptions);
  const [plan, setPlan] = useState<PlayerDataImportPlan>();
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>();

  const resolvedServices = useMemo(() => ({
    createStoredPlayerDataExport:
      services?.createStoredPlayerDataExport ?? createStoredPlayerDataExport,
    createPlayerDataExportFile:
      services?.createPlayerDataExportFile ?? createPlayerDataExportFile,
    downloadPlayerDataExportFile:
      services?.downloadPlayerDataExportFile ?? downloadPlayerDataExportFile,
    prepareStoredPlayerDataImport:
      services?.prepareStoredPlayerDataImport ?? prepareStoredPlayerDataImport,
    commitPlayerDataImport:
      services?.commitPlayerDataImport ?? commitPlayerDataImport,
    readFile: services?.readFile ?? defaultReadFile,
  }), [services]);

  const headingId = `${idPrefix}-title`;
  const exportTitleId = `${idPrefix}-export-title`;
  const importTitleId = `${idPrefix}-import-title`;
  const fileInputId = `${idPrefix}-file`;
  const busy = exporting || phase === 'reading' || phase === 'preparing' || phase === 'committing';
  const hasFile = rawText !== undefined;
  const hasSelectedFile = fileName !== undefined;
  const showImportControls = hasFile && (plan !== undefined || needsConfirmation);
  const inventoryAvailable = availableSections.includes('inventory');
  const inventoryReplaceAvailable = inventoryAvailable && inventoryCompleteness === 'complete';
  const importControlsDisabled = busy || phase === 'completed';

  useEffect(() => {
    if (!feedback) return;
    feedbackRef.current?.focus();
  }, [feedback]);

  const setFailure = useCallback((message: string) => {
    setFeedback({ kind: 'error', message });
  }, []);

  const prepare = useCallback((text: string, nextOptions: ImportOptions) => {
    return resolvedServices.prepareStoredPlayerDataImport(
      text,
      { ...nextOptions, ...getStorageOptions(storage) },
    );
  }, [resolvedServices, storage]);

  const applyPreparedResult = useCallback((
    result: PlayerDataImportPreparationResult,
    optionsForPlan: ImportOptions,
  ) => {
    const replacementConfirmationMissing =
      optionsForPlan.selectedSections.includes('inventory')
      && inventoryCompleteness === 'complete'
      && optionsForPlan.inventoryStrategy === 'replace'
      && !optionsForPlan.confirmCompleteInventoryReplacement;
    if (result.success && replacementConfirmationMissing) {
      setOptions(optionsForPlan);
      setNeedsConfirmation(true);
      setPhase('idle');
      setFailure(labels.replaceConfirmationRequired);
      return;
    }

    if (result.success) {
      setOptions(optionsForPlan);
      setPlan(result.plan);
      setNeedsConfirmation(false);
      setPhase('preview');
      return;
    }

    setOptions(optionsForPlan);
    const confirmationRequired = result.issues.some(
      (issue) => issue.code === 'confirmation-required',
    );
    // 整體取代需要第二次確認；保留既有預覽但標記為未完成，讓使用者
    // 能在同一份原始檔案上勾選確認，而不可能誤套用舊 plan。
    if (!confirmationRequired) setPlan(undefined);
    setNeedsConfirmation(confirmationRequired);
    setPhase('idle');
    setFailure(getPreparationFailureMessage(labels, result));
  }, [inventoryCompleteness, labels, setFailure]);

  const reprepare = useCallback((nextOptions: ImportOptions) => {
    if (!rawText || importControlsDisabled) return;

    setOptions(nextOptions);
    setNeedsConfirmation(false);
    setFeedback(undefined);
    setPhase('preparing');

    try {
      const result = prepare(rawText, nextOptions);
      applyPreparedResult(result, nextOptions);
    } catch {
      setPlan(undefined);
      setPhase('idle');
      setFailure(labels.prepareFailure);
    }
  }, [applyPreparedResult, importControlsDisabled, labels.prepareFailure, prepare, rawText, setFailure]);

  const handleExport = useCallback(() => {
    if (busy) return;

    setExporting(true);
    setFeedback(undefined);
    try {
      const result = resolvedServices.createStoredPlayerDataExport(getStorageOptions(storage));
      if (!result.success) {
        setFailure(labels.exportFailure);
        return;
      }

      const file = resolvedServices.createPlayerDataExportFile(result.envelope);
      if (!file || !resolvedServices.downloadPlayerDataExportFile(file)) {
        setFailure(labels.exportFailure);
        return;
      }

      setFeedback({ kind: 'success', message: `${labels.exportSuccess} ${file.filename}` });
    } catch {
      setFailure(labels.exportFailure);
    } finally {
      setExporting(false);
    }
  }, [busy, labels.exportFailure, labels.exportSuccess, resolvedServices, setFailure, storage]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const operation = operationRef.current + 1;
    operationRef.current = operation;
    const initialOptions = cloneDefaultImportOptions();
    setFileName(file.name);
    setRawText(undefined);
    setAvailableSections([]);
    setInventoryCompleteness(undefined);
    setOptions(initialOptions);
    setPlan(undefined);
    setNeedsConfirmation(false);
    setFeedback(undefined);
    setPhase('reading');

    void (async () => {
      try {
        const text = await resolvedServices.readFile(file);
        if (operationRef.current !== operation) return;

        const metadata = inspectFileMetadata(text);
        setRawText(text);
        setAvailableSections(metadata.availableSections);
        setInventoryCompleteness(metadata.inventoryCompleteness);
        setPhase('preparing');

        let result: PlayerDataImportPreparationResult;
        try {
          result = prepare(text, initialOptions);
        } catch {
          setPhase('idle');
          setFailure(labels.prepareFailure);
          return;
        }
        if (operationRef.current !== operation) return;
        applyPreparedResult(result, initialOptions);
      } catch {
        if (operationRef.current !== operation) return;
        setRawText(undefined);
        setAvailableSections([]);
        setInventoryCompleteness(undefined);
        setPhase('idle');
        setFailure(labels.fileReadFailure);
      }
    })();
  }, [applyPreparedResult, labels.fileReadFailure, labels.prepareFailure, prepare, resolvedServices, setFailure]);

  const handleCancel = useCallback(() => {
    if (phase === 'committing' || exporting) return;
    operationRef.current += 1;
    if (inputRef.current) inputRef.current.value = '';
    setFileName(undefined);
    setRawText(undefined);
    setAvailableSections([]);
    setInventoryCompleteness(undefined);
    setOptions(cloneDefaultImportOptions());
    setPlan(undefined);
    setNeedsConfirmation(false);
    setPhase('idle');
    setFeedback({ kind: 'success', message: labels.importCancelled });
  }, [exporting, labels.importCancelled, phase]);

  const handleReselect = useCallback(() => {
    if (busy) return;
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.click();
    }
  }, [busy]);

  const changeSection = useCallback((sectionId: PlayerDataSectionId) => {
    const selectedSections = options.selectedSections.includes(sectionId)
      ? options.selectedSections.filter((id) => id !== sectionId)
      : [...options.selectedSections, sectionId];
    reprepare({ ...options, selectedSections });
  }, [options, reprepare]);

  const changeConflictStrategy = useCallback((
    field: 'progressionStrategy' | 'playerAttributesStrategy' | 'lootBoxStrategy',
    value: string,
  ) => {
    if (!isConflictStrategy(value)) return;
    reprepare({ ...options, [field]: value });
  }, [options, reprepare]);

  const changeInventoryStrategy = useCallback((value: string) => {
    if (!isInventoryStrategy(value)) return;
    reprepare({
      ...options,
      inventoryStrategy: value,
      confirmCompleteInventoryReplacement: value === 'replace'
        ? options.confirmCompleteInventoryReplacement
        : false,
    });
  }, [options, reprepare]);

  const changeReplacementConfirmation = useCallback((checked: boolean) => {
    reprepare({
      ...options,
      confirmCompleteInventoryReplacement: checked,
    });
  }, [options, reprepare]);

  const handleCommit = useCallback(() => {
    if (!plan || busy || phase === 'completed') return;

    setFeedback(undefined);
    setPhase('committing');
    try {
      // commit 必須使用畫面目前顯示的同一份不可變 plan，不重新 prepare。
      const result = resolvedServices.commitPlayerDataImport(
        plan,
        getStorageOptions(storage),
      );
      if (result.success) {
        setPhase('completed');
        setFeedback({
          kind: 'success',
          message: `${labels.importSuccess} ${labels.changedItems}: ${result.changedKeys.length}`,
        });
        return;
      }

      setPhase('preview');
      setFailure(getCommitFailureMessage(labels, result));
    } catch {
      setPhase('preview');
      setFailure(labels.genericImportFailure);
    }
  }, [busy, labels, phase, plan, resolvedServices, setFailure, storage]);

  const renderStrategy = (
    field: 'progressionStrategy' | 'playerAttributesStrategy' | 'lootBoxStrategy',
    title: string,
    available: boolean,
  ) => (
    <fieldset className="space-y-2" disabled={importControlsDisabled || !available}>
      <legend className="text-sm font-medium text-foreground">{title}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex min-h-10 items-center gap-2 rounded-[var(--cco-button-radius)] border border-border px-3 py-2 text-sm">
          <input
            type="radio"
            name={`${idPrefix}-${field}`}
            value="keep-current"
            checked={options[field] === 'keep-current'}
            onChange={(event) => changeConflictStrategy(field, event.target.value)}
          />
          <span>{labels.keepCurrent}</span>
        </label>
        <label className="flex min-h-10 items-center gap-2 rounded-[var(--cco-button-radius)] border border-border px-3 py-2 text-sm">
          <input
            type="radio"
            name={`${idPrefix}-${field}`}
            value="overwrite"
            checked={options[field] === 'overwrite'}
            onChange={(event) => changeConflictStrategy(field, event.target.value)}
          />
          <span>{labels.overwrite}</span>
        </label>
      </div>
    </fieldset>
  );

  return (
    <section
      {...props}
      aria-labelledby={headingId}
      aria-busy={busy}
      className={cn('space-y-6', className)}
      data-player-data-manager
    >
      <Card>
        <CardHeader>
          <CardTitle id={headingId}>{labels.title}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-8">
          <section aria-labelledby={exportTitleId} className="space-y-4">
            <div>
              <h3 id={exportTitleId} className="text-base font-semibold text-foreground">
                {labels.exportTitle}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {labels.exportDescription}
              </p>
            </div>

            <div className="grid gap-4 rounded-[var(--cco-card-radius)] border border-border p-4 sm:grid-cols-2">
              <div>
                <h4 className="text-sm font-medium text-foreground">{labels.exportIncludes}</h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {sectionDefinitions.map((id) => <li key={id}>{getSectionLabel(labels, id)}</li>)}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-foreground">{labels.exportExcludes}</h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>{labels.prices}</li>
                  <li>{labels.exchangeRates}</li>
                  <li>{labels.buffs}</li>
                </ul>
              </div>
            </div>

            <Button type="button" onClick={handleExport} disabled={busy}>
              {exporting ? labels.exporting : labels.exportButton}
            </Button>
          </section>

          <section aria-labelledby={importTitleId} className="space-y-4 border-t border-border pt-8">
            <div>
              <h3 id={importTitleId} className="text-base font-semibold text-foreground">
                {labels.importTitle}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {labels.importDescription}
              </p>
            </div>

            <div className="space-y-3">
              <label htmlFor={fileInputId} className="text-sm font-medium text-foreground">
                {labels.fileLabel}
              </label>
              <input
                ref={inputRef}
                id={fileInputId}
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                disabled={busy}
                aria-describedby={`${fileInputId}-hint`}
                className="block w-full min-w-0 rounded-[var(--cco-input-radius)] border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p id={`${fileInputId}-hint`} className="text-xs leading-5 text-muted-foreground">
                {labels.fileHint}
              </p>
              {fileName ? (
                <p className="break-all text-sm text-muted-foreground" aria-live="polite">
                  {labels.selectedFile}: {fileName}
                </p>
              ) : null}
              {hasSelectedFile ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReselect}
                    disabled={busy}
                  >
                    {labels.reselect}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={phase === 'committing' || exporting}
                  >
                    {labels.cancel}
                  </Button>
                </div>
              ) : null}
            </div>

            {exporting ? (
              <p role="status" aria-live="polite" tabIndex={-1}>
                {labels.exporting}
              </p>
            ) : null}
            {phase === 'reading' ? (
              <p role="status" aria-live="polite" tabIndex={-1}>
                {labels.readingFile}
              </p>
            ) : null}
            {phase === 'preparing' ? (
              <p role="status" aria-live="polite" tabIndex={-1}>
                {labels.preparingImport}
              </p>
            ) : null}

            {feedback ? (
              <div
                ref={feedbackRef}
                role={feedback.kind === 'error' ? 'alert' : 'status'}
                aria-live={feedback.kind === 'error' ? 'assertive' : 'polite'}
                aria-atomic="true"
                tabIndex={-1}
                className={cn(
                  'rounded-[var(--cco-card-radius)] border p-4 text-sm',
                  feedback.kind === 'error'
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : 'border-primary/30 bg-primary/10 text-foreground',
                )}
              >
                {feedback.message}
              </div>
            ) : null}

            {plan ? (
              <section aria-labelledby={`${idPrefix}-preview-title`} className="space-y-5">
                <h3 id={`${idPrefix}-preview-title`} className="text-base font-semibold text-foreground">
                  {labels.previewTitle}
                </h3>

                <dl className="grid gap-3 rounded-[var(--cco-card-radius)] border border-border p-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">{labels.sourceApp}</dt>
                    <dd className="mt-1 break-all font-medium text-foreground">{plan.source.producer.app}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{labels.sourceAppVersion}</dt>
                    <dd className="mt-1 break-all font-medium text-foreground">{plan.source.producer.appVersion}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{labels.formatVersion}</dt>
                    <dd className="mt-1 font-medium text-foreground">{plan.source.formatVersion}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{labels.exportedAt}</dt>
                    <dd className="mt-1 break-all font-medium text-foreground">{plan.source.exportedAt}</dd>
                  </div>
                </dl>

                {inventoryCompleteness ? (
                  <p className="text-sm text-muted-foreground">
                    {labels.inventoryCompleteness}: {getCompletenessLabel(labels, inventoryCompleteness)}
                  </p>
                ) : null}

                <div className="overflow-x-auto rounded-[var(--cco-card-radius)] border border-border">
                  <table className="w-full min-w-[42rem] text-left text-sm">
                    <caption className="sr-only">{labels.sectionSummary}</caption>
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-medium">{labels.section}</th>
                        <th scope="col" className="px-3 py-2 font-medium">{labels.schemaVersion}</th>
                        <th scope="col" className="px-3 py-2 font-medium">{labels.status}</th>
                        <th scope="col" className="px-3 py-2 font-medium">{labels.changeCount}</th>
                        <th scope="col" className="px-3 py-2 font-medium">{labels.conflictCount}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {getDisplaySummaries(plan).map((summary) => (
                        <tr key={`${summary.id}-${summary.schemaVersion ?? 'none'}`}>
                          <th scope="row" className="break-all px-3 py-2 font-medium text-foreground">
                            {getSectionLabel(labels, summary.id)}
                          </th>
                          <td className="px-3 py-2 text-muted-foreground">
                            {summary.schemaVersion ?? labels.unavailableValue}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {getStatusLabel(labels, summary.status)}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{summary.changeCount}</td>
                          <td className="px-3 py-2 text-muted-foreground">{summary.conflictCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {plan.unsupportedSections.length > 0 ? (
                  <div className="space-y-2 rounded-[var(--cco-card-radius)] border border-border p-4">
                    <h4 className="text-sm font-medium text-foreground">{labels.unsupportedSections}</h4>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {plan.unsupportedSections.map((section) => (
                        <li key={`${section.id}-${section.schemaVersion}`}>
                          <span className="break-all">{section.id}</span>: {getUnsupportedReasonLabel(labels, section.reason)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {showImportControls ? (
                  <>
                    <fieldset
                      className="space-y-3"
                      disabled={importControlsDisabled}
                      aria-labelledby={`${idPrefix}-selection-title`}
                    >
                      <legend id={`${idPrefix}-selection-title`} className="text-sm font-medium text-foreground">
                        {labels.selectionTitle}
                      </legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {sectionDefinitions.map((sectionId) => {
                          const available = availableSections.includes(sectionId);
                          const unsupported = plan.sections.some(
                            (summary) => summary.id === sectionId && summary.status === 'unsupported',
                          );
                          const selectable = available && !unsupported;
                          return (
                            <label
                              key={sectionId}
                              className="flex min-h-10 items-center gap-2 rounded-[var(--cco-button-radius)] border border-border px-3 py-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={selectable && options.selectedSections.includes(sectionId)}
                                onChange={() => changeSection(sectionId)}
                                disabled={!selectable || importControlsDisabled}
                              />
                              <span>{getSectionLabel(labels, sectionId)}</span>
                              {!available ? (
                                <span className="ml-auto text-xs text-muted-foreground">{labels.sectionNotInFile}</span>
                              ) : null}
                              {unsupported ? (
                                <span className="ml-auto text-xs text-muted-foreground">{labels.sectionUnsupported}</span>
                              ) : null}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>

                    <div className="grid gap-5 lg:grid-cols-3">
                      {renderStrategy(
                        'progressionStrategy',
                        labels.progressionStrategy,
                        availableSections.includes('progression'),
                      )}
                      {renderStrategy(
                        'playerAttributesStrategy',
                        labels.playerAttributesStrategy,
                        availableSections.includes('player-attributes'),
                      )}
                      {renderStrategy(
                        'lootBoxStrategy',
                        labels.lootBoxStrategy,
                        availableSections.includes('loot-box-history'),
                      )}
                    </div>

                    <fieldset
                      className="space-y-3"
                      disabled={importControlsDisabled || !inventoryAvailable}
                    >
                      <legend className="text-sm font-medium text-foreground">{labels.inventoryStrategy}</legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="flex min-h-10 items-center gap-2 rounded-[var(--cco-button-radius)] border border-border px-3 py-2 text-sm">
                          <input
                            type="radio"
                            name={`${idPrefix}-inventory-strategy`}
                            value="merge"
                            checked={options.inventoryStrategy === 'merge'}
                            onChange={(event) => changeInventoryStrategy(event.target.value)}
                          />
                          <span>{labels.merge}</span>
                        </label>
                        <label className="flex min-h-10 items-center gap-2 rounded-[var(--cco-button-radius)] border border-border px-3 py-2 text-sm">
                          <input
                            type="radio"
                            name={`${idPrefix}-inventory-strategy`}
                            value="replace"
                            checked={options.inventoryStrategy === 'replace'}
                            onChange={(event) => changeInventoryStrategy(event.target.value)}
                            disabled={!inventoryReplaceAvailable || importControlsDisabled}
                            aria-describedby={`${idPrefix}-replace-disabled`}
                          />
                          <span>{labels.replace}</span>
                        </label>
                      </div>
                      {!inventoryReplaceAvailable ? (
                        <p id={`${idPrefix}-replace-disabled`} className="text-xs leading-5 text-muted-foreground">
                          {labels.replaceDisabled}
                        </p>
                      ) : null}
                    </fieldset>

                    {options.inventoryStrategy === 'replace' && inventoryReplaceAvailable ? (
                      <div className="space-y-2 rounded-[var(--cco-card-radius)] border border-destructive/40 bg-destructive/5 p-4">
                        <label className="flex items-start gap-2 text-sm font-medium text-foreground">
                          <input
                            type="checkbox"
                            checked={options.confirmCompleteInventoryReplacement}
                            onChange={(event) => changeReplacementConfirmation(event.target.checked)}
                            disabled={importControlsDisabled}
                            className="mt-0.5"
                          />
                          <span>{labels.replaceConfirmation}</span>
                        </label>
                        <p className="pl-6 text-xs leading-5 text-muted-foreground">
                          {labels.replaceConfirmationDescription}
                        </p>
                      </div>
                    ) : null}

                    <section aria-labelledby={`${idPrefix}-changes-title`} className="space-y-3">
                      <h4 id={`${idPrefix}-changes-title`} className="text-sm font-medium text-foreground">
                        {labels.changesTitle}
                      </h4>
                      {plan.changes.length > 0 ? (
                        <div className="max-h-96 overflow-auto rounded-[var(--cco-card-radius)] border border-border">
                          <table className="w-full min-w-[56rem] text-left text-sm">
                            <caption className="sr-only">{labels.diffTableLabel}</caption>
                            <thead className="sticky top-0 bg-muted/95 text-xs text-muted-foreground">
                              <tr>
                                <th scope="col" className="px-3 py-2 font-medium">{labels.section}</th>
                                <th scope="col" className="px-3 py-2 font-medium">{labels.key}</th>
                                <th scope="col" className="px-3 py-2 font-medium">{labels.currentValue}</th>
                                <th scope="col" className="px-3 py-2 font-medium">{labels.fileValue}</th>
                                <th scope="col" className="px-3 py-2 font-medium">{labels.action}</th>
                                <th scope="col" className="px-3 py-2 font-medium">{labels.conflict}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {plan.changes.map((change) => (
                                <tr key={`${change.sectionId}-${change.key}`}>
                                  <td className="px-3 py-2 text-muted-foreground">{getSectionLabel(labels, change.sectionId)}</td>
                                  <th scope="row" className="break-all px-3 py-2 font-medium text-foreground">{change.key}</th>
                                  <td className="max-w-[16rem] break-all px-3 py-2 text-muted-foreground">
                                    {formatValue(change.currentValue, labels)}
                                  </td>
                                  <td className="max-w-[16rem] break-all px-3 py-2 text-muted-foreground">
                                    {formatValue(change.incomingValue, labels)}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">{getActionLabel(labels, change.action)}</td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {change.conflict ? labels.conflictYes : labels.conflictNo}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{labels.noChanges}</p>
                      )}
                    </section>

                    {phase === 'completed' ? (
                      <div role="status" aria-live="polite" className="rounded-[var(--cco-card-radius)] border border-primary/30 bg-primary/10 p-4">
                        <h4 className="font-medium text-foreground">{labels.completedTitle}</h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {labels.importSuccess}
                        </p>
                      </div>
                    ) : null}

                    <Button
                      type="button"
                      onClick={handleCommit}
                      disabled={!plan || needsConfirmation || busy || phase === 'completed'}
                    >
                      {phase === 'committing' ? labels.applying : labels.applyButton}
                    </Button>
                  </>
                ) : null}
              </section>
            ) : null}
          </section>
        </CardContent>
      </Card>
    </section>
  );
}
