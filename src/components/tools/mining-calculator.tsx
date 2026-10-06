'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ContextualDocsPageProps } from '@/components/context';
import {
  useSharedUserInputs,
  useSharedUserInputsStore,
} from '@/components/shared-user-inputs';
import {
  ToolBreakdown,
  ToolBuffSliderField,
  ToolInputField,
  ToolPage,
  ToolPrimaryActions,
  ToolResultCard,
  ToolSharedNumberField,
  ToolState,
  ToolValidationSummary,
} from '@/components/tools';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getProgressionLevelDefinition, getProgressionMethods } from '@/data/game/progression';
import {
  calculateMining,
  MINING_LEVEL_MAX,
  MINING_LEVEL_MIN,
  type AiCraftResult,
  type MiningBtcResult,
  type MiningCalculation,
  type MiningInputs,
} from '@/lib/mining-calculator';
import {
  BUFF_PERCENT_DEFAULT_STRING,
  normalizeLegacyBuffPercentString,
  parseBuffPercent,
} from '@/lib/buff-percent';
import { getDualPrice, resolveMarketPrices } from '@/lib/market-prices';
import { createNumberFormatter, type NumberFormatter } from '@/lib/number-formatting';
import type { Locale } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import {
  clearToolState,
  type SharedUserInputs,
} from '@/lib/storage';
import { useToolStateStorage } from '@/lib/storage/use-tool-state';
import { updateSharedExchangeRate, updateSharedMarketPrice } from './shared-input-updates';
import { getSharedFieldPresentation } from './shared-field-presentation';

export interface MiningToolLabels {
  readonly primaryInputs: string;
  readonly miningLevel: string;
  readonly miningLevelPlaceholder: string;
  readonly hashPrice: string;
  readonly hashPriceUnit: string;
  readonly levelRange: string;
  readonly levelUnit: string;
  readonly buffs: string;
  readonly cortexBonus: string;
  readonly tradeExploit: string;
  readonly percentUnit: string;
  readonly buffRange: string;
  readonly reset: string;
  readonly fillPlayer: string;
  readonly validationSummary: string;
  readonly validationLevel: string;
  readonly validationBuff: string;
  readonly noResult: string;
  readonly noResultHint: string;
  readonly btcTitle: string;
  readonly btcDescription: string;
  readonly aiTitle: string;
  readonly aiDescription: string;
  readonly currentLevel: string;
  readonly netProfit: string;
  readonly perMinute: string;
  readonly btcPerMinuteUnit: string;
  readonly aiPerMinuteUnit: string;
  readonly switchNetProfitUnit: string;
  readonly btcUnit: string;
  readonly aiUnit: string;
  readonly breakdown: string;
  readonly btcOutput: string;
  readonly aiOutput: string;
  readonly roi: string;
  readonly breakEven: string;
  readonly breakEvenCurrent: string;
  readonly breakEvenAt: string;
  readonly requiredHash: string;
  readonly upgradeCostAi: string;
  readonly notAvailable: string;
  readonly costZero: string;
}

export interface MiningFormValues {
  readonly miningLevel: string;
  readonly aiPerHash: string;
  readonly btcPerAi: string;
  readonly aiPerThousandTechScrap: string;
  readonly cortexBonusPercent: string;
  readonly tradeExploitPercent: string;
}

export type MiningField = keyof MiningFormValues;
export type MiningError = 'level' | 'price' | 'rate' | 'buff';
export type MiningErrors = Partial<Record<MiningField, MiningError>>;

export interface MiningToolState {
  readonly miningLevel: string;
  readonly cortexBonusPercent: string;
  readonly tradeExploitPercent: string;
}

type MiningToolField = keyof MiningToolState;
export type MiningSharedValues = Omit<
  MiningFormValues,
  'cortexBonusPercent' | 'tradeExploitPercent'
>;

const defaultMiningToolState: MiningToolState = {
  miningLevel: String(MINING_LEVEL_MIN),
  cortexBonusPercent: BUFF_PERCENT_DEFAULT_STRING,
  tradeExploitPercent: BUFF_PERCENT_DEFAULT_STRING,
};

