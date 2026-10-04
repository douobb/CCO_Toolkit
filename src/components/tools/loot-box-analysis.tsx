'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pencil, Play, Trash2, X } from 'lucide-react';

import type { ContextualDocsPageProps } from '@/components/context';
import {
  useSharedUserInputs,
  useSharedUserInputsStore,
} from '@/components/shared-user-inputs';
import {
  ToolBreakdown,
  ToolField,
  ToolInputField,
  ToolPage,
  ToolState,
  ToolValidationSummary,
} from '@/components/tools';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  getMarketPriceDefinition,
  type MarketPriceItemId,
} from '@/data/game/economy';
import {
  getLootBoxDropDefinition,
  getLootBoxDropIdsForBox,
  type LootBoxDropId,
} from '@/data/game/loot-box-drops';
import {
  getLootBoxDefinition,
  lootBoxIds,
  type LootBoxId,
} from '@/data/game/loot-boxes';
import { cn } from '@/lib/cn';
import {
  expectedLootBoxNetAi,
  expectedLootBoxValueAi,
  lootBoxCostAi,
} from '@/lib/loot-box-calculator';
import {
  getDualPrice,
  resolveMarketPrices,
  type ResolvedMarketPrices,
} from '@/lib/market-prices';
import { getListSeparator, type Locale } from '@/lib/i18n';
import { createNumberFormatter, type NumberFormatter } from '@/lib/number-formatting';
import {
  calculateLootBoxAnalysis,
  createDefaultLootBoxAnalysisState,
  createLootBoxAnalysisRecord,
  defaultLootBoxSimulationCount,
  isLootBoxAnalysisState,
  removeLootBoxAnalysisRecord,
  simulateLootBoxValuesAsync,
  summarizeLootBoxSimulation,
  upsertLootBoxAnalysisRecord,
  valueOfLootBoxAnalysisRecord,
  type LootBoxAnalysisRecord,
  type LootBoxAnalysisState,
  type LootBoxSimulationSummary,
  type LootBoxTypeAnalysis,
} from '@/lib/loot-box-analysis';
import {
  defaultSharedUserInputs,
  type SharedUserInputs,
} from '@/lib/storage';
import { useToolStateStorage } from '@/lib/storage/use-tool-state';

export interface LootBoxAnalysisToolLabels {
  readonly settingsTab: string;
  readonly settingsTitle: string;
  readonly openSettings: string;
  readonly closeSettings: string;
  readonly prices: string;
  readonly priceRange: string;
  readonly hashPrice: string;
  readonly techScrapPrice: string;
  readonly gangSupplyCratePrice: string;
  readonly oldPouchPrice: string;
  readonly whiteBoxPrice: string;
  readonly yellowBoxPrice: string;
  readonly purpleBoxPrice: string;
  readonly validationPrice: string;
  readonly primaryInputs: string;
  readonly boxType: string;
  readonly boxPlaceholder: string;
  readonly openings: string;
  readonly openingsRange: string;
  readonly openingsUnit: string;
  readonly drops: string;
  readonly quantityRange: string;
  readonly quantityUnit: string;
  readonly saveRecord: string;
  readonly updateRecord: string;
  readonly cancelEdit: string;
  readonly records: string;
  readonly recordsEmpty: string;
  readonly previousPage: string;
  readonly nextPage: string;
  readonly pageStatus: string;
  readonly recordDate: string;
  readonly recordBox: string;
  readonly recordOpenings: string;
  readonly recordDrops: string;
  readonly recordValue: string;
  readonly recordNet: string;
  readonly actions: string;
  readonly edit: string;
  readonly delete: string;
  readonly deleteConfirm: string;
  readonly results: string;
  readonly overview: string;
  readonly recordCount: string;
  readonly actualOpenings: string;
  readonly grossValue: string;
  readonly netValue: string;
  readonly expectedGrossPerBox: string;
  readonly expectedNetPerBox: string;
  readonly performance: string;
  readonly dropAnalysis: string;
  readonly actualQuantity: string;
  readonly expectedQuantity: string;
  readonly actualValue: string;
  readonly runSimulation: string;
  readonly simulationRunning: string;
  readonly actualPercentile: string;
  readonly validationSummary: string;
  readonly validationBox: string;
  readonly validationOpenings: string;
  readonly validationDrop: string;
  readonly aiUnit: string;
}

export interface LootBoxAnalysisDraft {
  readonly boxType: string;
  readonly openings: string;
  readonly quantities: Readonly<Record<string, string>>;
}

export interface LootBoxAnalysisDraftErrors {
  boxType?: 'box';
  openings?: 'openings';
  drops?: 'drops';
}

type LootBoxPriceItemId = Extract<
  MarketPriceItemId,
  | 'hash'
  | 'tech-scrap'
  | 'supply-crate-gang'
  | 'old-pouch'
  | 'locked-container'
  | 'locked-rare-container'
  | 'locked-legendary-container'
>;

type LootBoxPriceLabelKey =
  | 'hashPrice'
  | 'techScrapPrice'
  | 'gangSupplyCratePrice'
  | 'oldPouchPrice'
  | 'whiteBoxPrice'
  | 'yellowBoxPrice'
  | 'purpleBoxPrice';

