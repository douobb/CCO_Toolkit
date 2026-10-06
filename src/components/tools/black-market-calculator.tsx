'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
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
  ToolPrimaryActions,
  ToolSharedNumberField,
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
  type SharedUserInputs,
} from '@/lib/storage';
import { useToolStateStorage } from '@/lib/storage/use-tool-state';
import {
  updateSharedCacheRate,
  updateSharedEquipmentNumber,
  updateSharedExchangeRate,
} from './shared-input-updates';
import { getSharedFieldPresentation } from './shared-field-presentation';

export interface BlackMarketToolLabels {
  readonly primaryInputs: string;
  readonly printingLevel: string;
  readonly prices: string;
  readonly btcBuffPercent: string;
  readonly levelPlaceholder: string;
  readonly levelRange: string;
  readonly buffRange: string;
  readonly levelUnit: string;
  readonly percentUnit: string;
  readonly amounts: string;
  readonly cacheAmount: string;
  readonly amountUnit: string;
  readonly amountRange: string;
  readonly reset: string;
  readonly fillPlayer: string;
  readonly validationSummary: string;
  readonly validationLevel: string;
  readonly validationBargain: string;
  readonly validationRate: string;
  readonly validationAmount: string;
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
  readonly btcBuffPercent: string;
  readonly trashAmount: string;
  readonly commonAmount: string;
  readonly highQualityAmount: string;
  readonly rareAmount: string;
}

type BlackMarketSharedRateField =
  | 'trashCachePerAi'
  | 'commonCachePerAi'
  | 'highQualityCachePerAi'
  | 'rareCachePerAi';
export type BlackMarketSharedValues = Pick<
  BlackMarketFormValues,
  | 'printingLevel'
  | 'bargainPercent'
  | BlackMarketSharedRateField
  | 'btcPerAi'
>;
type BlackMarketToolField = keyof BlackMarketToolState;

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
} as const satisfies Record<BlackMarketQualityId, BlackMarketSharedRateField>;

const defaultBlackMarketCacheAmount = '1000';