function getSharedMiningLevel(snapshot: SharedUserInputs) {
  const stored = snapshot.progression.skills.find((skill) => skill.id === 'mining-skill');
  return String(stored?.level ?? getProgressionLevelDefinition('mining-skill').defaultValue);
}

/**
 * 將 progression 與 economy 投影成挖礦工具可讀的具名欄位；Buff 屬於工具自身狀態。
 * 不依賴陣列位置，也不把 Game Data 或 Shared User Inputs 複製到工具內。
 */
export function selectMiningSharedValues(snapshot: SharedUserInputs): MiningSharedValues {
  const prices = resolveMarketPrices(snapshot);

  return {
    miningLevel: getSharedMiningLevel(snapshot),
    aiPerHash: String(getDualPrice(prices, 'hash', 'ai')),
    btcPerAi: String(prices.btcPerAi),
    aiPerThousandTechScrap: String(getDualPrice(prices, 'tech-scrap', 'ai')),
  };
}

/** 將玩家等級帶入目前試算；保留工具自己的 BUFF。 */
export function applyMiningPlayerValues(
  current: MiningToolState,
  shared: MiningSharedValues,
): MiningToolState {
  return { ...current, miningLevel: shared.miningLevel };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMiningToolState(value: unknown): value is MiningToolState {
  if (
    !isRecord(value) ||
    typeof value.miningLevel !== 'string' ||
    typeof value.cortexBonusPercent !== 'string' ||
    typeof value.tradeExploitPercent !== 'string'
  ) {
    return false;
  }

  const keys = Object.keys(value);
  return keys.length === 3 && keys.every((key) =>
    key === 'miningLevel' ||
    key === 'cortexBonusPercent' ||
    key === 'tradeExploitPercent'
  );
}

export function normalizeMiningToolState(
  value: unknown,
): MiningToolState | undefined {
  if (!isRecord(value)) return undefined;

  const keys = Object.keys(value);
  const requiredFields = ['miningLevel'] as const;
  if (
    (keys.length < requiredFields.length || keys.length > 3) ||
    !keys.every((key) => key === 'cortexBonusPercent' || key === 'tradeExploitPercent' || key === 'miningLevel') ||
    typeof value.miningLevel !== 'string'
  ) {
    return undefined;
  }

  const cortexBonusPercent = Object.prototype.hasOwnProperty.call(value, 'cortexBonusPercent')
    ? normalizeLegacyBuffPercentString(value.cortexBonusPercent)
    : BUFF_PERCENT_DEFAULT_STRING;
  const tradeExploitPercent = Object.prototype.hasOwnProperty.call(value, 'tradeExploitPercent')
    ? normalizeLegacyBuffPercentString(value.tradeExploitPercent)
    : BUFF_PERCENT_DEFAULT_STRING;
  if (cortexBonusPercent === undefined || tradeExploitPercent === undefined) {
    return undefined;
  }

  return {
    miningLevel: value.miningLevel,
    cortexBonusPercent,
    tradeExploitPercent,
  };
}

export function createMiningValues(
  toolState: MiningToolState,
  sharedValues: MiningSharedValues,
): MiningFormValues {
  return {
    ...sharedValues,
    ...toolState,
  };
}

function parseNonNegativeNumber(value: string): number | null {
  if (!value.trim()) return null;

  const parsed = Number(value);
  if (
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    parsed > Number.MAX_SAFE_INTEGER
  ) {
    return null;
  }

  return parsed;
}

function parseInteger(value: string, min: number, max: number): number | null {
  const normalized = value.trim();
  if (!normalized || !/^\d+$/.test(normalized)) return null;

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return null;

  return parsed;
}

export function parseMiningValues(values: MiningFormValues): {
  readonly errors: MiningErrors;
  readonly inputs: MiningInputs | null;
} {
  const miningLevel = parseInteger(values.miningLevel, MINING_LEVEL_MIN, MINING_LEVEL_MAX);
  const aiPerHash = parseNonNegativeNumber(values.aiPerHash);
  const btcPerAi = parseInteger(values.btcPerAi, 1, Number.MAX_SAFE_INTEGER);
  const aiPerThousandTechScrap = parseNonNegativeNumber(values.aiPerThousandTechScrap);
  const cortexBonusPercent = parseBuffPercent(values.cortexBonusPercent);
  const tradeExploitPercent = parseBuffPercent(values.tradeExploitPercent);
  const errors: MiningErrors = {};

  if (miningLevel === null) errors.miningLevel = 'level';
  if (aiPerHash === null) errors.aiPerHash = 'price';
  if (btcPerAi === null) errors.btcPerAi = 'rate';
  if (aiPerThousandTechScrap === null) errors.aiPerThousandTechScrap = 'price';
  if (cortexBonusPercent === null) errors.cortexBonusPercent = 'buff';
  if (tradeExploitPercent === null) errors.tradeExploitPercent = 'buff';

  if (Object.keys(errors).length > 0) {
    return { errors, inputs: null };
  }

  return {
    errors,
    inputs: {
      miningLevel: miningLevel as number,
      aiPerHash: aiPerHash as number,
      btcPerAi: btcPerAi as number,
      aiPerThousandTechScrap: aiPerThousandTechScrap as number,
      cortexBonusPercent: cortexBonusPercent as number,
      tradeExploitPercent: tradeExploitPercent as number,
    },
  };
}

export function calculateMiningTool(values: MiningFormValues): {
  readonly errors: MiningErrors;
  readonly inputs: MiningInputs | null;
  readonly result: MiningCalculation | null;
} {
  const parsed = parseMiningValues(values);

  return {
    errors: parsed.errors,
    inputs: parsed.inputs,
    result: parsed.inputs ? calculateMining(parsed.inputs) : null,
  };
}

interface MiningContextValue {
  readonly values: MiningFormValues;
  readonly errors: MiningErrors;
  readonly inputs: MiningInputs | null;
  readonly result: MiningCalculation | null;
  readonly setValue: (field: MiningToolField, value: string) => void;
  readonly fillPlayer: () => void;
  readonly reset: () => void;
}

const MiningToolContext = createContext<MiningContextValue | null>(null);

function useMiningTool() {
  const context = useContext(MiningToolContext);
  if (!context) {
    throw new Error('MiningTool 元件必須放在 MiningToolProvider 內。');
  }

  return context;
}

export function MiningToolProvider({ children }: { children: ReactNode }) {
  const sharedSnapshot = useSharedUserInputs();
  const sharedStore = useSharedUserInputsStore();
  const [toolState, setToolState] = useToolStateStorage<MiningToolState>(
    'mining',
    defaultMiningToolState,
    {
      validate: isMiningToolState,
      normalize: normalizeMiningToolState,
      initialize: () => {
        const shared = selectMiningSharedValues(sharedStore.getSnapshot());
        return {
          miningLevel: shared.miningLevel,
          cortexBonusPercent: defaultMiningToolState.cortexBonusPercent,
          tradeExploitPercent: defaultMiningToolState.tradeExploitPercent,
        };
      },
    },
  );
  const sharedValues = useMemo(
    () => selectMiningSharedValues(sharedSnapshot),
    [sharedSnapshot],
  );

  const setValue = useCallback(
    (field: MiningToolField, value: string) => {
      setToolState((current) => ({ ...current, [field]: value }));
    },
    [setToolState],
  );

  const fillPlayer = useCallback(() => {
    const latestSharedValues = selectMiningSharedValues(sharedStore.getSnapshot());
    setToolState((current) => applyMiningPlayerValues(current, latestSharedValues));
  }, [setToolState, sharedStore]);

  const reset = useCallback(() => {
    clearToolState('mining');
    const latestSharedValues = selectMiningSharedValues(sharedStore.getSnapshot());
    setToolState({
      miningLevel: latestSharedValues.miningLevel,
      cortexBonusPercent: defaultMiningToolState.cortexBonusPercent,
      tradeExploitPercent: defaultMiningToolState.tradeExploitPercent,
    });
  }, [setToolState, sharedStore]);

  const values = useMemo(
    () => createMiningValues(toolState, sharedValues),
    [sharedValues, toolState],
  );
  const calculation = useMemo(() => calculateMiningTool(values), [values]);
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
    <MiningToolContext.Provider value={contextValue}>
      {children}
    </MiningToolContext.Provider>
  );
}

