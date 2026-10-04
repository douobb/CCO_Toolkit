'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Download, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ContextualDocsPageProps } from '@/components/context';
import {
  useSharedUserInputs,
  useSharedUserInputsStore,
} from '@/components/shared-user-inputs';
import {
  ToolBuffSliderField,
  ToolInputField,
  ToolPage,
  ToolPresetButton,
  ToolState,
} from '@/components/tools';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  blackMarketQualityCatalog,
  type BlackMarketQualityId,
} from '@/data/game/black-market';
import {
  economyDataSet,
  getMarketCacheRateDefinition,
} from '@/data/game/economy';
import { getProgressionLevelDefinition } from '@/data/game/progression';
import {
  BLACK_MARKET_LEVEL_MAX,
  BLACK_MARKET_LEVEL_MIN,
  calculateBlackMarket,
  type BlackMarketInputs,
  type BlackMarketQualityResult,
} from '@/lib/black-market-calculator';
import { cn } from '@/lib/cn';
import {
  BUFF_PERCENT_DEFAULT_STRING,
  normalizeLegacyBuffPercentString,
  parseBuffPercent,
} from '@/lib/buff-percent';
import { resolveMarketPrices } from '@/lib/market-prices';
import type { Locale } from '@/lib/i18n';
import { createNumberFormatter, type NumberFormatter } from '@/lib/number-formatting';
import {
  clearToolState,
  defaultSharedUserInputs,
  type SharedUserInputs,
} from '@/lib/storage';
import { useToolStateStorage } from '@/lib/storage/use-tool-state';

export interface BlackMarketToolLabels {
  readonly settingsTab: string;
  readonly settingsTitle: string;
  readonly openSettings: string;
  readonly closeSettings: string;
  readonly primaryInputs: string;
  readonly printingLevel: string;
  readonly bargainPercent: string;
  readonly btcBuffPercent: string;
  readonly levelPlaceholder: string;
  readonly levelRange: string;
  readonly bargainRange: string;
  readonly buffRange: string;
  readonly levelUnit: string;
  readonly percentUnit: string;
  readonly amounts: string;
  readonly cacheAmount: string;
  readonly amountUnit: string;
  readonly prices: string;
  readonly cacheRate: string;
  readonly cacheRateUnit: string;
  readonly btcPerAi: string;
  readonly btcPerAiUnit: string;
  readonly amountRange: string;
  readonly rateRange: string;
  readonly reset: string;
  readonly fillShared: string;
  readonly validationSummary: string;
  readonly validationLevel: string;
  readonly validationBargain: string;
  readonly validationAmount: string;
  readonly validationRate: string;
  readonly validationBuff: string;
  readonly noResult: string;
  readonly noResultHint: string;
  readonly results: string;
  readonly qualityResultTitle: string;
  readonly quality: string;
  readonly amount: string;
  readonly netProfit: string;
  readonly soldBtc: string;
  readonly costAi: string;
  readonly profitAi: string;
  readonly breakEven: string;
  readonly breakEvenCurrent: string;
  readonly breakEvenAt: string;
  readonly notAvailable: string;
  readonly btcUnit: string;
  readonly aiUnit: string;
}

export interface BlackMarketFormValues {
  readonly printingLevel: string;
  readonly bargainPercent: string;
  readonly btcBuffPercent: string;
  readonly trashAmount: string;
  readonly commonAmount: string;
  readonly highQualityAmount: string;
  readonly rareAmount: string;
  readonly trashCachePerAi: string;
  readonly commonCachePerAi: string;
  readonly highQualityCachePerAi: string;
  readonly rareCachePerAi: string;
  readonly btcPerAi: string;
}

export type BlackMarketField = keyof BlackMarketFormValues;
export type BlackMarketError = 'level' | 'bargain' | 'amount' | 'rate' | 'buff';
export type BlackMarketErrors = Partial<Record<BlackMarketField, BlackMarketError>>;

