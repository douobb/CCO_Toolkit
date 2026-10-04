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
  ToolBreakdown,
  ToolBuffSliderField,
  ToolInputField,
  ToolPage,
  ToolPresetButton,
  ToolResultCard,
  ToolState,
  ToolValidationSummary,
} from '@/components/tools';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { economyDataSet, getMarketPriceDefinition, type MarketPriceItemId } from '@/data/game/economy';
import { getProgressionLevelDefinition } from '@/data/game/progression';
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
  defaultSharedUserInputs,
  type SharedUserInputs,
} from '@/lib/storage';
import { useToolStateStorage } from '@/lib/storage/use-tool-state';

export interface MiningToolLabels {
  readonly settingsTab: string;
  readonly settingsTitle: string;
  readonly openSettings: string;
  readonly closeSettings: string;
  readonly primaryInputs: string;
  readonly miningLevel: string;
  readonly miningLevelPlaceholder: string;
  readonly levelRange: string;
  readonly levelUnit: string;
  readonly prices: string;
  readonly hashPrice: string;
  readonly techScrapPrice: string;
  readonly btcPerAi: string;
  readonly hashPriceUnit: string;
  readonly techScrapPriceUnit: string;
  readonly btcPerAiUnit: string;
  readonly buffs: string;
  readonly cortexBonus: string;
  readonly tradeExploit: string;
  readonly percentUnit: string;
  readonly priceRange: string;
  readonly rateRange: string;
  readonly buffRange: string;
  readonly reset: string;
  readonly fillShared: string;
  readonly validationSummary: string;
  readonly validationLevel: string;
  readonly validationPrice: string;
  readonly validationRate: string;
  readonly validationBuff: string;
  readonly noResult: string;
  readonly noResultHint: string;
  readonly btcTitle: string;
  readonly btcDescription: string;
  readonly aiTitle: string;
  readonly aiDescription: string;
  readonly currentLevel: string;
  readonly netProfit: string;
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

type MiningPriceField = 'aiPerHash' | 'aiPerThousandTechScrap';
type MiningWritableField = MiningPriceField | 'btcPerAi';
type MiningPriceValues = Pick<MiningFormValues, MiningPriceField | 'btcPerAi'>;
export type MiningSharedValues = Omit<
  MiningFormValues,
  'cortexBonusPercent' | 'tradeExploitPercent'
>;

const defaultMiningToolState: MiningToolState = {
  miningLevel: String(MINING_LEVEL_MIN),
  cortexBonusPercent: BUFF_PERCENT_DEFAULT_STRING,
  tradeExploitPercent: BUFF_PERCENT_DEFAULT_STRING,
};

const miningPriceFields = [
  'aiPerHash',
  'btcPerAi',
  'aiPerThousandTechScrap',
] as const satisfies readonly MiningWritableField[];

const miningPriceItems = {
  aiPerHash: 'hash',
  aiPerThousandTechScrap: 'tech-scrap',
} as const satisfies Record<MiningPriceField, MarketPriceItemId>;

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

/** 將共用設定帶入等級／物價欄位；刻意不觸碰工具自己的兩個 Buff。 */
export function applyMiningSharedValues(
  current: MiningToolState,
  shared: MiningSharedValues,
): MiningToolState {
  return { ...current, miningLevel: shared.miningLevel };
}

/**
 * 將挖礦工具中的有效經濟設定回寫 Shared User Inputs。
 * 價格以 catalog 的預設基準貨幣保存；顯示值固定以 AI 供計算與編輯。
 */
export function updateMiningSharedValue(
  snapshot: SharedUserInputs,
  field: MiningWritableField,
  amount: number,
): SharedUserInputs {
  if (!Number.isFinite(amount) || amount < 0 || amount > Number.MAX_SAFE_INTEGER) {
    return snapshot;
  }

  if (field === 'btcPerAi') {
    if (!Number.isSafeInteger(amount) || amount < 1) return snapshot;

    const definition = economyDataSet.payload.exchangeRates.find(
      (rate) => rate.id === 'btc-per-ai',
    );
    if (!definition) return snapshot;

    const ratesWithoutCurrent = snapshot.economy.exchangeRates.filter(
      (rate) => rate.id !== 'btc-per-ai',
    );
    const nextRate = { id: 'btc-per-ai' as const, value: amount };

    return {
      ...snapshot,
      economy: {
        ...snapshot.economy,
        exchangeRates: amount === definition.defaultValue
          ? ratesWithoutCurrent
          : [...ratesWithoutCurrent, nextRate],
      },
    };
  }

  const itemId = miningPriceItems[field];
  const definition = getMarketPriceDefinition(itemId);
  const currentPrices = resolveMarketPrices(snapshot);
  const basisAmount = definition.defaultBasisCurrencyId === 'ai'
    ? amount
    : amount * currentPrices.btcPerAi;

  if (!Number.isFinite(basisAmount) || basisAmount > Number.MAX_SAFE_INTEGER) {
    return snapshot;
  }

  const pricesWithoutCurrent = snapshot.economy.prices.filter(
    (price) => price.itemId !== itemId,
  );
  const nextPrice = {
    itemId,
    currencyId: definition.defaultBasisCurrencyId,
    amount: basisAmount,
  };

  return {
    ...snapshot,
    economy: {
      ...snapshot.economy,
      prices: basisAmount === definition.defaultBasisValue
        ? pricesWithoutCurrent
        : [...pricesWithoutCurrent, nextPrice],
    },
  };
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
  priceDrafts: MiningPriceValues,
): MiningFormValues {
  return {
    miningLevel: toolState.miningLevel,
    aiPerHash: priceDrafts.aiPerHash,
    btcPerAi: priceDrafts.btcPerAi,
    aiPerThousandTechScrap: priceDrafts.aiPerThousandTechScrap,
    cortexBonusPercent: toolState.cortexBonusPercent,
    tradeExploitPercent: toolState.tradeExploitPercent,
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

function parseMiningWritableValue(field: MiningWritableField, value: string): number | null {
  if (field === 'btcPerAi') return parseInteger(value, 1, Number.MAX_SAFE_INTEGER);
  return parseNonNegativeNumber(value);
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
  readonly setValue: (field: MiningField, value: string) => void;
  readonly fillFromShared: () => void;
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
  const [priceDrafts, setPriceDrafts] = useState<MiningPriceValues>(() => {
    const defaults = selectMiningSharedValues(defaultSharedUserInputs);
    return {
      aiPerHash: defaults.aiPerHash,
      btcPerAi: defaults.btcPerAi,
      aiPerThousandTechScrap: defaults.aiPerThousandTechScrap,
    };
  });
  const [dirtyFields, setDirtyFields] = useState<ReadonlySet<MiningWritableField>>(
    () => new Set(),
  );
  const sharedValues = useMemo(
    () => selectMiningSharedValues(sharedSnapshot),
    [sharedSnapshot],
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;

      setPriceDrafts((current) => {
        let next: MiningPriceValues | null = null;

        for (const field of miningPriceFields) {
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
    (field: MiningField, value: string) => {
      if (
        field === 'miningLevel' ||
        field === 'cortexBonusPercent' ||
        field === 'tradeExploitPercent'
      ) {
        setToolState((current) => ({ ...current, [field]: value }));
        return;
      }

      setPriceDrafts((current) => ({ ...current, [field]: value }));
      setDirtyFields((current) => {
        const next = new Set(current);
        next.add(field);
        return next;
      });

      const parsed = parseMiningWritableValue(field, value);
      if (parsed === null) return;

      const accepted = sharedStore.update((current) =>
        updateMiningSharedValue(current, field, parsed),
      );
      if (!accepted) return;

      setDirtyFields((current) => {
        if (!current.has(field)) return current;
        const next = new Set(current);
        next.delete(field);
        return next;
      });
    },
    [setToolState, sharedStore],
  );

  const fillFromShared = useCallback(() => {
    const latestSharedValues = selectMiningSharedValues(sharedStore.getSnapshot());
    setToolState((current) => applyMiningSharedValues(current, latestSharedValues));
    setPriceDrafts({
      aiPerHash: latestSharedValues.aiPerHash,
      btcPerAi: latestSharedValues.btcPerAi,
      aiPerThousandTechScrap: latestSharedValues.aiPerThousandTechScrap,
    });
    setDirtyFields(new Set());
  }, [setToolState, sharedStore]);

  const reset = useCallback(() => {
    clearToolState('mining');
    const latestSharedValues = selectMiningSharedValues(sharedStore.getSnapshot());
    setToolState({
      miningLevel: latestSharedValues.miningLevel,
      cortexBonusPercent: defaultMiningToolState.cortexBonusPercent,
      tradeExploitPercent: defaultMiningToolState.tradeExploitPercent,
    });
    setPriceDrafts({
      aiPerHash: latestSharedValues.aiPerHash,
      btcPerAi: latestSharedValues.btcPerAi,
      aiPerThousandTechScrap: latestSharedValues.aiPerThousandTechScrap,
    });
    setDirtyFields(new Set());
  }, [setToolState, sharedStore]);

  const values = useMemo(
    () => createMiningValues(toolState, priceDrafts),
    [priceDrafts, toolState],
  );
  const calculation = useMemo(() => calculateMiningTool(values), [values]);
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
  if (error === 'price') return labels.validationPrice;
  if (error === 'rate') return labels.validationRate;
  if (error === 'buff') return labels.validationBuff;
  return undefined;
}

function MiningPriceField({
  field,
  id,
  label,
  unit,
  labels,
}: {
  field: MiningPriceField;
  id: string;
  label: string;
  unit: string;
  labels: MiningToolLabels;
}) {
  const { values, errors, setValue } = useMiningTool();

  return (
    <ToolInputField
      id={id}
      label={label}
      type="number"
      inputMode="decimal"
      min="0"
      step="any"
      value={values[field]}
      onChange={(event) => setValue(field, event.target.value)}
      error={getErrorMessage(field, errors, labels)}
      range={labels.priceRange}
      unit={unit}
    />
  );
}

function MiningSettingField({
  field,
  id,
  label,
  unit,
  labels,
}: {
  field: 'btcPerAi' | 'cortexBonusPercent' | 'tradeExploitPercent';
  id: string;
  label: string;
  unit: string;
  labels: MiningToolLabels;
}) {
  const { values, errors, setValue } = useMiningTool();
  const isRate = field === 'btcPerAi';

  if (!isRate) {
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

  return (
    <ToolInputField
      id={id}
      label={label}
      type="number"
      inputMode="numeric"
      min={isRate ? 1 : 0}
      max={isRate ? undefined : 100}
      step="1"
      value={values[field]}
      onChange={(event) => setValue(field, event.target.value)}
      error={getErrorMessage(field, errors, labels)}
      range={isRate ? labels.rateRange : labels.buffRange}
      unit={unit}
    />
  );
}

export function MiningSettingsPanel({
  labels,
  idPrefix = 'mining-settings',
}: {
  labels: MiningToolLabels;
  idPrefix?: string;
}) {
  const { reset } = useMiningTool();

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div>
        <h2 className="font-semibold text-foreground">{labels.settingsTitle}</h2>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">{labels.prices}</h3>
        <MiningPriceField
          field="aiPerThousandTechScrap"
          id={idPrefix + '-tech-scrap-price'}
          label={labels.techScrapPrice}
          unit={labels.techScrapPriceUnit}
          labels={labels}
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">{labels.buffs}</h3>
        <MiningSettingField
          field="cortexBonusPercent"
          id={idPrefix + '-cortex-bonus'}
          label={labels.cortexBonus}
          unit={labels.percentUnit}
          labels={labels}
        />
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
}: {
  labels: MiningToolLabels;
  result: MiningBtcResult | undefined;
  hasErrors: boolean;
  formatNumber: NumberFormatter;
}) {
  return (
    <ToolResultCard
      titleId="mining-btc-result-title"
      title={labels.btcTitle}
      titleClassName="site-tool-section-heading"
      description={labels.btcDescription}
      className="h-full"
      validation={
        hasErrors ? (
          <ToolValidationSummary>{labels.validationSummary}</ToolValidationSummary>
        ) : undefined
      }
    >
      {result ? (
        <div className="space-y-6">
          <div className="rounded-[var(--cco-card-radius)] border border-border bg-muted/40 p-5">
            <p className="text-sm font-medium text-muted-foreground">
              {formatTemplate(labels.currentLevel, { level: result.miningLevel })}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">{labels.netProfit}</p>
            <p
              className={cn(
                'mt-2 text-3xl font-semibold tracking-tight',
                result.profitBtc < 0 ? 'text-destructive' : 'text-foreground',
              )}
            >
              {formatAmount(formatNumber, result.profitBtc)}
              <span className="ml-2 text-sm font-medium text-muted-foreground">
                {labels.btcUnit}
              </span>
            </p>
          </div>
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
}: {
  labels: MiningToolLabels;
  result: AiCraftResult | undefined;
  hasErrors: boolean;
  formatNumber: NumberFormatter;
}) {
  return (
    <ToolResultCard
      titleId="mining-ai-result-title"
      title={labels.aiTitle}
      titleClassName="site-tool-section-heading"
      description={labels.aiDescription}
      className="h-full"
      validation={
        hasErrors ? (
          <ToolValidationSummary>{labels.validationSummary}</ToolValidationSummary>
        ) : undefined
      }
    >
      {result ? (
        <div className="space-y-6">
          <div className="rounded-[var(--cco-card-radius)] border border-border bg-muted/40 p-5">
            <p className="text-sm font-medium text-muted-foreground">
              {formatTemplate(labels.currentLevel, { level: result.miningLevel })}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">{labels.netProfit}</p>
            <p
              className={cn(
                'mt-2 text-3xl font-semibold tracking-tight',
                result.profitAi < 0 ? 'text-destructive' : 'text-foreground',
              )}
            >
              {formatAmount(formatNumber, result.profitAi)}
              <span className="ml-2 text-sm font-medium text-muted-foreground">
                {labels.aiUnit}
              </span>
            </p>
          </div>
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
  const { errors, result, fillFromShared } = useMiningTool();
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
            <ToolPresetButton
              type="button"
              variant="outline"
              onClick={fillFromShared}
              icon={<Download aria-hidden="true" />}
              label={labels.fillShared}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="@container">
            <div className="grid gap-5 @min-[24rem]:grid-cols-2 @min-[72rem]:grid-cols-4">
              <MiningLevelField labels={labels} />
              <MiningPriceField
                field="aiPerHash"
                id="mining-hash-price"
                label={labels.hashPrice}
                unit={labels.hashPriceUnit}
                labels={labels}
              />
              <MiningSettingField
                field="btcPerAi"
                id="mining-btc-per-ai"
                label={labels.btcPerAi}
                unit={labels.btcPerAiUnit}
                labels={labels}
              />
              <MiningSettingField
                field="tradeExploitPercent"
                id="mining-trade-exploit"
                label={labels.tradeExploit}
                unit={labels.percentUnit}
                labels={labels}
              />
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
          />
          <MiningAiResultCard
            labels={labels}
            result={result?.aiCraft}
            hasErrors={hasErrors}
            formatNumber={formatNumber}
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
  labels,
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
        settings={{
          id: 'settings',
          label: labels.settingsTab,
          title: labels.settingsTitle,
          openLabel: labels.openSettings,
          closeLabel: labels.closeSettings,
          idPrefix: 'mining-settings',
          render: ({ idPrefix }) => (
            <MiningSettingsPanel labels={labels} idPrefix={idPrefix} />
          ),
        }}
      >
        {children}
      </ToolPage>
    </MiningToolProvider>
  );
}