type LootBoxPriceDrafts = Readonly<Record<LootBoxPriceItemId, string>>;

const lootBoxPriceFields = [
  { itemId: 'hash', labelKey: 'hashPrice' },
  { itemId: 'tech-scrap', labelKey: 'techScrapPrice' },
  { itemId: 'supply-crate-gang', labelKey: 'gangSupplyCratePrice' },
  { itemId: 'old-pouch', labelKey: 'oldPouchPrice' },
  { itemId: 'locked-container', labelKey: 'whiteBoxPrice' },
  { itemId: 'locked-rare-container', labelKey: 'yellowBoxPrice' },
  { itemId: 'locked-legendary-container', labelKey: 'purpleBoxPrice' },
] as const satisfies readonly {
  readonly itemId: LootBoxPriceItemId;
  readonly labelKey: LootBoxPriceLabelKey;
}[];

const lootBoxRecordsPageSize = 20;

function selectLootBoxPriceDrafts(snapshot: SharedUserInputs): LootBoxPriceDrafts {
  const prices = resolveMarketPrices(snapshot);

  return Object.fromEntries(
    lootBoxPriceFields.map(({ itemId }) => {
      const definition = getMarketPriceDefinition(itemId);
      return [itemId, String(getDualPrice(prices, itemId, definition.defaultBasisCurrencyId))];
    }),
  ) as LootBoxPriceDrafts;
}

function updateLootBoxSharedPrice(
  snapshot: SharedUserInputs,
  itemId: LootBoxPriceItemId,
  amount: number,
): SharedUserInputs {
  if (!Number.isFinite(amount) || amount < 0 || amount > Number.MAX_SAFE_INTEGER) {
    return snapshot;
  }

  const definition = getMarketPriceDefinition(itemId);
  const pricesWithoutCurrent = snapshot.economy.prices.filter((price) => price.itemId !== itemId);

  return {
    ...snapshot,
    economy: {
      ...snapshot.economy,
      prices: amount === definition.defaultBasisValue
        ? pricesWithoutCurrent
        : [
            ...pricesWithoutCurrent,
            {
              itemId,
              currencyId: definition.defaultBasisCurrencyId,
              amount,
            },
          ],
    },
  };
}

function parsePrice(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= Number.MAX_SAFE_INTEGER
    ? parsed
    : null;
}

function formatTemplate(
  template: string,
  replacements: Record<string, string | number>,
): string {
  return template.replace(/\$\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(replacements, key)
      ? String(replacements[key])
      : match,
  );
}

interface ParsedLootBoxAnalysisDraft {
  readonly errors: LootBoxAnalysisDraftErrors;
  readonly input: {
    readonly boxType: LootBoxId;
    readonly openings: number;
    readonly drops: readonly { readonly dropId: LootBoxDropId; readonly quantity: number }[];
  } | null;
}

function createEmptyQuantities(boxType: LootBoxId): Record<string, string> {
  return Object.fromEntries(
    getLootBoxDropIdsForBox(boxType).map((dropId) => [dropId, '']),
  );
}

export function createDefaultLootBoxAnalysisDraft(
  boxType?: LootBoxId,
): LootBoxAnalysisDraft {
  if (!boxType) {
    return {
      boxType: '',
      openings: '',
      quantities: {},
    };
  }

  return {
    boxType,
    openings: String(getLootBoxDefinition(boxType).batchSize),
    quantities: createEmptyQuantities(boxType),
  };
}

function isLootBoxId(value: string): value is LootBoxId {
  return lootBoxIds.includes(value as LootBoxId);
}

function parseInteger(value: string, min: number): number | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= min ? parsed : null;
}

export function parseLootBoxAnalysisDraft(
  draft: LootBoxAnalysisDraft,
): ParsedLootBoxAnalysisDraft {
  const errors: LootBoxAnalysisDraftErrors = {};
  const boxType = isLootBoxId(draft.boxType) ? draft.boxType : null;
  const openings = parseInteger(draft.openings, 1);
  const maxOpenings = boxType ? getLootBoxDefinition(boxType).batchSize : null;

  if (!boxType) errors.boxType = 'box';
  if (boxType && (openings === null || (maxOpenings !== null && openings > maxOpenings))) {
    errors.openings = 'openings';
  }

  const drops: { dropId: LootBoxDropId; quantity: number }[] = [];
  if (boxType) {
    for (const dropId of getLootBoxDropIdsForBox(boxType)) {
      const rawQuantity = draft.quantities[dropId] ?? '';
      const quantity = rawQuantity.trim() === '' ? 0 : parseInteger(rawQuantity, 0);
      if (quantity === null) {
        errors.drops = 'drops';
        continue;
      }
      if (quantity > 0) drops.push({ dropId, quantity });
    }
  }

  if (Object.keys(errors).length === 0 && drops.length === 0) {
    errors.drops = 'drops';
  }

  return {
    errors,
    input: Object.keys(errors).length === 0 && boxType && openings !== null
      ? { boxType, openings, drops }
      : null,
  };
}