export interface BlackMarketToolState {
  readonly printingLevel: string;
  readonly bargainPercent: string;
  readonly btcBuffPercent: string;
  readonly trashAmount: string;
  readonly commonAmount: string;
  readonly highQualityAmount: string;
  readonly rareAmount: string;
}

type BlackMarketPriceField =
  | 'trashCachePerAi'
  | 'commonCachePerAi'
  | 'highQualityCachePerAi'
  | 'rareCachePerAi';
type BlackMarketWritableField = BlackMarketPriceField | 'btcPerAi';
type BlackMarketPriceValues = Pick<BlackMarketFormValues, BlackMarketWritableField>;
export type BlackMarketSharedValues = Pick<
  BlackMarketFormValues,
  | 'printingLevel'
  | 'bargainPercent'
  | BlackMarketWritableField
>;

const blackMarketQualityToAmountField = {
  trash: 'trashAmount',
  common: 'commonAmount',
  'high-quality': 'highQualityAmount',
  rare: 'rareAmount',
} as const satisfies Record<BlackMarketQualityId, keyof BlackMarketToolState>;

const blackMarketQualityToPriceField = {
  trash: 'trashCachePerAi',
  common: 'commonCachePerAi',
  'high-quality': 'highQualityCachePerAi',
  rare: 'rareCachePerAi',
} as const satisfies Record<BlackMarketQualityId, BlackMarketPriceField>;

const blackMarketPriceFieldToQuality = {
  trashCachePerAi: 'trash',
  commonCachePerAi: 'common',
  highQualityCachePerAi: 'high-quality',
  rareCachePerAi: 'rare',
} as const satisfies Record<BlackMarketPriceField, BlackMarketQualityId>;

const blackMarketPriceFields = [
  'trashCachePerAi',
  'commonCachePerAi',
  'highQualityCachePerAi',
  'rareCachePerAi',
  'btcPerAi',
] as const satisfies readonly BlackMarketWritableField[];

const defaultBlackMarketCacheAmount = '1000';

const defaultBlackMarketToolState: BlackMarketToolState = {
  printingLevel: String(BLACK_MARKET_LEVEL_MIN),
  bargainPercent: '0',
  btcBuffPercent: BUFF_PERCENT_DEFAULT_STRING,
  trashAmount: defaultBlackMarketCacheAmount,
  commonAmount: defaultBlackMarketCacheAmount,
  highQualityAmount: defaultBlackMarketCacheAmount,
  rareAmount: defaultBlackMarketCacheAmount,
};

function getSharedPrintingLevel(snapshot: SharedUserInputs): string {
  const stored = snapshot.progression.skills.find((skill) => skill.id === 'printing-rank');
  return String(
    stored?.level ?? getProgressionLevelDefinition('printing-rank').defaultValue,
  );
}

/** 將玩家設定、物價與快取換算投影成黑市工具欄位；Buff 屬於工具自身狀態。 */
export function selectBlackMarketSharedValues(
  snapshot: SharedUserInputs,
): BlackMarketSharedValues {
  const prices = resolveMarketPrices(snapshot);

  return {
    printingLevel: getSharedPrintingLevel(snapshot),
    bargainPercent: String(snapshot.equipment.bargainPercent ?? 0),
    trashCachePerAi: String(prices.caches.trash.value),
    commonCachePerAi: String(prices.caches.common.value),
    highQualityCachePerAi: String(prices.caches['high-quality'].value),
    rareCachePerAi: String(prices.caches.rare.value),
    btcPerAi: String(prices.btcPerAi),
  };
}

/** 將共用設定帶入玩家／物價欄位；刻意不觸碰工具自己的 Buff。 */
export function applyBlackMarketSharedValues(
  current: BlackMarketToolState,
  shared: BlackMarketSharedValues,
): BlackMarketToolState {
  return {
    ...current,
    printingLevel: shared.printingLevel,
    bargainPercent: shared.bargainPercent,
  };
}