const defaultBlackMarketToolState: BlackMarketToolState = {
  printingLevel: String(BLACK_MARKET_LEVEL_MIN),
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

/** 將玩家等級帶入試算；保留 BUFF 與本工具數量。 */
export function applyBlackMarketPlayerValues(
  current: BlackMarketToolState,
  shared: BlackMarketSharedValues,
): BlackMarketToolState {
  return {
    ...current,
    printingLevel: shared.printingLevel,
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
  return keys.length === 6 && keys.every((key) =>
    key === 'printingLevel' ||
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
    'trashAmount',
    'commonAmount',
    'highQualityAmount',
    'rareAmount',
  ] as const;
  const keys = Object.keys(value);
  if (
    keys.length < requiredFields.length ||
    keys.length > requiredFields.length + 2 ||
    !keys.every((key) =>
      key === 'btcBuffPercent' ||
      key === 'bargainPercent' ||
      requiredFields.includes(key as typeof requiredFields[number])
    ) ||
    requiredFields.some((field) => typeof value[field] !== 'string') ||
    (Object.prototype.hasOwnProperty.call(value, 'bargainPercent') &&
      typeof value.bargainPercent !== 'string')
  ) {
    return undefined;
  }

  const btcBuffPercent = Object.prototype.hasOwnProperty.call(value, 'btcBuffPercent')
    ? normalizeLegacyBuffPercentString(value.btcBuffPercent)
    : BUFF_PERCENT_DEFAULT_STRING;
  if (btcBuffPercent === undefined) return undefined;

  return {
    printingLevel: value.printingLevel as string,
    btcBuffPercent,
    trashAmount: value.trashAmount as string,
    commonAmount: value.commonAmount as string,
    highQualityAmount: value.highQualityAmount as string,
    rareAmount: value.rareAmount as string,
  };
}

export function createBlackMarketValues(
  toolState: BlackMarketToolState,
  sharedValues: BlackMarketSharedValues,
): BlackMarketFormValues {
  return {
    ...sharedValues,
    ...toolState,
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
  readonly setValue: (field: BlackMarketToolField, value: string) => void;
  readonly fillPlayer: () => void;
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
        };
      },
    },
  );
  const sharedValues = useMemo(
    () => selectBlackMarketSharedValues(sharedSnapshot),
    [sharedSnapshot],
  );

  const setValue = useCallback(
    (field: BlackMarketToolField, value: string) => {
      setToolState((current) => ({ ...current, [field]: value }));
    },
    [setToolState],
  );

  const fillPlayer = useCallback(() => {
    const latestSharedValues = selectBlackMarketSharedValues(sharedStore.getSnapshot());
    setToolState((current) => applyBlackMarketPlayerValues(current, latestSharedValues));
  }, [setToolState, sharedStore]);

  const reset = useCallback(() => {
    clearToolState('black-market');
    const latestSharedValues = selectBlackMarketSharedValues(sharedStore.getSnapshot());
    setToolState({
      printingLevel: latestSharedValues.printingLevel,
      btcBuffPercent: defaultBlackMarketToolState.btcBuffPercent,
      trashAmount: defaultBlackMarketCacheAmount,
      commonAmount: defaultBlackMarketCacheAmount,
      highQualityAmount: defaultBlackMarketCacheAmount,
      rareAmount: defaultBlackMarketCacheAmount,
    });
  }, [setToolState, sharedStore]);

  const values = useMemo(
    () => createBlackMarketValues(toolState, sharedValues),
    [sharedValues, toolState],
  );
  const calculation = useMemo(() => calculateBlackMarketTool(values), [values]);
  const contextValue = useMemo(
    () => ({
      values,
      errors: calculation.errors,
      inputs: calculation.inputs,
      result: calculation.result,
      setValue,
      fillPlayer,
      reset,
    }),
    [calculation, fillPlayer, reset, setValue, values],
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
  if (error === 'amount') return labels.validationAmount;
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
  field: Exclude<BlackMarketToolField, 'btcBuffPercent'>;
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

function BlackMarketBargainField({ locale }: { locale: Locale }) {
  const { values } = useBlackMarketTool();
  const store = useSharedUserInputsStore();
  const sharedField = getSharedFieldPresentation(locale);

  return (
    <ToolSharedNumberField
      id="black-market-bargain-percent"
      label={sharedField.bargain.label}
      sharedLabel={sharedField.sharedLabel}
      value={values.bargainPercent}
      min={0}
      max={40}
      integer
      unit={sharedField.bargain.unit}
      range={sharedField.bargain.range}
      invalidValueMessage={sharedField.invalidValueMessage}
      onValueChange={(value) => store.update((current) =>
        updateSharedEquipmentNumber(current, 'bargainPercent', value),
      )}
    />
  );
}

function BlackMarketExchangeRateField({ locale }: { locale: Locale }) {
  const { values } = useBlackMarketTool();
  const store = useSharedUserInputsStore();
  const sharedField = getSharedFieldPresentation(locale);

  return (
    <ToolSharedNumberField
      id="black-market-btc-per-ai"
      label={sharedField.exchangeRate.label}
      sharedLabel={sharedField.sharedLabel}
      value={values.btcPerAi}
      min={1}
      integer
      unit={sharedField.exchangeRate.unit}
      range={sharedField.exchangeRate.range}
      invalidValueMessage={sharedField.invalidValueMessage}
      onValueChange={(value) => store.update((current) =>
        updateSharedExchangeRate(current, value),
      )}
    />
  );
}

function BlackMarketCacheRateField({
  qualityId,
  locale,
}: {
  qualityId: BlackMarketQualityId;
  locale: Locale;
}) {
  const { values } = useBlackMarketTool();
  const store = useSharedUserInputsStore();
  const sharedFields = getSharedFieldPresentation(locale);
  const sharedField = sharedFields.cacheRate(qualityId);
  const field = blackMarketQualityToPriceField[qualityId];

  return (
    <ToolSharedNumberField
      id={`black-market-${qualityId}-cache-rate`}
      label={sharedField.label}
      sharedLabel={sharedFields.sharedLabel}
      value={values[field]}
      min={1}
      integer
      unit={sharedField.unit}
      range={sharedField.range}
      invalidValueMessage={sharedFields.invalidValueMessage}
      onValueChange={(value) => store.update((current) =>
        updateSharedCacheRate(current, qualityId, value),
      )}
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

function withUnbrokenBreakEvenLevel(message: string, level: number): ReactNode {
  const levelText = `Lv.${level}`;
  const levelIndex = message.indexOf(levelText);
  if (levelIndex < 0) return message;

  const openingIndex = message[levelIndex - 1] === '（' || message[levelIndex - 1] === '('
    ? levelIndex - 1
    : levelIndex;
  const levelEndIndex = levelIndex + levelText.length;
  const groupEndIndex = message[levelEndIndex] === '）' || message[levelEndIndex] === ')'
    ? levelEndIndex + 1
    : levelEndIndex;

  return (
    <>
      {message.slice(0, openingIndex)}
      <span className="whitespace-nowrap">{message.slice(openingIndex, groupEndIndex)}</span>
      {message.slice(groupEndIndex)}
    </>
  );
}

function formatBreakEven(
  result: BlackMarketQualityResult,
  printingLevel: number,
  labels: BlackMarketToolLabels,
): ReactNode {
  if (result.breakEvenLevel === null) return labels.notAvailable;
  if (result.breakEvenLevel <= printingLevel) {
    return withUnbrokenBreakEvenLevel(
      formatTemplate(labels.breakEvenCurrent, { level: result.breakEvenLevel }),
      result.breakEvenLevel,
    );
  }

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
                <td className="px-4 py-3 text-muted-foreground">
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
  const { errors, inputs, result, fillPlayer, reset } = useBlackMarketTool();
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
            <ToolPrimaryActions
              fillPlayer={{ label: labels.fillPlayer, onClick: fillPlayer }}
              onReset={reset}
              resetLabel={labels.reset}
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
              <BlackMarketBargainField locale={locale} />
              <BlackMarketBuffField
                id="black-market-btc-buff-percent"
                label={labels.btcBuffPercent}
                labels={labels}
              />
              <BlackMarketExchangeRateField locale={locale} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground">{labels.prices}</h3>
            <div className="mt-4 @container">
              <div className="grid gap-5 @min-[24rem]:grid-cols-2 @min-[64rem]:grid-cols-4">
                {blackMarketQualityCatalog.map((quality) => (
                  <BlackMarketCacheRateField
                    key={quality.id}
                    qualityId={quality.id}
                    locale={locale}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground">{labels.amounts}</h3>
            <div className="mt-4 @container">
              <div className="grid gap-5 @min-[24rem]:grid-cols-2 @min-[64rem]:grid-cols-4">
                {blackMarketQualityCatalog.map((quality) => {
                  const field = blackMarketQualityToAmountField[quality.id];
                  const qualityLabel = quality.labels[locale];

                  return (
                    <BlackMarketPrimaryField
                      key={quality.id}
                      field={field}
                      id={`black-market-${quality.id}-amount`}
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
      >
        {children}
      </ToolPage>
    </BlackMarketToolProvider>
  );
}