function formatTemplate(template: string, replacements: Record<string, string | number>) {
  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.replace('$' + '{' + key + '}', String(value)),
    template,
  );
}

function getErrorMessage(
  field: MiningField,
  errors: MiningErrors,
  labels: MiningToolLabels,
) {
  const error = errors[field];
  if (error === 'level') return labels.validationLevel;
  if (error === 'buff') return labels.validationBuff;
  return undefined;
}

function MiningSettingField({
  field,
  id,
  label,
  unit,
  labels,
}: {
  field: 'cortexBonusPercent' | 'tradeExploitPercent';
  id: string;
  label: string;
  unit: string;
  labels: MiningToolLabels;
}) {
  const { values, errors, setValue } = useMiningTool();

  return (
    <ToolBuffSliderField
      id={id}
      label={label}
      range={labels.buffRange}
      unit={unit}
      value={values[field]}
      onValueChange={(value) => setValue(field, String(value))}
      error={getErrorMessage(field, errors, labels)}
    />
  );
}

function MiningSharedPriceField({
  labels,
  locale,
}: {
  labels: MiningToolLabels;
  locale: Locale;
}) {
  const { values } = useMiningTool();
  const store = useSharedUserInputsStore();
  const sharedFields = getSharedFieldPresentation(locale);
  return (
    <ToolSharedNumberField
      id="mining-hash-price"
      label={labels.hashPrice}
      sharedLabel={sharedFields.sharedLabel}
      value={values.aiPerHash}
      min={0}
      integer={false}
      unit={labels.hashPriceUnit}
      range={sharedFields.priceRange}
      invalidValueMessage={sharedFields.invalidValueMessage}
      onValueChange={(value) => store.update((current) =>
        updateSharedMarketPrice(current, 'hash', 'ai', value),
      )}
    />
  );
}