/** 將黑市工具中的有效快取換算／匯率回寫 Shared User Inputs。 */
export function updateBlackMarketSharedValue(
  snapshot: SharedUserInputs,
  field: BlackMarketWritableField,
  amount: number,
): SharedUserInputs {
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > Number.MAX_SAFE_INTEGER) {
    return snapshot;
  }

  if (field === 'btcPerAi') {
    const definition = economyDataSet.payload.exchangeRates.find(
      (rate) => rate.id === 'btc-per-ai',
    );
    if (!definition) return snapshot;

    const ratesWithoutCurrent = snapshot.economy.exchangeRates.filter(
      (rate) => rate.id !== 'btc-per-ai',
    );

    return {
      ...snapshot,
      economy: {
        ...snapshot.economy,
        exchangeRates: amount === definition.defaultValue
          ? ratesWithoutCurrent
          : [...ratesWithoutCurrent, { id: 'btc-per-ai', value: amount }],
      },
    };
  }

  const cacheId = blackMarketPriceFieldToQuality[field];

  const definition = getMarketCacheRateDefinition(cacheId);
  const ratesWithoutCurrent = snapshot.economy.cacheRates.filter(
    (rate) => rate.id !== cacheId,
  );

  return {
    ...snapshot,
    economy: {
      ...snapshot.economy,
      cacheRates: amount === definition.defaultValue
        ? ratesWithoutCurrent
        : [...ratesWithoutCurrent, { id: cacheId, value: amount }],
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBlackMarketToolState(value: unknown): value is BlackMarketToolState {
  if (
    !isRecord(value) ||
    Object.values(value).some((item) => typeof item !== 'string')
  ) {
    return false;
  }

  const keys = Object.keys(value);
  return keys.length === 7 && keys.every((key) =>
    key === 'printingLevel' ||
    key === 'bargainPercent' ||
    key === 'btcBuffPercent' ||
    key === 'trashAmount' ||
    key === 'commonAmount' ||
    key === 'highQualityAmount' ||
    key === 'rareAmount'
  );
}

export function normalizeBlackMarketToolState(
  value: unknown,
): BlackMarketToolState | undefined {
  if (!isRecord(value)) return undefined;

  const requiredFields = [
    'printingLevel',
    'bargainPercent',
    'trashAmount',
    'commonAmount',
    'highQualityAmount',
    'rareAmount',
  ] as const;
  const keys = Object.keys(value);
  if (
    (keys.length !== requiredFields.length && keys.length !== requiredFields.length + 1) ||
    !keys.every((key) => key === 'btcBuffPercent' || requiredFields.includes(key as typeof requiredFields[number])) ||
    requiredFields.some((field) => typeof value[field] !== 'string')
  ) {
    return undefined;
  }

  const btcBuffPercent = Object.prototype.hasOwnProperty.call(value, 'btcBuffPercent')
    ? normalizeLegacyBuffPercentString(value.btcBuffPercent)
    : BUFF_PERCENT_DEFAULT_STRING;
  if (btcBuffPercent === undefined) return undefined;

  return {
    printingLevel: value.printingLevel as string,
    bargainPercent: value.bargainPercent as string,
    btcBuffPercent,
    trashAmount: value.trashAmount as string,
    commonAmount: value.commonAmount as string,
    highQualityAmount: value.highQualityAmount as string,
    rareAmount: value.rareAmount as string,
  };
}

export function createBlackMarketValues(
  toolState: BlackMarketToolState,
  priceDrafts: BlackMarketPriceValues,
): BlackMarketFormValues {
  return {
    ...toolState,
    ...priceDrafts,
  };
}

function parseInteger(value: string, min: number, max: number): number | null {
  const normalized = value.trim();
  if (!normalized || !/^\d+$/.test(normalized)) return null;

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return null;

  return parsed;
}

function parseBlackMarketPriceValue(value: string): number | null {
  return parseInteger(value, 1, Number.MAX_SAFE_INTEGER);
}

export function parseBlackMarketValues(values: BlackMarketFormValues): {
  readonly errors: BlackMarketErrors;
  readonly inputs: BlackMarketInputs | null;
} {
  const printingLevel = parseInteger(
    values.printingLevel,
    BLACK_MARKET_LEVEL_MIN,
    BLACK_MARKET_LEVEL_MAX,
  );
  const bargainPercent = parseInteger(values.bargainPercent, 0, 40);
  const btcBuffPercent = parseBuffPercent(values.btcBuffPercent);
  const errors: BlackMarketErrors = {};

  if (printingLevel === null) errors.printingLevel = 'level';
  if (bargainPercent === null) errors.bargainPercent = 'bargain';
  if (btcBuffPercent === null) errors.btcBuffPercent = 'buff';

  const cacheAmounts = {} as Record<BlackMarketQualityId, number>;
  for (const quality of blackMarketQualityCatalog) {
    const field = blackMarketQualityToAmountField[quality.id];
    const amount = parseInteger(values[field], 0, Number.MAX_SAFE_INTEGER);
    if (amount === null) errors[field] = 'amount';
    else cacheAmounts[quality.id] = amount;
  }

  const cachePerAi = {} as Record<BlackMarketQualityId, number>;
  for (const quality of blackMarketQualityCatalog) {
    const field = blackMarketQualityToPriceField[quality.id];
    const rate = parseBlackMarketPriceValue(values[field]);
    if (rate === null) errors[field] = 'rate';
    else cachePerAi[quality.id] = rate;
  }

  const aiPriceInBtc = parseBlackMarketPriceValue(values.btcPerAi);
  if (aiPriceInBtc === null) errors.btcPerAi = 'rate';

  if (Object.keys(errors).length > 0) {
    return { errors, inputs: null };
  }

  return {
    errors,
    inputs: {
      printingLevel: printingLevel as number,
      cacheAmounts,
      btcBuffPercent: btcBuffPercent as number,
      bargainPercent: bargainPercent as number,
      aiPriceInBtc: aiPriceInBtc as number,
      cachePerAi,
    },
  };
}

export function calculateBlackMarketTool(values: BlackMarketFormValues): {
  readonly errors: BlackMarketErrors;
  readonly inputs: BlackMarketInputs | null;
  readonly result: readonly BlackMarketQualityResult[] | null;
} {
  const parsed = parseBlackMarketValues(values);

  return {
    errors: parsed.errors,
    inputs: parsed.inputs,
    result: parsed.inputs ? calculateBlackMarket(parsed.inputs) : null,
  };
}

interface BlackMarketContextValue {
  readonly values: BlackMarketFormValues;
  readonly errors: BlackMarketErrors;
  readonly inputs: BlackMarketInputs | null;
  readonly result: readonly BlackMarketQualityResult[] | null;
  readonly setValue: (field: BlackMarketField, value: string) => void;
  readonly fillFromShared: () => void;
  readonly reset: () => void;
}

const BlackMarketToolContext = createContext<BlackMarketContextValue | null>(null);

function useBlackMarketTool() {
  const context = useContext(BlackMarketToolContext);
  if (!context) {
    throw new Error('BlackMarketTool 元件必須放在 BlackMarketToolProvider 內。');
  }

  return context;
}

export function BlackMarketToolProvider({ children }: { children: ReactNode }) {
  const sharedSnapshot = useSharedUserInputs();
  const sharedStore = useSharedUserInputsStore();
  const [toolState, setToolState] = useToolStateStorage<BlackMarketToolState>(
    'black-market',
    defaultBlackMarketToolState,
    {
      validate: isBlackMarketToolState,
      normalize: normalizeBlackMarketToolState,
      initialize: () => {
        const shared = selectBlackMarketSharedValues(sharedStore.getSnapshot());
        return {
          ...defaultBlackMarketToolState,
          printingLevel: shared.printingLevel,
          bargainPercent: shared.bargainPercent,
        };
      },
    },
  );
  const [priceDrafts, setPriceDrafts] = useState<BlackMarketPriceValues>(() => {
    const defaults = selectBlackMarketSharedValues(defaultSharedUserInputs);
    return {
      trashCachePerAi: defaults.trashCachePerAi,
      commonCachePerAi: defaults.commonCachePerAi,
      highQualityCachePerAi: defaults.highQualityCachePerAi,
      rareCachePerAi: defaults.rareCachePerAi,
      btcPerAi: defaults.btcPerAi,
    };
  });
  const [dirtyFields, setDirtyFields] = useState<ReadonlySet<BlackMarketWritableField>>(
    () => new Set(),
  );
  const sharedValues = useMemo(
    () => selectBlackMarketSharedValues(sharedSnapshot),
    [sharedSnapshot],
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;

      setPriceDrafts((current) => {
        let next: BlackMarketPriceValues | null = null;

        for (const field of blackMarketPriceFields) {
          if (!dirtyFields.has(field) && current[field] !== sharedValues[field]) {
            next = { ...(next ?? current), [field]: sharedValues[field] };
          }
        }

        return next ?? current;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [dirtyFields, sharedValues]);

  const setValue = useCallback(
    (field: BlackMarketField, value: string) => {
      if (field === 'trashCachePerAi' ||
        field === 'commonCachePerAi' ||
        field === 'highQualityCachePerAi' ||
        field === 'rareCachePerAi' ||
        field === 'btcPerAi') {
        setPriceDrafts((current) => ({ ...current, [field]: value }));
        setDirtyFields((current) => {
          const next = new Set(current);
          next.add(field);
          return next;
        });

        const parsed = parseBlackMarketPriceValue(value);
        if (parsed === null) return;

        const accepted = sharedStore.update((current) =>
          updateBlackMarketSharedValue(current, field, parsed),
        );
        if (!accepted) return;

        setDirtyFields((current) => {
          if (!current.has(field)) return current;
          const next = new Set(current);
          next.delete(field);
          return next;
        });
        return;
      }

      setToolState((current) => ({ ...current, [field]: value }));
    },
    [setToolState, sharedStore],
  );

  const fillFromShared = useCallback(() => {
    const latestSharedValues = selectBlackMarketSharedValues(sharedStore.getSnapshot());
    setToolState((current) => applyBlackMarketSharedValues(current, latestSharedValues));
    setPriceDrafts({
      trashCachePerAi: latestSharedValues.trashCachePerAi,
      commonCachePerAi: latestSharedValues.commonCachePerAi,
      highQualityCachePerAi: latestSharedValues.highQualityCachePerAi,
      rareCachePerAi: latestSharedValues.rareCachePerAi,
      btcPerAi: latestSharedValues.btcPerAi,
    });
    setDirtyFields(new Set());
  }, [setToolState, sharedStore]);

  const reset = useCallback(() => {
    clearToolState('black-market');
    const latestSharedValues = selectBlackMarketSharedValues(sharedStore.getSnapshot());
    setToolState({
      printingLevel: latestSharedValues.printingLevel,
      bargainPercent: latestSharedValues.bargainPercent,
      btcBuffPercent: defaultBlackMarketToolState.btcBuffPercent,
      trashAmount: defaultBlackMarketCacheAmount,
      commonAmount: defaultBlackMarketCacheAmount,
      highQualityAmount: defaultBlackMarketCacheAmount,
      rareAmount: defaultBlackMarketCacheAmount,
    });
    setPriceDrafts({
      trashCachePerAi: latestSharedValues.trashCachePerAi,
      commonCachePerAi: latestSharedValues.commonCachePerAi,
      highQualityCachePerAi: latestSharedValues.highQualityCachePerAi,
      rareCachePerAi: latestSharedValues.rareCachePerAi,
      btcPerAi: latestSharedValues.btcPerAi,
    });
    setDirtyFields(new Set());
  }, [setToolState, sharedStore]);

  const values = useMemo(
    () => createBlackMarketValues(toolState, priceDrafts),
    [priceDrafts, toolState],
  );
  const calculation = useMemo(() => calculateBlackMarketTool(values), [values]);
  const contextValue = useMemo(
    () => ({
      values,
      errors: calculation.errors,
      inputs: calculation.inputs,
      result: calculation.result,
      setValue,
      fillFromShared,
      reset,
    }),
    [calculation, fillFromShared, reset, setValue, values],
  );

  return (
    <BlackMarketToolContext.Provider value={contextValue}>
      {children}
    </BlackMarketToolContext.Provider>
  );
}

function formatTemplate(template: string, replacements: Record<string, string | number>) {
  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.replace('$' + '{' + key + '}', String(value)),
    template,
  );
}

function getErrorMessage(
  field: BlackMarketField,
  errors: BlackMarketErrors,
  labels: BlackMarketToolLabels,
) {
  const error = errors[field];
  if (error === 'level') return labels.validationLevel;
  if (error === 'bargain') return labels.validationBargain;
  if (error === 'amount') return labels.validationAmount;
  if (error === 'rate') return labels.validationRate;
  if (error === 'buff') return labels.validationBuff;
  return undefined;
}

function BlackMarketPrimaryField({
  field,
  id,
  label,
  unit,
  range,
  min,
  max,
  placeholder,
  labels,
}: {
  field: Exclude<BlackMarketField, BlackMarketWritableField | 'btcBuffPercent'>;
  id: string;
  label: string;
  unit: string;
  range: string;
  min: number;
  max?: number;
  placeholder?: string;
  labels: BlackMarketToolLabels;
}) {
  const { values, errors, setValue } = useBlackMarketTool();

  return (
    <ToolInputField
      id={id}
      label={label}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step="1"
      value={values[field]}
      placeholder={placeholder}
      onChange={(event) => setValue(field, event.target.value)}
      error={getErrorMessage(field, errors, labels)}
      range={range}
      unit={unit}
    />
  );
}

function BlackMarketBuffField({
  id,
  label,
  labels,
}: {
  id: string;
  label: string;
  labels: BlackMarketToolLabels;
}) {
  const { values, errors, setValue } = useBlackMarketTool();

  return (
    <ToolBuffSliderField
      id={id}
      label={label}
      range={labels.buffRange}
      unit={labels.percentUnit}
      value={values.btcBuffPercent}
      onValueChange={(value) => setValue('btcBuffPercent', String(value))}
      error={getErrorMessage('btcBuffPercent', errors, labels)}
    />
  );
}

function BlackMarketRateField({
  field,
  id,
  label,
  unit,
  labels,
}: {
  field: BlackMarketWritableField;
  id: string;
  label: string;
  unit: string;
  labels: BlackMarketToolLabels;
}) {
  const { values, errors, setValue } = useBlackMarketTool();

  return (
    <ToolInputField
      id={id}
      label={label}
      type="number"
      inputMode="numeric"
      min={1}
      step="1"
      value={values[field]}
      onChange={(event) => setValue(field, event.target.value)}
      error={getErrorMessage(field, errors, labels)}
      range={labels.rateRange}
      unit={unit}
    />
  );
}

export function BlackMarketSettingsPanel({
  labels,
  locale,
  idPrefix = 'black-market-settings',
}: {
  labels: BlackMarketToolLabels;
  locale: Locale;
  idPrefix?: string;
}) {
  const { reset } = useBlackMarketTool();

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div>
        <h2 className="font-semibold text-foreground">{labels.settingsTitle}</h2>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">{labels.amounts}</h3>
        <div className="space-y-5">
          {blackMarketQualityCatalog.map((quality) => {
            const field = blackMarketQualityToAmountField[quality.id];
            const qualityLabel = quality.labels[locale];

            return (
              <BlackMarketPrimaryField
                key={quality.id}
                field={field}
                id={`${idPrefix}-${quality.id}-amount`}
                label={`${qualityLabel} ${labels.cacheAmount}`}
                unit={labels.amountUnit}
                range={labels.amountRange}
                min={0}
                labels={labels}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-auto border-t border-border pt-4">
        <ToolPresetButton
          type="button"
          variant="outline"
          className="w-full"
          onClick={reset}
          icon={<RotateCcw aria-hidden="true" />}
          label={labels.reset}
        />
      </div>
    </div>
  );
}

function formatDecimal(formatNumber: NumberFormatter, value: number) {
  return formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatWhole(formatNumber: NumberFormatter, value: number) {
  return formatNumber(value, {
    maximumFractionDigits: 0,
  });
}

function formatBreakEven(
  result: BlackMarketQualityResult,
  printingLevel: number,
  labels: BlackMarketToolLabels,
) {
  if (result.breakEvenLevel === null) return labels.notAvailable;
  if (result.breakEvenLevel <= printingLevel) return labels.breakEvenCurrent;

  return formatTemplate(labels.breakEvenAt, {
    level: result.breakEvenLevel,
    levels: result.breakEvenLevel - printingLevel,
  });
}

function EmptyBlackMarketResult({
  labels,
  hasErrors,
}: {
  labels: BlackMarketToolLabels;
  hasErrors: boolean;
}) {
  return (
    <ToolState
      variant={hasErrors ? 'error' : 'empty'}
      title={hasErrors ? labels.validationSummary : labels.noResult}
      description={!hasErrors ? labels.noResultHint : undefined}
    />
  );
}

function BlackMarketResultTable({
  labels,
  locale,
  result,
  printingLevel,
  formatNumber,
}: {
  labels: BlackMarketToolLabels;
  locale: Locale;
  result: readonly BlackMarketQualityResult[];
  printingLevel: number;
  formatNumber: NumberFormatter;
}) {
  return (
    <div
      data-result-layout="table"
      className="overflow-x-auto rounded-[var(--cco-card-radius)] border border-border"
    >
      <table className="w-full min-w-[48rem] table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col className="w-[15%]" />
          <col className="w-[19%]" />
          <col className="w-[16%]" />
          <col className="w-[14%]" />
          <col className="w-[16%]" />
          <col className="w-[20%]" />
        </colgroup>
        <caption className="sr-only">{labels.results}</caption>
        <thead className="bg-muted/40 text-muted-foreground">
          <tr className="border-b border-border">
            <th scope="col" className="px-4 py-3 font-medium">
              {labels.quality}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {labels.netProfit}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {labels.soldBtc}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {labels.costAi}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {labels.profitAi}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {labels.breakEven}
            </th>
          </tr>
        </thead>
        <tbody>
          {result.map((qualityResult) => {
            const quality = blackMarketQualityCatalog.find((item) => item.id === qualityResult.id);
            const qualityLabel = quality?.labels[locale] ?? qualityResult.id;
            const profitBtcClass = qualityResult.profitBtc < 0
              ? 'text-destructive'
              : 'text-foreground';
            const profitAiClass = qualityResult.profitAi < 0
              ? 'text-destructive'
              : 'text-foreground';

            return (
              <tr key={qualityResult.id} className="border-b border-border last:border-b-0">
                <th scope="row" className="px-4 py-3 font-medium text-foreground">
                  <span className="block whitespace-nowrap">{qualityLabel}</span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    {formatWhole(formatNumber, qualityResult.cacheAmount)} {labels.amountUnit}
                  </span>
                </th>
                <td className={cn('whitespace-nowrap px-4 py-3 font-medium', profitBtcClass)}>
                  {formatDecimal(formatNumber, qualityResult.profitBtc)} {labels.btcUnit}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {formatWhole(formatNumber, qualityResult.soldBtc)} {labels.btcUnit}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {formatDecimal(formatNumber, qualityResult.costAi)} {labels.aiUnit}
                </td>
                <td className={cn('whitespace-nowrap px-4 py-3 font-medium', profitAiClass)}>
                  {formatDecimal(formatNumber, qualityResult.profitAi)} {labels.aiUnit}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {formatBreakEven(qualityResult, printingLevel, labels)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function BlackMarketCalculator({
  labels,
  locale,
  numberFormatter,
}: {
  labels: BlackMarketToolLabels;
  locale: Locale;
  numberFormatter?: NumberFormatter;
}) {
  const { errors, inputs, result, fillFromShared } = useBlackMarketTool();
  const hasErrors = Object.keys(errors).length > 0;
  const formatNumber = useMemo(
    () => numberFormatter ?? createNumberFormatter(locale),
    [locale, numberFormatter],
  );

  return (
    <div className="not-prose my-8 space-y-6" data-tool="black-market">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="site-tool-section-heading">{labels.primaryInputs}</CardTitle>
            </div>
            <ToolPresetButton
              type="button"
              variant="outline"
              onClick={fillFromShared}
              icon={<Download aria-hidden="true" />}
              label={labels.fillShared}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="@container">
            <div className="grid gap-5 @min-[24rem]:grid-cols-2 @min-[64rem]:grid-cols-4">
              <BlackMarketPrimaryField
                field="printingLevel"
                id="black-market-printing-level"
                label={labels.printingLevel}
                unit={labels.levelUnit}
                range={labels.levelRange}
                min={BLACK_MARKET_LEVEL_MIN}
                max={BLACK_MARKET_LEVEL_MAX}
                placeholder={labels.levelPlaceholder}
                labels={labels}
              />
              <BlackMarketPrimaryField
                field="bargainPercent"
                id="black-market-bargain-percent"
                label={labels.bargainPercent}
                unit={labels.percentUnit}
                range={labels.bargainRange}
                min={0}
                max={40}
                labels={labels}
              />
              <BlackMarketBuffField
                id="black-market-btc-buff-percent"
                label={labels.btcBuffPercent}
                labels={labels}
              />
              <BlackMarketRateField
                field="btcPerAi"
                id="black-market-btc-per-ai"
                label={labels.btcPerAi}
                unit={labels.btcPerAiUnit}
                labels={labels}
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground">{labels.prices}</h3>
            <div className="mt-4 @container">
              <div className="grid gap-5 @min-[24rem]:grid-cols-2 @min-[64rem]:grid-cols-4">
                {blackMarketQualityCatalog.map((quality) => {
                  const field = blackMarketQualityToPriceField[quality.id];
                  const cacheLabel = getMarketCacheRateDefinition(quality.id).labels[locale];

                  return (
                    <BlackMarketRateField
                      key={quality.id}
                      field={field}
                      id={`black-market-${quality.id}-cache-rate`}
                      label={`${cacheLabel} ${labels.cacheRate}`}
                      unit={labels.cacheRateUnit}
                      labels={labels}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="mb-4">
          <h2 className="site-tool-section-heading text-xl font-semibold tracking-tight text-foreground">{labels.results}</h2>
        </div>
        {result && inputs ? (
          <BlackMarketResultTable
            labels={labels}
            locale={locale}
            result={result}
            printingLevel={inputs.printingLevel}
            formatNumber={formatNumber}
          />
        ) : (
          <EmptyBlackMarketResult labels={labels} hasErrors={hasErrors} />
        )}
      </div>
    </div>
  );
}

export function BlackMarketToolPage({
  toc,
  full,
  contextLabel,
  contextPanelLabel,
  contextCloseLabel,
  labels,
  locale,
  header,
  headerActions,
  children,
}: Omit<ContextualDocsPageProps, 'contextItems' | 'defaultContextId' | 'mobileContext' | 'children'> & {
  labels: BlackMarketToolLabels;
  locale: Locale;
  header: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <BlackMarketToolProvider>
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
          idPrefix: 'black-market-settings',
          render: ({ idPrefix }) => (
            <BlackMarketSettingsPanel
              labels={labels}
              locale={locale}
              idPrefix={idPrefix}
            />
          ),
        }}
      >
        {children}
      </ToolPage>
    </BlackMarketToolProvider>
  );
}