function draftFromRecord(record: LootBoxAnalysisRecord): LootBoxAnalysisDraft {
  const quantities = createEmptyQuantities(record.boxType);
  for (const drop of record.drops) quantities[drop.dropId] = String(drop.quantity);

  return {
    boxType: record.boxType,
    openings: String(record.openings),
    quantities,
  };
}

type SimulationStatus = 'idle' | 'running' | 'done';

interface SimulationState {
  readonly status: SimulationStatus;
  readonly signature: string | null;
  readonly result: LootBoxSimulationSummary | null;
  readonly requestId: number;
}

type SimulationStates = Readonly<Record<LootBoxId, SimulationState>>;

type LootBoxSimulationRunner = typeof simulateLootBoxValuesAsync;

function createSimulationState(requestId = 0): SimulationState {
  return {
    status: 'idle',
    signature: null,
    result: null,
    requestId,
  };
}

function createSimulationStates(): SimulationStates {
  return Object.fromEntries(
    lootBoxIds.map((boxType) => [boxType, createSimulationState()]),
  ) as SimulationStates;
}

function createSimulationRequests(): Record<LootBoxId, number> {
  return Object.fromEntries(
    lootBoxIds.map((boxType) => [boxType, 0]),
  ) as Record<LootBoxId, number>;
}

interface LootBoxAnalysisContextValue {
  readonly draft: LootBoxAnalysisDraft;
  readonly errors: LootBoxAnalysisDraftErrors;
  readonly editingRecordId: string | null;
  readonly state: LootBoxAnalysisState;
  readonly analyses: readonly LootBoxTypeAnalysis[];
  readonly prices: ResolvedMarketPrices;
  readonly priceDrafts: LootBoxPriceDrafts;
  readonly simulations: SimulationStates;
  readonly setBoxType: (value: string) => void;
  readonly setOpenings: (value: string) => void;
  readonly setDropQuantity: (dropId: LootBoxDropId, value: string) => void;
  readonly setPrice: (itemId: LootBoxPriceItemId, value: string) => void;
  readonly save: () => boolean;
  readonly startEdit: (record: LootBoxAnalysisRecord) => void;
  readonly cancelEdit: () => void;
  readonly deleteRecord: (recordId: string, confirmationMessage: string) => void;
  readonly runSimulation: (boxType: LootBoxId) => void;
}

const LootBoxAnalysisContext = createContext<LootBoxAnalysisContextValue | null>(null);

function useLootBoxAnalysisTool(): LootBoxAnalysisContextValue {
  const context = useContext(LootBoxAnalysisContext);
  if (!context) {
    throw new Error('LootBoxAnalysis 元件必須放在 LootBoxAnalysisToolProvider 內。');
  }
  return context;
}