function MiningSharedExchangeRateField({ locale }: { locale: Locale }) {
  const { values } = useMiningTool();
  const store = useSharedUserInputsStore();
  const sharedFields = getSharedFieldPresentation(locale);

  return (
    <ToolSharedNumberField
      id="mining-btc-per-ai"
      label={sharedFields.exchangeRate.label}
      sharedLabel={sharedFields.sharedLabel}
      value={values.btcPerAi}
      min={1}
      integer
      unit={sharedFields.exchangeRate.unit}
      range={sharedFields.exchangeRate.range}
      invalidValueMessage={sharedFields.invalidValueMessage}
      onValueChange={(value) => store.update((current) =>
        updateSharedExchangeRate(current, value),
      )}
    />
  );
}

function MiningLevelField({
  labels,
  id = 'mining-level',
}: {
  labels: MiningToolLabels;
  id?: string;
}) {
  const { values, errors, setValue } = useMiningTool();

  return (
    <ToolInputField
      id={id}
      label={labels.miningLevel}
      type="number"
      inputMode="numeric"
      min={MINING_LEVEL_MIN}
      max={MINING_LEVEL_MAX}
      step="1"
      value={values.miningLevel}
      placeholder={labels.miningLevelPlaceholder}
      range={labels.levelRange}
      unit={labels.levelUnit}
      onChange={(event) => setValue('miningLevel', event.target.value)}
      error={getErrorMessage('miningLevel', errors, labels)}
    />
  );
}