export function LootBoxAnalysisToolProvider({
  children,
  simulationRunner = simulateLootBoxValuesAsync,
}: {
  readonly children: ReactNode;
  readonly simulationRunner?: LootBoxSimulationRunner;
}) {
  const [draft, setDraft] = useState<LootBoxAnalysisDraft>(createDefaultLootBoxAnalysisDraft());
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [state, setState] = useToolStateStorage<LootBoxAnalysisState>(
    'loot-box-analysis',
    createDefaultLootBoxAnalysisState,
    { validate: isLootBoxAnalysisState },
  );
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [simulations, setSimulations] = useState<SimulationStates>(createSimulationStates);
  const simulationRequests = useRef<Record<LootBoxId, number>>(createSimulationRequests());
  const sharedSnapshot = useSharedUserInputs();
  const sharedStore = useSharedUserInputsStore();
  const prices = useMemo(() => resolveMarketPrices(sharedSnapshot), [sharedSnapshot]);
  const sharedPriceValues = useMemo(
    () => selectLootBoxPriceDrafts(sharedSnapshot),
    [sharedSnapshot],
  );
  const [priceDrafts, setPriceDrafts] = useState<LootBoxPriceDrafts>(() =>
    selectLootBoxPriceDrafts(defaultSharedUserInputs),
  );
  const [dirtyPriceFields, setDirtyPriceFields] = useState<ReadonlySet<LootBoxPriceItemId>>(
    () => new Set(),
  );
  const analyses = useMemo(
    () => calculateLootBoxAnalysis(state.records, prices, state.rollups),
    [prices, state.records, state.rollups],
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;

      setPriceDrafts((current) => {
        let next: LootBoxPriceDrafts | null = null;

        for (const { itemId } of lootBoxPriceFields) {
          if (!dirtyPriceFields.has(itemId) && current[itemId] !== sharedPriceValues[itemId]) {
            next = { ...(next ?? current), [itemId]: sharedPriceValues[itemId] };
          }
        }

        return next ?? current;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [dirtyPriceFields, sharedPriceValues]);

  const setBoxType = useCallback((value: string) => {
    if (!isLootBoxId(value)) {
      setDraft({ boxType: value, openings: '', quantities: {} });
      return;
    }

    setDraft((current) => ({
      ...current,
      boxType: value,
      openings: String(getLootBoxDefinition(value).batchSize),
      quantities: Object.fromEntries(
        getLootBoxDropIdsForBox(value).map((dropId) => [dropId, current.quantities[dropId] ?? '']),
      ),
    }));
  }, []);

  const setOpenings = useCallback((value: string) => {
    setDraft((current) => ({ ...current, openings: value }));
  }, []);

  const setDropQuantity = useCallback((dropId: LootBoxDropId, value: string) => {
    setDraft((current) => ({
      ...current,
      quantities: { ...current.quantities, [dropId]: value },
    }));
  }, []);

  const setPrice = useCallback(
    (itemId: LootBoxPriceItemId, value: string) => {
      setPriceDrafts((current) => ({ ...current, [itemId]: value }));
      setDirtyPriceFields((current) => {
        const next = new Set(current);
        next.add(itemId);
        return next;
      });

      const parsed = parsePrice(value);
      if (parsed === null) return;

      const accepted = sharedStore.update((current) =>
        updateLootBoxSharedPrice(current, itemId, parsed),
      );
      if (!accepted) return;

      setDirtyPriceFields((current) => {
        if (!current.has(itemId)) return current;
        const next = new Set(current);
        next.delete(itemId);
        return next;
      });
    },
    [sharedStore],
  );

  const startSimulation = useCallback(async (
    boxType: LootBoxId,
    analysis: LootBoxTypeAnalysis,
  ) => {
    if (analysis.openings <= 0 || analysis.actualGrossAi === null) return;

    const requestId = simulationRequests.current[boxType] + 1;
    simulationRequests.current = {
      ...simulationRequests.current,
      [boxType]: requestId,
    };
    const signature = getAnalysisSignature(analysis);
    setSimulations((current) => ({
      ...current,
      [boxType]: {
        status: 'running',
        signature,
        result: null,
        requestId,
      },
    }));

    const values = await simulationRunner(
      boxType,
      analysis.openings,
      defaultLootBoxSimulationCount,
      prices,
      {
        // UI 每次執行都產生新 seed；純計算核心仍接受明確 seed 供測試重現。
        seed: Date.now() + requestId,
        yieldEvery: 64,
        shouldCancel: () => simulationRequests.current[boxType] !== requestId,
      },
    );

    if (simulationRequests.current[boxType] !== requestId) return;
    if (!values) {
      setSimulations((current) => {
        if (current[boxType].requestId !== requestId) return current;
        return {
          ...current,
          [boxType]: createSimulationState(requestId),
        };
      });
      return;
    }

    const result = summarizeLootBoxSimulation(
      boxType,
      analysis.openings,
      values,
      analysis.actualGrossAi,
    );
    if (!result) {
      setSimulations((current) => {
        if (current[boxType].requestId !== requestId) return current;
        return {
          ...current,
          [boxType]: createSimulationState(requestId),
        };
      });
      return;
    }

    setSimulations((current) => {
      if (current[boxType].requestId !== requestId) return current;
      return {
        ...current,
        [boxType]: {
          status: 'done',
          signature,
          result,
          requestId,
        },
      };
    });
  }, [prices, simulationRunner]);

  const save = useCallback(() => {
    setValidationAttempted(true);
    const parsed = parseLootBoxAnalysisDraft(draft);
    if (!parsed.input) return false;

    const existing = editingRecordId
      ? state.records.find((record) => record.id === editingRecordId)
      : undefined;
    const record = createLootBoxAnalysisRecord({
      ...parsed.input,
      id: existing?.id,
      recordedAt: existing?.recordedAt,
    });

    const nextState = upsertLootBoxAnalysisRecord(state, record);
    setState(nextState);
    const nextAnalysis = calculateLootBoxAnalysis(
      nextState.records,
      prices,
      nextState.rollups,
    ).find((analysis) => analysis.boxType === parsed.input!.boxType);
    if (nextAnalysis) void startSimulation(parsed.input.boxType, nextAnalysis);
    setEditingRecordId(null);
    setDraft(createDefaultLootBoxAnalysisDraft());
    setValidationAttempted(false);
    return true;
  }, [draft, editingRecordId, prices, setState, startSimulation, state]);

  const startEdit = useCallback((record: LootBoxAnalysisRecord) => {
    setEditingRecordId(record.id);
    setDraft(draftFromRecord(record));
    setValidationAttempted(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingRecordId(null);
    setDraft(createDefaultLootBoxAnalysisDraft());
    setValidationAttempted(false);
  }, []);

  const clearSimulation = useCallback((boxType: LootBoxId) => {
    const current = simulations[boxType];
    if (current.status === 'idle' && current.signature === null && current.result === null) return;

    const requestId = simulationRequests.current[boxType] + 1;
    simulationRequests.current = {
      ...simulationRequests.current,
      [boxType]: requestId,
    };
    setSimulations((next) => ({
      ...next,
      [boxType]: createSimulationState(requestId),
    }));
  }, [simulations]);

  const deleteRecord = useCallback((recordId: string, confirmationMessage: string) => {
    if (typeof window !== 'undefined' && !window.confirm(confirmationMessage)) return;
    const record = state.records.find((item) => item.id === recordId);
    const nextState = removeLootBoxAnalysisRecord(state, recordId);
    setState(nextState);
    if (record) {
      const hasRemainingRecords = nextState.records.some((item) => item.boxType === record.boxType)
        || nextState.rollups.some((item) => item.boxType === record.boxType);
      if (!hasRemainingRecords) clearSimulation(record.boxType);
    }
    setEditingRecordId((current) => current === recordId ? null : current);
  }, [clearSimulation, setState, state]);

  const runSimulation = useCallback((boxType: LootBoxId) => {
    const analysis = analyses.find((item) => item.boxType === boxType);
    if (!analysis || analysis.openings <= 0 || analysis.actualGrossAi === null) return;
    void startSimulation(boxType, analysis);
  }, [analyses, startSimulation]);

  useEffect(() => () => {
    simulationRequests.current = Object.fromEntries(
      lootBoxIds.map((boxType) => [
        boxType,
        simulationRequests.current[boxType] + 1,
      ]),
    ) as Record<LootBoxId, number>;
  }, []);

  const parsed = useMemo(() => parseLootBoxAnalysisDraft(draft), [draft]);
  const contextValue = useMemo<LootBoxAnalysisContextValue>(() => {
    const errors = validationAttempted ? parsed.errors : {};

    return {
      draft,
      errors,
      editingRecordId,
      state,
      analyses,
      prices,
      priceDrafts,
      simulations,
      setBoxType,
      setOpenings,
      setDropQuantity,
      setPrice,
      save,
      startEdit,
      cancelEdit,
      deleteRecord,
      runSimulation,
    };
  }, [
    analyses,
    cancelEdit,
    deleteRecord,
    draft,
    editingRecordId,
    parsed.errors,
    priceDrafts,
    prices,
    runSimulation,
    save,
    setBoxType,
    setDropQuantity,
    setOpenings,
    setPrice,
    simulations,
    startEdit,
    state,
    validationAttempted,
  ]);

  return (
    <LootBoxAnalysisContext.Provider value={contextValue}>
      {children}
    </LootBoxAnalysisContext.Provider>
  );
}

const selectClassName =
  'flex h-[var(--cco-input-height)] w-full min-w-0 rounded-[var(--cco-input-radius)] border border-input bg-background px-[var(--cco-input-padding-x)] py-[var(--cco-input-padding-y)] text-base text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 md:text-sm';

function formatDecimal(formatNumber: NumberFormatter, value: number): string {
  return formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatWhole(formatNumber: NumberFormatter, value: number): string {
  return formatNumber(value, { maximumFractionDigits: 0 });
}

function formatAi(formatNumber: NumberFormatter, value: number | null, labels: LootBoxAnalysisToolLabels): string {
  return value === null ? '—' : `${formatDecimal(formatNumber, value)} ${labels.aiUnit}`;
}

function formatAiPair(
  formatNumber: NumberFormatter,
  actual: number | null,
  expected: number | null,
  labels: LootBoxAnalysisToolLabels,
): string {
  return `${formatAi(formatNumber, actual, labels)} / ${formatAi(formatNumber, expected, labels)}`;
}

function formatPercent(formatNumber: NumberFormatter, value: number | null): string {
  return value === null ? '—' : `${formatDecimal(formatNumber, value)}%`;
}

function getBoxLabel(boxId: LootBoxId, locale: Locale): string {
  return getLootBoxDefinition(boxId).labels[locale];
}

function getDropLabel(dropId: LootBoxDropId, locale: Locale): string {
  return getLootBoxDropDefinition(dropId).labels[locale];
}

function getAnalysisSignature(analysis: LootBoxTypeAnalysis): string {
  return JSON.stringify({
    boxType: analysis.boxType,
    openings: analysis.openings,
    actualGrossAi: analysis.actualGrossAi,
    expectedGrossAi: analysis.expectedGrossAi,
    drops: analysis.drops.map((drop) => [
      drop.dropId,
      drop.actualQuantity,
      drop.expectedQuantity,
      drop.actualValueAi,
      drop.expectedValueAi,
    ]),
  });
}

function isSimulationCurrent(
  simulation: SimulationState,
  analysis: LootBoxTypeAnalysis,
): boolean {
  return simulation.signature === getAnalysisSignature(analysis);
}

function formatRecordDate(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatRecordDrops(
  record: LootBoxAnalysisRecord,
  locale: Locale,
  formatNumber: NumberFormatter,
): string {
  const separator = getListSeparator(locale);
  return record.drops
    .map((drop) => `${getDropLabel(drop.dropId, locale)} × ${formatWhole(formatNumber, drop.quantity)}`)
    .join(separator);
}

function LootBoxRecordForm({
  labels,
  locale,
}: {
  readonly labels: LootBoxAnalysisToolLabels;
  readonly locale: Locale;
}) {
  const {
    draft,
    errors,
    editingRecordId,
    setBoxType,
    setOpenings,
    setDropQuantity,
    save,
    cancelEdit,
  } = useLootBoxAnalysisTool();
  const boxType = isLootBoxId(draft.boxType) ? draft.boxType : null;
  const dropIds = boxType ? getLootBoxDropIdsForBox(boxType) : [];
  const maxOpenings = boxType ? getLootBoxDefinition(boxType).batchSize : null;
  const validation = Object.keys(errors).length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="site-tool-section-heading">{labels.primaryInputs}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-7">
        {validation ? <ToolValidationSummary>{labels.validationSummary}</ToolValidationSummary> : null}

        <div className="@container">
          <div className="grid gap-5 @min-[24rem]:grid-cols-2">
            <ToolField
              id="loot-box-analysis-box-type"
              label={labels.boxType}
              error={errors.boxType ? labels.validationBox : undefined}
            >
              <select
                id="loot-box-analysis-box-type"
                value={draft.boxType}
                onChange={(event) => setBoxType(event.target.value)}
                aria-invalid={errors.boxType ? true : undefined}
                className={selectClassName}
              >
                <option value="" disabled>
                  {labels.boxPlaceholder}
                </option>
                {lootBoxIds.map((boxId) => (
                  <option key={boxId} value={boxId}>
                    {getBoxLabel(boxId, locale)}
                  </option>
                ))}
              </select>
            </ToolField>
            <ToolInputField
              id="loot-box-analysis-openings"
              label={labels.openings}
              type="number"
              inputMode="numeric"
               min={1}
               max={maxOpenings ?? undefined}
               step="1"
               value={draft.openings}
               onChange={(event) => setOpenings(event.target.value)}
                range={maxOpenings === null
                  ? undefined
                  : formatTemplate(labels.openingsRange, { max: maxOpenings })}
                unit={labels.openingsUnit}
                error={errors.openings
                 && maxOpenings !== null
                   ? formatTemplate(labels.validationOpenings, { max: maxOpenings })
                  : undefined}
             />
          </div>
        </div>

        {boxType ? (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground">{labels.drops}</h3>
            {errors.drops ? (
              <p id="loot-box-analysis-drops-error" className="text-sm text-destructive" role="alert">
                {labels.validationDrop}
              </p>
            ) : null}
            <div className="@container">
              <div className="grid gap-5 @min-[24rem]:grid-cols-2 @min-[40rem]:grid-cols-3">
                {dropIds.map((dropId) => (
                  <ToolInputField
                    key={dropId}
                    id={`loot-box-analysis-${dropId}`}
                    label={getDropLabel(dropId, locale)}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step="1"
                    value={draft.quantities[dropId] ?? ''}
                    onChange={(event) => setDropQuantity(dropId, event.target.value)}
                    range={labels.quantityRange}
                    unit={labels.quantityUnit}
                    aria-invalid={errors.drops ? true : undefined}
                    aria-describedby={errors.drops ? 'loot-box-analysis-drops-error' : undefined}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={save}>
            {editingRecordId ? labels.updateRecord : labels.saveRecord}
          </Button>
          {editingRecordId ? (
            <Button type="button" variant="outline" onClick={cancelEdit}>
              <X aria-hidden="true" />
              {labels.cancelEdit}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function LootBoxDropAnalysisTable({
  labels,
  locale,
  analysis,
  formatNumber,
}: {
  readonly labels: LootBoxAnalysisToolLabels;
  readonly locale: Locale;
  readonly analysis: LootBoxTypeAnalysis;
  readonly formatNumber: NumberFormatter;
}) {
  if (analysis.drops.length === 0) return null;

  return (
    <details className="mt-6 rounded-[var(--cco-card-radius)] border border-border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
        {labels.dropAnalysis}
      </summary>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
          <caption className="sr-only">{labels.dropAnalysis}</caption>
          <thead className="bg-muted/40 text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="px-4 py-3 font-medium">{labels.drops}</th>
              <th scope="col" className="px-4 py-3 font-medium">{labels.actualQuantity}</th>
              <th scope="col" className="px-4 py-3 font-medium">{labels.expectedQuantity}</th>
              <th scope="col" className="px-4 py-3 font-medium">{labels.actualValue}</th>
            </tr>
          </thead>
          <tbody>
            {analysis.drops.map((drop) => (
              <tr key={drop.dropId} className="border-b border-border last:border-b-0">
                <th scope="row" className="px-4 py-3 font-medium text-foreground">
                  {getDropLabel(drop.dropId, locale)}
                </th>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {formatDecimal(formatNumber, drop.actualQuantity)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {formatDecimal(formatNumber, drop.expectedQuantity)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {formatAi(formatNumber, drop.actualValueAi, labels)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function LootBoxSimulationButton({
  labels,
  analysis,
}: {
  readonly labels: LootBoxAnalysisToolLabels;
  readonly analysis: LootBoxTypeAnalysis;
}) {
  const { simulations, runSimulation } = useLootBoxAnalysisTool();
  const simulation = simulations[analysis.boxType];
  const isCurrent = isSimulationCurrent(simulation, analysis);
  const isRunning = simulation.status === 'running' && isCurrent;

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => runSimulation(analysis.boxType)}
      disabled={analysis.actualGrossAi === null || isRunning}
      aria-busy={isRunning}
    >
      <Play aria-hidden="true" />
      {isRunning ? labels.simulationRunning : labels.runSimulation}
    </Button>
  );
}

function LootBoxAnalysisResults({
  labels,
  locale,
  formatNumber,
}: {
  readonly labels: LootBoxAnalysisToolLabels;
  readonly locale: Locale;
  readonly formatNumber: NumberFormatter;
}) {
  const { analyses, prices, simulations } = useLootBoxAnalysisTool();

  return (
    <section aria-labelledby="loot-box-analysis-results-title">
      <div className="mb-4">
        <h2 id="loot-box-analysis-results-title" className="site-tool-section-heading text-xl font-semibold tracking-tight text-foreground">
          {labels.results}
        </h2>
      </div>
      <div className="space-y-5">
        {analyses.map((analysis) => {
          const hasRecords = analysis.recordCount > 0;
          const simulation = simulations[analysis.boxType];
          const actualPercentile = hasRecords && simulation.status === 'done'
            && isSimulationCurrent(simulation, analysis)
            ? simulation.result?.percentile ?? null
            : null;

          return (
            <Card key={analysis.boxType} data-loot-box-id={analysis.boxType}>
              <CardHeader className={hasRecords
                ? 'flex-row flex-wrap items-start justify-between gap-4'
                : undefined}
              >
                <CardTitle className={hasRecords ? 'min-w-0' : undefined}>
                  {getBoxLabel(analysis.boxType, locale)}
                </CardTitle>
                {hasRecords ? (
                  <LootBoxSimulationButton
                    labels={labels}
                    analysis={analysis}
                  />
                ) : null}
              </CardHeader>
              <CardContent>
                {hasRecords ? (
                  <>
                    <ToolBreakdown
                      title={labels.overview}
                      titleId={`loot-box-analysis-overview-${analysis.boxType}`}
                      layout="rows"
                      columns={2}
                      items={[
                        { id: 'record-count', label: labels.recordCount, value: formatWhole(formatNumber, analysis.recordCount) },
                        { id: 'actual-openings', label: labels.actualOpenings, value: `${formatWhole(formatNumber, analysis.openings)} ${labels.openingsUnit}` },
                        { id: 'gross-value', label: labels.grossValue, value: formatAiPair(formatNumber, analysis.actualGrossAi, analysis.expectedGrossAi, labels) },
                        { id: 'net-value', label: labels.netValue, value: formatAiPair(formatNumber, analysis.actualNetAi, analysis.expectedNetAi, labels) },
                        { id: 'performance', label: labels.performance, value: formatPercent(formatNumber, analysis.performancePercent) },
                        { id: 'actual-percentile', label: labels.actualPercentile, value: formatPercent(formatNumber, actualPercentile) },
                      ]}
                    />
                    <LootBoxDropAnalysisTable
                      labels={labels}
                      locale={locale}
                      analysis={analysis}
                      formatNumber={formatNumber}
                    />
                  </>
                ) : (
                  <ToolBreakdown
                    title={labels.overview}
                    titleId={`loot-box-analysis-overview-${analysis.boxType}`}
                    layout="rows"
                    columns={2}
                    items={[
                      {
                        id: 'expected-gross-per-box',
                        label: labels.expectedGrossPerBox,
                        value: formatAi(formatNumber, expectedLootBoxValueAi(analysis.boxType, prices), labels),
                      },
                      {
                        id: 'expected-net-per-box',
                        label: labels.expectedNetPerBox,
                        value: formatAi(formatNumber, expectedLootBoxNetAi(analysis.boxType, prices), labels),
                      },
                    ]}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function LootBoxRecordsTable({
  labels,
  locale,
  formatNumber,
}: {
  readonly labels: LootBoxAnalysisToolLabels;
  readonly locale: Locale;
  readonly formatNumber: NumberFormatter;
}) {
  const { state, prices, startEdit, deleteRecord } = useLootBoxAnalysisTool();
  const records = [...state.records].sort((left, right) => right.recordedAt - left.recordedAt);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(records.length / lootBoxRecordsPageSize));
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  const visibleRecords = records.slice(
    (currentPage - 1) * lootBoxRecordsPageSize,
    currentPage * lootBoxRecordsPageSize,
  );

  return (
    <section aria-labelledby="loot-box-analysis-records-title">
      <div className="mb-4">
        <h2 id="loot-box-analysis-records-title" className="site-tool-section-heading text-xl font-semibold tracking-tight text-foreground">
          {labels.records}
        </h2>
      </div>
      {records.length === 0 ? (
        <ToolState title={labels.recordsEmpty} />
      ) : (
        <>
          <div className="max-w-full overflow-x-auto rounded-[var(--cco-card-radius)] border border-border">
          <table className="w-full min-w-[58rem] border-collapse text-left text-sm">
            <caption className="sr-only">{labels.records}</caption>
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="border-b border-border">
                <th scope="col" className="px-4 py-3 font-medium">{labels.recordDate}</th>
                <th scope="col" className="px-4 py-3 font-medium">{labels.recordBox}</th>
                <th scope="col" className="px-4 py-3 font-medium">{labels.recordOpenings}</th>
                <th scope="col" className="px-4 py-3 font-medium">{labels.recordDrops}</th>
                <th scope="col" className="px-4 py-3 font-medium">{labels.recordValue}</th>
                <th scope="col" className="px-4 py-3 font-medium">{labels.recordNet}</th>
                <th scope="col" className="px-4 py-3 font-medium">{labels.actions}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record) => {
                const value = valueOfLootBoxAnalysisRecord(record, prices);
                const cost = lootBoxCostAi(record.boxType, prices);
                const net = value === null
                  ? null
                  : cost === null ? null : value - cost * record.openings;

                return (
                  <tr key={record.id} className="border-b border-border last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatRecordDate(record.recordedAt)}
                    </td>
                    <th scope="row" className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                      {getBoxLabel(record.boxType, locale)}
                    </th>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatWhole(formatNumber, record.openings)}
                    </td>
                    <td className="min-w-[18rem] px-4 py-3 text-muted-foreground">
                      {formatRecordDrops(record, locale, formatNumber)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatAi(formatNumber, value, labels)}
                    </td>
                    <td className={cn('whitespace-nowrap px-4 py-3', net !== null && net < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                      {formatAi(formatNumber, net, labels)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(record)}
                          aria-label={`${labels.edit}: ${getBoxLabel(record.boxType, locale)}`}
                        >
                          <Pencil aria-hidden="true" />
                          {labels.edit}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteRecord(record.id, labels.deleteConfirm)}
                          aria-label={`${labels.delete}: ${getBoxLabel(record.boxType, locale)}`}
                        >
                          <Trash2 aria-hidden="true" />
                          {labels.delete}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <nav
            aria-label={labels.records}
            className="mt-3 flex max-w-full flex-wrap items-center justify-between gap-3"
          >
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              aria-label={labels.previousPage}
            >
              {labels.previousPage}
            </Button>
            <span
              role="status"
              aria-live="polite"
              className="text-sm text-muted-foreground"
            >
              {formatTemplate(labels.pageStatus, {
                page: formatWhole(formatNumber, currentPage),
                pages: formatWhole(formatNumber, pageCount),
              })}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
              disabled={currentPage === pageCount}
              aria-label={labels.nextPage}
            >
              {labels.nextPage}
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}

function LootBoxAnalysisSettingsPanel({
  labels,
  idPrefix,
}: {
  readonly labels: LootBoxAnalysisToolLabels;
  readonly idPrefix: string;
}) {
  const { priceDrafts, setPrice } = useLootBoxAnalysisTool();

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div>
        <h2 className="font-semibold text-foreground">{labels.settingsTitle}</h2>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">{labels.prices}</h3>
        <div className="space-y-5">
          {lootBoxPriceFields.map(({ itemId, labelKey }) => {
            const definition = getMarketPriceDefinition(itemId);
            const value = priceDrafts[itemId];

            return (
              <ToolInputField
                key={itemId}
                id={`${idPrefix}-${itemId}`}
                label={labels[labelKey]}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={value}
                onChange={(event) => setPrice(itemId, event.target.value)}
                range={labels.priceRange}
                unit={definition.unit}
                error={parsePrice(value) === null ? labels.validationPrice : undefined}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function LootBoxAnalysisCalculator({
  labels,
  locale,
  numberFormatter,
}: {
  readonly labels: LootBoxAnalysisToolLabels;
  readonly locale: Locale;
  readonly numberFormatter?: NumberFormatter;
}) {
  const formatNumber = useMemo(
    () => numberFormatter ?? createNumberFormatter(locale),
    [locale, numberFormatter],
  );

  return (
    <div className="not-prose my-8 space-y-8" data-tool="loot-box-analysis">
      <LootBoxRecordForm labels={labels} locale={locale} />
      <LootBoxAnalysisResults labels={labels} locale={locale} formatNumber={formatNumber} />
      <LootBoxRecordsTable labels={labels} locale={locale} formatNumber={formatNumber} />
    </div>
  );
}

export function LootBoxAnalysisToolPage({
  toc,
  full,
  contextLabel,
  contextPanelLabel,
  contextCloseLabel,
  labels,
  header,
  headerActions,
  children,
}: Omit<ContextualDocsPageProps, 'contextItems' | 'defaultContextId' | 'mobileContext' | 'children'> & {
  readonly labels: LootBoxAnalysisToolLabels;
  readonly header: ReactNode;
  readonly headerActions?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <LootBoxAnalysisToolProvider>
      <ToolPage
        toc={toc}
        full={full}
        contextLabel={contextLabel}
        contextPanelLabel={contextPanelLabel}
        contextCloseLabel={contextCloseLabel}
        header={header}
        headerActions={headerActions}
        settings={{
          id: 'settings',
          label: labels.settingsTab,
          title: labels.settingsTitle,
          openLabel: labels.openSettings,
          closeLabel: labels.closeSettings,
          idPrefix: 'loot-box-analysis-settings',
          render: ({ idPrefix }) => (
            <LootBoxAnalysisSettingsPanel
              labels={labels}
              idPrefix={idPrefix}
            />
          ),
        }}
      >
        {children}
      </ToolPage>
    </LootBoxAnalysisToolProvider>
  );
}