function formatAmount(formatNumber: NumberFormatter, value: number) {
  return formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatBreakEven(
  result: Pick<MiningBtcResult, 'miningLevel' | 'breakEvenLevel' | 'levelsToBreakEven'> |
    Pick<AiCraftResult, 'miningLevel' | 'breakEvenLevel' | 'levelsToBreakEven'>,
  labels: MiningToolLabels,
) {
  if (result.breakEvenLevel === null) return labels.notAvailable;
  if (result.breakEvenLevel <= result.miningLevel) return labels.breakEvenCurrent;

  return formatTemplate(labels.breakEvenAt, {
    level: result.breakEvenLevel,
    levels: result.levelsToBreakEven,
  });
}

type MiningCurrency = 'BTC' | 'AI';

const miningUnitMinutes = getProgressionMethods('mining-skill')
  .find((method) => method.id === 'mining')?.unitMinutes;
const aiCraftingUnitMinutes = getProgressionMethods('mining-skill')
  .find((method) => method.id === 'ai-crafting')?.unitMinutes;

function calculateMiningProfitPerMinute(
  profit: number,
  unitMinutes: number | null | undefined,
  groupsPerAction = 1,
): number | null {
  if (
    !Number.isFinite(profit)
    || typeof unitMinutes !== 'number'
    || unitMinutes <= 0
    || !Number.isFinite(groupsPerAction)
    || groupsPerAction <= 0
  ) {
    return null;
  }

  const profitPerMinute = profit / groupsPerAction / unitMinutes;
  return Number.isFinite(profitPerMinute) ? profitPerMinute : null;
}

function convertMiningProfit(
  profit: number | null,
  baseCurrency: MiningCurrency,
  currency: MiningCurrency,
  btcPerAi: number | undefined,
): number | null {
  if (profit === null || !Number.isFinite(profit)) return null;
  if (currency === baseCurrency) return profit;

  const conversionRate = typeof btcPerAi === 'number' && Number.isFinite(btcPerAi) && btcPerAi > 0
    ? btcPerAi
    : null;
  if (conversionRate === null) return null;

  const convertedProfit = currency === 'AI'
    ? profit / conversionRate
    : profit * conversionRate;
  return Number.isFinite(convertedProfit) ? convertedProfit : null;
}

function MiningNetProfitSummary({
  labels,
  sectionTitle,
  cardId,
  currentLevel,
  profit,
  baseCurrency,
  currency,
  onToggleCurrency,
  btcPerAi,
  formatNumber,
}: {
  labels: MiningToolLabels;
  sectionTitle: string;
  cardId: 'btc' | 'ai';
  currentLevel: string;
  profit: number;
  baseCurrency: MiningCurrency;
  currency: MiningCurrency;
  onToggleCurrency: () => void;
  btcPerAi: number | undefined;
  formatNumber: NumberFormatter;
}) {
  const amount = convertMiningProfit(profit, baseCurrency, currency, btcPerAi);
  const nextCurrency = currency === 'BTC' ? 'AI' : 'BTC';
  const unit = currency === 'BTC' ? labels.btcUnit : labels.aiUnit;
  const switchLabel = formatTemplate(labels.switchNetProfitUnit, {
    section: sectionTitle,
    unit: currency,
    nextUnit: nextCurrency,
  });

  return (
    <div className="rounded-[var(--cco-card-radius)] border border-border bg-muted/40 p-5">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="min-w-0 flex-1 break-words text-sm font-medium text-muted-foreground [overflow-wrap:anywhere]">
          {currentLevel}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 min-w-11 shrink-0 px-3 text-xs font-semibold tracking-wide focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={switchLabel}
          title={switchLabel}
          data-testid={`mining-net-profit-toggle-${cardId}`}
          onClick={onToggleCurrency}
        >
          <ArrowLeftRight aria-hidden="true" />
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{labels.netProfit}</p>
      <p
        className={cn(
          'mt-2 flex min-w-0 flex-wrap items-baseline gap-x-2 break-words text-3xl font-semibold tracking-tight',
          amount !== null && amount < 0 ? 'text-destructive' : 'text-foreground',
        )}
        data-testid={`mining-net-profit-value-${cardId}`}
      >
        <span
          className="min-w-0 [overflow-wrap:anywhere]"
          data-testid={`mining-net-profit-amount-${cardId}`}
        >
          {amount === null ? labels.notAvailable : formatAmount(formatNumber, amount)}
        </span>
        {amount !== null ? (
          <span
            className="whitespace-nowrap text-sm font-medium text-muted-foreground"
            data-testid={`mining-net-profit-unit-${cardId}`}
          >
            {unit}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function EmptyMiningResult({
  labels,
  hasErrors,
}: {
  labels: MiningToolLabels;
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

function MiningBtcResultCard({
  labels,
  result,
  hasErrors,
  formatNumber,
  btcPerAi,
}: {
  labels: MiningToolLabels;
  result: MiningBtcResult | undefined;
  hasErrors: boolean;
  formatNumber: NumberFormatter;
  btcPerAi: number | undefined;
}) {
  const [currency, setCurrency] = useState<MiningCurrency>('BTC');
  const profitPerMinute = result
    ? calculateMiningProfitPerMinute(result.profitBtc, miningUnitMinutes)
    : null;
  const displayProfitPerMinute = convertMiningProfit(profitPerMinute, 'BTC', currency, btcPerAi);
  const perMinuteUnit = currency === 'BTC' ? labels.btcPerMinuteUnit : labels.aiPerMinuteUnit;

  return (
    <ToolResultCard
      titleId="mining-btc-result-title"
      title={labels.btcTitle}
      titleClassName="site-tool-section-heading"
      className="h-full"
      validation={
        hasErrors ? (
          <ToolValidationSummary>{labels.validationSummary}</ToolValidationSummary>
        ) : undefined
      }
    >
      {result ? (
        <div className="space-y-6">
          <MiningNetProfitSummary
            labels={labels}
            sectionTitle={labels.btcTitle}
            cardId="btc"
            currentLevel={formatTemplate(labels.currentLevel, { level: result.miningLevel })}
            profit={result.profitBtc}
            baseCurrency="BTC"
            currency={currency}
            onToggleCurrency={() => setCurrency((current) => current === 'BTC' ? 'AI' : 'BTC')}
            btcPerAi={btcPerAi}
            formatNumber={formatNumber}
          />
          <ToolBreakdown
            title={labels.breakdown}
            titleId="mining-btc-breakdown-title"
            layout="rows"
            items={[
              {
                id: 'btc-output',
                label: labels.btcOutput,
                value: formatAmount(formatNumber, result.miningBtcPerAction) + ' ' + labels.btcUnit,
              },
              {
                id: 'per-minute',
                label: labels.perMinute,
                value: displayProfitPerMinute === null
                  ? labels.notAvailable
                  : (
                    <span data-testid="mining-per-minute-value-btc">
                      {formatAmount(formatNumber, displayProfitPerMinute)} {perMinuteUnit}
                    </span>
                  ),
              },
              {
                id: 'roi',
                label: labels.roi,
                value: result.roiPercent === null
                  ? labels.costZero
                  : formatAmount(formatNumber, result.roiPercent) + '%',
              },
              {
                id: 'break-even',
                label: labels.breakEven,
                value: formatBreakEven(result, labels),
              },
              {
                id: 'required-hash',
                label: labels.requiredHash,
                value: result.neededHashToProfit === null
                  ? labels.notAvailable
                  : formatNumber(result.neededHashToProfit),
              },
              {
                id: 'upgrade-cost-ai',
                label: labels.upgradeCostAi,
                value: result.upgradeCostAi === null
                  ? labels.notAvailable
                  : formatAmount(formatNumber, result.upgradeCostAi) + ' AI',
              },
            ]}
          />
        </div>
      ) : (
        <EmptyMiningResult labels={labels} hasErrors={hasErrors} />
      )}
    </ToolResultCard>
  );
}

function MiningAiResultCard({
  labels,
  result,
  hasErrors,
  formatNumber,
  btcPerAi,
}: {
  labels: MiningToolLabels;
  result: AiCraftResult | undefined;
  hasErrors: boolean;
  formatNumber: NumberFormatter;
  btcPerAi: number | undefined;
}) {
  const [currency, setCurrency] = useState<MiningCurrency>('AI');
  const profitPerMinute = result
    ? calculateMiningProfitPerMinute(
      result.profitAi,
      aiCraftingUnitMinutes,
      result.groupsPerAction,
    )
    : null;
  const displayProfitPerMinute = convertMiningProfit(profitPerMinute, 'AI', currency, btcPerAi);
  const perMinuteUnit = currency === 'BTC' ? labels.btcPerMinuteUnit : labels.aiPerMinuteUnit;

  return (
    <ToolResultCard
      titleId="mining-ai-result-title"
      title={labels.aiTitle}
      titleClassName="site-tool-section-heading"
      className="h-full"
      validation={
        hasErrors ? (
          <ToolValidationSummary>{labels.validationSummary}</ToolValidationSummary>
        ) : undefined
      }
    >
      {result ? (
        <div className="space-y-6">
          <MiningNetProfitSummary
            labels={labels}
            sectionTitle={labels.aiTitle}
            cardId="ai"
            currentLevel={formatTemplate(labels.currentLevel, { level: result.miningLevel })}
            profit={result.profitAi}
            baseCurrency="AI"
            currency={currency}
            onToggleCurrency={() => setCurrency((current) => current === 'BTC' ? 'AI' : 'BTC')}
            btcPerAi={btcPerAi}
            formatNumber={formatNumber}
          />
          <ToolBreakdown
            title={labels.breakdown}
            titleId="mining-ai-breakdown-title"
            layout="rows"
            items={[
              {
                id: 'ai-output',
                label: labels.aiOutput,
                value: formatNumber(result.aiPerAction) + ' ' + labels.aiUnit,
              },
              {
                id: 'per-minute',
                label: labels.perMinute,
                value: displayProfitPerMinute === null
                  ? labels.notAvailable
                  : (
                    <span data-testid="mining-per-minute-value-ai">
                      {formatAmount(formatNumber, displayProfitPerMinute)} {perMinuteUnit}
                    </span>
                  ),
              },
              {
                id: 'roi',
                label: labels.roi,
                value: result.roiPercent === null
                  ? labels.costZero
                  : formatAmount(formatNumber, result.roiPercent) + '%',
              },
              {
                id: 'break-even',
                label: labels.breakEven,
                value: formatBreakEven(result, labels),
              },
              {
                id: 'required-hash',
                label: labels.requiredHash,
                value: result.neededHashToProfit === null
                  ? labels.notAvailable
                  : formatNumber(result.neededHashToProfit),
              },
              {
                id: 'upgrade-cost-ai',
                label: labels.upgradeCostAi,
                value: result.upgradeCostAi === null
                  ? labels.notAvailable
                  : formatAmount(formatNumber, result.upgradeCostAi) + ' AI',
              },
            ]}
          />
        </div>
      ) : (
        <EmptyMiningResult labels={labels} hasErrors={hasErrors} />
      )}
    </ToolResultCard>
  );
}

export function MiningCalculator({
  labels,
  locale,
  numberFormatter,
}: {
  labels: MiningToolLabels;
  locale: Locale;
  numberFormatter?: NumberFormatter;
}) {
  const { errors, inputs, result, fillPlayer, reset } = useMiningTool();
  const hasErrors = Object.keys(errors).length > 0;
  const formatNumber = useMemo(
    () => numberFormatter ?? createNumberFormatter(locale),
    [locale, numberFormatter],
  );

  return (
    <div className="not-prose my-8 space-y-6" data-tool="mining">
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
            <div className="grid gap-5 @min-[24rem]:grid-cols-2 @min-[72rem]:grid-cols-4">
              <MiningLevelField labels={labels} />
              <MiningSharedPriceField labels={labels} locale={locale} />
              <MiningSharedExchangeRateField locale={locale} />
            </div>
          </div>
          <div>
            <h3 className="mb-4 text-sm font-medium text-foreground">{labels.buffs}</h3>
            <div className="@container">
              <div className="grid gap-5 @min-[24rem]:grid-cols-2">
                <MiningSettingField
                  field="tradeExploitPercent"
                  id="mining-trade-exploit"
                  label={labels.tradeExploit}
                  unit={labels.percentUnit}
                  labels={labels}
                />
                <MiningSettingField
                  field="cortexBonusPercent"
                  id="mining-cortex-bonus"
                  label={labels.cortexBonus}
                  unit={labels.percentUnit}
                  labels={labels}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="@container">
        <div className="grid gap-6 @min-[48rem]:grid-cols-2 @min-[48rem]:items-stretch">
          <MiningBtcResultCard
            labels={labels}
            result={result?.btc}
            hasErrors={hasErrors}
            formatNumber={formatNumber}
            btcPerAi={inputs?.btcPerAi}
          />
          <MiningAiResultCard
            labels={labels}
            result={result?.aiCraft}
            hasErrors={hasErrors}
            formatNumber={formatNumber}
            btcPerAi={inputs?.btcPerAi}
          />
        </div>
      </div>
    </div>
  );
}

export function MiningToolPage({
  toc,
  full,
  contextLabel,
  contextPanelLabel,
  contextCloseLabel,
  header,
  headerActions,
  children,
}: Omit<ContextualDocsPageProps, 'contextItems' | 'defaultContextId' | 'mobileContext' | 'children'> & {
  labels: MiningToolLabels;
  header: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <MiningToolProvider>
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
    </MiningToolProvider>
  );
}
