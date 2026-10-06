'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ContextSheet, type ContextualDocsPageProps } from '@/components/context';
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
import { earningsActivityCatalog } from '@/data/game/earnings-activities';
import { getProgressionLevelDefinition } from '@/data/game/progression';
import {
  calculateEarnings,
  EARNINGS_COMPARISON_MODES,
  EARNINGS_LEVEL_MAX,
  EARNINGS_LEVEL_MIN,
  EARNINGS_TIME_REDUCTION_PERCENT,
  type EarningsCalculation,
  type EarningsActivityResult,
  type EarningsComparisonMode,
  type EarningsInputs,
  type EarningsInputError,
} from '@/lib/earnings-calculator';
import {
  calculateManualMixedCrushing,
  calculateRecommendedMixedCrushing,
  getMixedCrushingComparisonValue,
  mixedCrushingUnitSeconds,
  type MixedCrushingResult,
} from '@/lib/mixed-crushing-calculator';
import {
  defaultMixedCrushingCounts,
  getMixedCrushingBaseSeconds,
  getMixedCrushingBaseTimeBudget,
  getMixedCrushingDynamicMax,
  mixedCrushingModeSchema,
  mixedCrushingTypeKeys,
  parseMixedCrushingCountInputs,
  validateMixedCrushingCounts,
  type MixedCrushingCountInputs,
  type MixedCrushingCounts,
  type MixedCrushingMode,
  type MixedCrushingTypeKey,
} from '@/lib/mixed-crushing-schema';
import {
  BUFF_PERCENT_DEFAULT_STRING,
  normalizeLegacyBuffPercentString,
  parseBuffPercent,
} from '@/lib/buff-percent';
import { resolveMarketPrices, type ResolvedMarketPrices } from '@/lib/market-prices';
import type { Locale } from '@/lib/i18n';
import { createNumberFormatter, type NumberFormatter } from '@/lib/number-formatting';
import {
  clearToolState,
  defaultSharedUserInputs,
  type SharedUserInputs,
} from '@/lib/storage';
import { useToolStateStorage } from '@/lib/storage/use-tool-state';

import { EarningsTrendChart } from './earnings-chart';
import {
  formatMixedCrushingMessage,
  mixedCrushingUiLabels,
} from './mixed-crushing-labels';
import { updateSharedEquipmentNumber } from './shared-input-updates';
import { getSharedFieldPresentation } from './shared-field-presentation';

export interface EarningsOverviewToolLabels {
  readonly primaryInputs: string;
  readonly comparisonMode: string;
  readonly perMinuteOption: string;
  readonly elapsed15Option: string;
  readonly elapsed30Option: string;
  readonly elapsed45Option: string;
  readonly elapsed60Option: string;
  readonly elapsed105Option: string;
  readonly searchLevel: string;
  readonly printingLevel: string;
  readonly miningLevel: string;
  readonly btcBuffPercent: string;
  readonly levelPlaceholder: string;
  readonly levelRange: string;
  readonly levelUnit: string;
  readonly buffRange: string;
  readonly percentUnit: string;
  readonly fillPlayer: string;
  readonly reset: string;
  readonly validationSummary: string;
  readonly validationLevel: string;
  readonly validationBuff: string;
  readonly validationComparisonMode: string;
  readonly noResult: string;
  readonly noResultHint: string;
  readonly results: string;
  readonly timeAssumption: string;
  readonly activity: string;
  readonly batch: string;
  readonly time: string;
  readonly batchNet: string;
  readonly perMinute: string;
  readonly elapsedCount: string;
  readonly actualTime: string;
  readonly elapsedNet: string;
  readonly timeUtilization: string;
  readonly batchUnit: string;
  readonly minutesUnit: string;
  readonly aiUnit: string;
  readonly notAvailable: string;
  readonly trendTitle: string;
  readonly trendDescription: string;
  readonly trendGroup: string;
  readonly trendGroupHint: string;
  readonly trendGroupVariable: string;
  readonly trendGroupFixed: string;
  readonly trendLegend: string;
  readonly trendLegendVisible: string;
  readonly trendLegendHidden: string;
  readonly trendLegendReference: string;
  readonly trendLegendReset: string;
  readonly trendInteractionHint: string;
  readonly trendFixedHint: string;
  readonly trendAxisLevel: string;
  readonly trendAxisPerMinute: string;
  readonly trendAxisElapsed: string;
  readonly trendScaleCompressed: string;
  readonly trendSelectedLevel: string;
}

export interface EarningsOverviewFormValues {
  readonly searchLevel: string;
  readonly printingLevel: string;
  readonly miningLevel: string;
  readonly bargainPercent: string;
  readonly btcBuffPercent: string;
  readonly comparisonMode?: EarningsComparisonMode;
}

export type EarningsOverviewToolState = Omit<EarningsOverviewFormValues, 'bargainPercent'> & {
  readonly comparisonMode: EarningsComparisonMode;
  readonly mixedCrushingMode: MixedCrushingMode;
  readonly mixedMedicalCount: string;
  readonly mixedAmmunitionCount: string;
  readonly mixedMilitaryCount: string;
};
export type EarningsOverviewField = Exclude<keyof EarningsOverviewFormValues, 'bargainPercent'>;
type EarningsOverviewErrorField = keyof EarningsOverviewFormValues;
export type EarningsOverviewErrors = Partial<
  Record<EarningsOverviewErrorField, EarningsInputError | 'comparison-mode'>
>;
export type EarningsOverviewSharedValues = Pick<
  EarningsOverviewFormValues,
  'searchLevel' | 'printingLevel' | 'miningLevel' | 'bargainPercent'
>;
export type EarningsOverviewCalculationValues = EarningsOverviewToolState &
  Pick<EarningsOverviewFormValues, 'bargainPercent'>;

const defaultEarningsOverviewToolState: EarningsOverviewToolState = {
  searchLevel: String(EARNINGS_LEVEL_MIN),
  printingLevel: String(EARNINGS_LEVEL_MIN),
  miningLevel: String(EARNINGS_LEVEL_MIN),
  btcBuffPercent: BUFF_PERCENT_DEFAULT_STRING,
  comparisonMode: 'per-minute',
  mixedCrushingMode: 'recommended',
  mixedMedicalCount: String(defaultMixedCrushingCounts.medical),
  mixedAmmunitionCount: String(defaultMixedCrushingCounts.ammunition),
  mixedMilitaryCount: String(defaultMixedCrushingCounts.military),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const legacyEarningsOverviewFields = [
  'searchLevel',
  'printingLevel',
  'miningLevel',
  'bargainPercent',
  'btcBuffPercent',
] as const;
const legacyEarningsOverviewFieldsWithoutBuff = [
  'searchLevel',
  'printingLevel',
  'miningLevel',
  'bargainPercent',
] as const;
const currentEarningsOverviewFields = [
  'searchLevel',
  'printingLevel',
  'miningLevel',
  'btcBuffPercent',
] as const;
const currentEarningsOverviewFieldsWithoutBuff = [
  'searchLevel',
  'printingLevel',
  'miningLevel',
] as const;
const earningsOverviewStateFields = [
  ...legacyEarningsOverviewFields,
  'comparisonMode',
] as const;
const earningsOverviewStateFieldsWithoutBuff = [
  ...legacyEarningsOverviewFieldsWithoutBuff,
  'comparisonMode',
] as const;
const currentEarningsOverviewStateFields = [
  ...currentEarningsOverviewFields,
  'comparisonMode',
] as const;
const currentEarningsOverviewStateFieldsWithoutBuff = [
  ...currentEarningsOverviewFieldsWithoutBuff,
  'comparisonMode',
] as const;
const legacyEarningsOverviewStateFieldsWithMixedCrushing = [
  ...earningsOverviewStateFields,
  'mixedCrushingMode',
  'mixedMedicalCount',
  'mixedAmmunitionCount',
  'mixedMilitaryCount',
] as const;
const legacyEarningsOverviewStateFieldsWithoutBuffWithMixedCrushing = [
  ...earningsOverviewStateFieldsWithoutBuff,
  'mixedCrushingMode',
  'mixedMedicalCount',
  'mixedAmmunitionCount',
  'mixedMilitaryCount',
] as const;
const earningsOverviewStateFieldsWithMixedCrushing = [
  ...currentEarningsOverviewStateFields,
  'mixedCrushingMode',
  'mixedMedicalCount',
  'mixedAmmunitionCount',
  'mixedMilitaryCount',
] as const;
const earningsOverviewStateFieldsWithoutBuffWithMixedCrushing = [
  ...currentEarningsOverviewStateFieldsWithoutBuff,
  'mixedCrushingMode',
  'mixedMedicalCount',
  'mixedAmmunitionCount',
  'mixedMilitaryCount',
] as const;

function getStoredMixedCrushingCountInputs(
  value: Record<string, unknown>,
): MixedCrushingCountInputs | null {
  const parsed = parseMixedCrushingCountInputs({
    medical: value.mixedMedicalCount,
    ammunition: value.mixedAmmunitionCount,
    military: value.mixedMilitaryCount,
  });
  return parsed === null
    ? null
    : {
        medical: String(parsed.medical),
        ammunition: String(parsed.ammunition),
        military: String(parsed.military),
      };
}

function withMixedCrushingDefaults(
  value: Record<string, string>,
  comparisonMode: EarningsComparisonMode,
): EarningsOverviewToolState {
  const storedCounts = getStoredMixedCrushingCountInputs(value);
  const mixedCrushingMode = mixedCrushingModeSchema.safeParse(value.mixedCrushingMode);
  return {
    searchLevel: value.searchLevel,
    printingLevel: value.printingLevel,
    miningLevel: value.miningLevel,
    btcBuffPercent: normalizeLegacyBuffPercentString(value.btcBuffPercent)
      ?? defaultEarningsOverviewToolState.btcBuffPercent,
    comparisonMode,
    mixedCrushingMode: mixedCrushingMode.success
      ? mixedCrushingMode.data
      : defaultEarningsOverviewToolState.mixedCrushingMode,
    mixedMedicalCount: storedCounts?.medical
      ?? defaultEarningsOverviewToolState.mixedMedicalCount,
    mixedAmmunitionCount: storedCounts?.ammunition
      ?? defaultEarningsOverviewToolState.mixedAmmunitionCount,
    mixedMilitaryCount: storedCounts?.military
      ?? defaultEarningsOverviewToolState.mixedMilitaryCount,
  };
}

function hasStringFields(
  value: Record<string, unknown>,
  fields: readonly string[],
): value is Record<string, string> {
  return Object.keys(value).length === fields.length
    && fields.every((field) => typeof value[field] === 'string');
}

function isEarningsComparisonMode(value: string): value is EarningsComparisonMode {
  return EARNINGS_COMPARISON_MODES.some((mode) => mode === value);
}

function getElapsedMinutesForComparisonMode(mode: EarningsComparisonMode): number | null {
  return mode === 'per-minute' ? null : Number(mode.slice('elapsed-'.length));
}

/**
 * 舊版狀態沒有比較方式；載入時補上預設值，避免被視為無效而清除。
 */
export function normalizeEarningsOverviewToolState(
  value: unknown,
): EarningsOverviewToolState | undefined {
  if (!isRecord(value)) return undefined;

  const btcBuffPercent = Object.prototype.hasOwnProperty.call(value, 'btcBuffPercent')
    ? normalizeLegacyBuffPercentString(value.btcBuffPercent)
    : BUFF_PERCENT_DEFAULT_STRING;
  if (btcBuffPercent === undefined) return undefined;

  if (hasStringFields(value, legacyEarningsOverviewFields)) {
    return withMixedCrushingDefaults(value, 'per-minute');
  }

  if (hasStringFields(value, legacyEarningsOverviewFieldsWithoutBuff)) {
    return withMixedCrushingDefaults({ ...value, btcBuffPercent }, 'per-minute');
  }

  if (hasStringFields(value, currentEarningsOverviewFields)) {
    return withMixedCrushingDefaults(value, 'per-minute');
  }

  if (hasStringFields(value, currentEarningsOverviewFieldsWithoutBuff)) {
    return withMixedCrushingDefaults({ ...value, btcBuffPercent }, 'per-minute');
  }

  if (hasStringFields(value, earningsOverviewStateFields)) {
    if (!isEarningsComparisonMode(value.comparisonMode)) return undefined;
    return withMixedCrushingDefaults(value, value.comparisonMode);
  }

  if (hasStringFields(value, legacyEarningsOverviewStateFieldsWithMixedCrushing)) {
    if (!isEarningsComparisonMode(value.comparisonMode)) return undefined;
    return withMixedCrushingDefaults(value, value.comparisonMode);
  }

  if (hasStringFields(value, legacyEarningsOverviewStateFieldsWithoutBuffWithMixedCrushing)) {
    if (!isEarningsComparisonMode(value.comparisonMode)) return undefined;
    return withMixedCrushingDefaults(
      { ...value, btcBuffPercent },
      value.comparisonMode,
    );
  }

  if (hasStringFields(value, earningsOverviewStateFieldsWithMixedCrushing)) {
    if (!isEarningsComparisonMode(value.comparisonMode)) return undefined;
    return withMixedCrushingDefaults(value, value.comparisonMode);
  }

  if (hasStringFields(value, earningsOverviewStateFieldsWithoutBuffWithMixedCrushing)) {
    if (!isEarningsComparisonMode(value.comparisonMode)) return undefined;
    return withMixedCrushingDefaults({ ...value, btcBuffPercent }, value.comparisonMode);
  }

  if (hasStringFields(value, currentEarningsOverviewStateFields)) {
    if (!isEarningsComparisonMode(value.comparisonMode)) return undefined;
    return withMixedCrushingDefaults(value, value.comparisonMode);
  }

  if (hasStringFields(value, currentEarningsOverviewStateFieldsWithoutBuff)) {
    if (!isEarningsComparisonMode(value.comparisonMode)) return undefined;
    return withMixedCrushingDefaults({ ...value, btcBuffPercent }, value.comparisonMode);
  }

  if (!hasStringFields(value, earningsOverviewStateFieldsWithoutBuff)) return undefined;
  if (!isEarningsComparisonMode(value.comparisonMode)) return undefined;

  return withMixedCrushingDefaults({ ...value, btcBuffPercent }, value.comparisonMode);
}

function isEarningsOverviewToolState(value: unknown): value is EarningsOverviewToolState {
  if (!isRecord(value) || !hasStringFields(value, earningsOverviewStateFieldsWithMixedCrushing)) {
    return false;
  }
  return isEarningsComparisonMode(value.comparisonMode)
    && mixedCrushingModeSchema.safeParse(value.mixedCrushingMode).success
    && getStoredMixedCrushingCountInputs(value) !== null;
}

function parseInteger(value: string, min: number, max: number): number | null {
  const normalized = value.trim();
  if (!normalized || !/^\d+$/.test(normalized)) return null;

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return null;

  return parsed;
}

export function selectEarningsOverviewSharedValues(
  snapshot: SharedUserInputs,
): EarningsOverviewSharedValues {
  const getSkillLevel = (id: 'printing-rank' | 'mining-skill') => {
    const stored = snapshot.progression.skills.find((skill) => skill.id === id);
    return String(stored?.level ?? getProgressionLevelDefinition(id).defaultValue);
  };
  return {
    searchLevel: String(snapshot.progression.player.level),
    printingLevel: getSkillLevel('printing-rank'),
    miningLevel: getSkillLevel('mining-skill'),
    bargainPercent: String(snapshot.equipment.bargainPercent ?? 0),
  };
}

/** 將玩家等級帶入目前試算；不覆寫共享裝備值或工具 BUFF。 */
export function applyEarningsOverviewPlayerValues(
  current: EarningsOverviewToolState,
  shared: EarningsOverviewSharedValues,
): EarningsOverviewToolState {
  return {
    ...current,
    searchLevel: shared.searchLevel,
    printingLevel: shared.printingLevel,
    miningLevel: shared.miningLevel,
  };
}

export function createEarningsOverviewValues(
  toolState: EarningsOverviewToolState,
  shared: EarningsOverviewSharedValues,
): EarningsOverviewCalculationValues {
  return { ...toolState, bargainPercent: shared.bargainPercent };
}

export function parseEarningsOverviewValues(values: EarningsOverviewFormValues): {
  readonly errors: EarningsOverviewErrors;
  readonly inputs: EarningsInputs | null;
  readonly comparisonMode: EarningsComparisonMode | null;
} {
  const searchLevel = parseInteger(
    values.searchLevel,
    EARNINGS_LEVEL_MIN,
    EARNINGS_LEVEL_MAX,
  );
  const printingLevel = parseInteger(
    values.printingLevel,
    EARNINGS_LEVEL_MIN,
    EARNINGS_LEVEL_MAX,
  );
  const miningLevel = parseInteger(
    values.miningLevel,
    EARNINGS_LEVEL_MIN,
    EARNINGS_LEVEL_MAX,
  );
  const bargainPercent = parseInteger(values.bargainPercent, 0, 40);
  const btcBuffPercent = parseBuffPercent(values.btcBuffPercent);
  const comparisonMode = values.comparisonMode ?? 'per-minute';
  const errors: EarningsOverviewErrors = {};

  if (searchLevel === null) errors.searchLevel = 'search-level';
  if (printingLevel === null) errors.printingLevel = 'printing-level';
  if (miningLevel === null) errors.miningLevel = 'mining-level';
  if (bargainPercent === null) errors.bargainPercent = 'bargain';
  if (btcBuffPercent === null) errors.btcBuffPercent = 'btc-buff';
  if (!EARNINGS_COMPARISON_MODES.includes(comparisonMode as EarningsComparisonMode)) {
    errors.comparisonMode = 'comparison-mode';
  }

  if (Object.keys(errors).length > 0) return { errors, inputs: null, comparisonMode: null };

  return {
    errors,
    comparisonMode: comparisonMode as EarningsComparisonMode,
    inputs: {
      searchLevel: searchLevel as number,
      printingLevel: printingLevel as number,
      miningLevel: miningLevel as number,
      bargainPercent: bargainPercent as number,
      btcBuffPercent: btcBuffPercent as number,
    },
  };
}

export function calculateEarningsOverviewTool(
  values: EarningsOverviewFormValues,
  snapshot: SharedUserInputs = defaultSharedUserInputs,
): {
  readonly errors: EarningsOverviewErrors;
  readonly inputs: EarningsInputs | null;
  readonly result: EarningsCalculation | null;
} {
  const parsed = parseEarningsOverviewValues(values);
  return {
    errors: parsed.errors,
    inputs: parsed.inputs,
    result: parsed.inputs && parsed.comparisonMode
      ? calculateEarnings(
        parsed.inputs,
        resolveMarketPrices(snapshot),
        { comparisonMode: parsed.comparisonMode },
      )
      : null,
  };
}

interface EarningsOverviewContextValue {
  readonly values: EarningsOverviewCalculationValues;
  readonly errors: EarningsOverviewErrors;
  readonly inputs: EarningsInputs | null;
  readonly result: EarningsCalculation | null;
  readonly mixedCrushingResult: MixedCrushingResult | null;
  readonly mixedCrushingIssue: 'count' | 'time' | null;
  readonly mixedCrushingCounts: MixedCrushingCounts;
  readonly mixedCrushingBaseTimeBudgetSeconds: number;
  readonly prices: ResolvedMarketPrices;
  readonly setValue: (field: EarningsOverviewField, value: string) => void;
  readonly setMixedCrushingCounts: (counts: MixedCrushingCounts) => void;
  readonly setMixedCrushingMode: (mode: MixedCrushingMode) => void;
  readonly fillPlayer: () => void;
  readonly reset: () => void;
}

const EarningsOverviewToolContext = createContext<EarningsOverviewContextValue | null>(null);

function useEarningsOverviewTool() {
  const context = useContext(EarningsOverviewToolContext);
  if (!context) {
    throw new Error('EarningsOverview 元件必須放在 EarningsOverviewToolProvider 內。');
  }

  return context;
}

export function EarningsOverviewToolProvider({ children }: { children: ReactNode }) {
  const sharedSnapshot = useSharedUserInputs();
  const sharedStore = useSharedUserInputsStore();
  const prices = useMemo(() => resolveMarketPrices(sharedSnapshot), [sharedSnapshot]);
  const [values, setValues] = useToolStateStorage<EarningsOverviewToolState>(
    'earnings-overview',
    defaultEarningsOverviewToolState,
    {
      validate: isEarningsOverviewToolState,
      normalize: normalizeEarningsOverviewToolState,
      initialize: () => {
        const player = selectEarningsOverviewSharedValues(sharedStore.getSnapshot());
        return {
          ...defaultEarningsOverviewToolState,
          searchLevel: player.searchLevel,
          printingLevel: player.printingLevel,
          miningLevel: player.miningLevel,
        };
      },
    },
  );

  const setValue = useCallback(
    (field: EarningsOverviewField, value: string) => {
      setValues((current) => {
        if (field === 'comparisonMode') {
          if (!isEarningsComparisonMode(value) || current.comparisonMode === value) {
            return current;
          }
          return {
            ...current,
            comparisonMode: value,
            mixedCrushingMode: 'recommended',
            mixedMedicalCount: defaultEarningsOverviewToolState.mixedMedicalCount,
            mixedAmmunitionCount: defaultEarningsOverviewToolState.mixedAmmunitionCount,
            mixedMilitaryCount: defaultEarningsOverviewToolState.mixedMilitaryCount,
          };
        }
        return { ...current, [field]: value };
      });
    },
    [setValues],
  );

  const mixedCrushingCounts = useMemo(() => parseMixedCrushingCountInputs({
    medical: values.mixedMedicalCount,
    ammunition: values.mixedAmmunitionCount,
    military: values.mixedMilitaryCount,
  }) ?? { ...defaultMixedCrushingCounts }, [values]);

  const mixedCrushingBaseTimeBudgetSeconds = getMixedCrushingBaseTimeBudget(
    getElapsedMinutesForComparisonMode(values.comparisonMode),
    EARNINGS_TIME_REDUCTION_PERCENT,
  );
  const mixedCrushingIssue = values.mixedCrushingMode === 'manual'
    ? validateMixedCrushingCounts(
        mixedCrushingCounts,
        mixedCrushingBaseTimeBudgetSeconds,
        mixedCrushingUnitSeconds,
      )
    : null;

  const setMixedCrushingCounts = useCallback((counts: MixedCrushingCounts) => {
    setValues((current) => ({
      ...current,
      mixedCrushingMode: 'manual',
      mixedMedicalCount: String(counts.medical),
      mixedAmmunitionCount: String(counts.ammunition),
      mixedMilitaryCount: String(counts.military),
    }));
  }, [setValues]);

  const setMixedCrushingMode = useCallback((mode: MixedCrushingMode) => {
    setValues((current) => ({ ...current, mixedCrushingMode: mode }));
  }, [setValues]);

  const fillPlayer = useCallback(() => {
    setValues((current) => applyEarningsOverviewPlayerValues(
      current,
      selectEarningsOverviewSharedValues(sharedStore.getSnapshot()),
    ));
  }, [setValues, sharedStore]);

  const reset = useCallback(() => {
    clearToolState('earnings-overview');
    const player = selectEarningsOverviewSharedValues(sharedStore.getSnapshot());
    setValues({
      ...defaultEarningsOverviewToolState,
      searchLevel: player.searchLevel,
      printingLevel: player.printingLevel,
      miningLevel: player.miningLevel,
    });
  }, [setValues, sharedStore]);

  const calculationValues = useMemo(
    () => createEarningsOverviewValues(
      values,
      selectEarningsOverviewSharedValues(sharedSnapshot),
    ),
    [sharedSnapshot, values],
  );

  const calculation = useMemo(
    () => calculateEarningsOverviewTool(calculationValues, sharedSnapshot),
    [calculationValues, sharedSnapshot],
  );
  const mixedCrushingResult = useMemo(() => {
    if (!calculation.result || mixedCrushingIssue !== null) return null;
    return values.mixedCrushingMode === 'manual'
      ? calculateManualMixedCrushing(calculation.result, mixedCrushingCounts)
      : calculateRecommendedMixedCrushing(calculation.result);
  }, [calculation.result, mixedCrushingCounts, mixedCrushingIssue, values.mixedCrushingMode]);
  const contextValue = useMemo(
    () => ({
      values: calculationValues,
      errors: calculation.errors,
      inputs: calculation.inputs,
      result: calculation.result,
      mixedCrushingResult,
      mixedCrushingIssue,
      mixedCrushingCounts,
      mixedCrushingBaseTimeBudgetSeconds,
      prices,
      setValue,
      setMixedCrushingCounts,
      setMixedCrushingMode,
      fillPlayer,
      reset,
    }),
    [
      calculation,
      calculationValues,
      fillPlayer,
      mixedCrushingBaseTimeBudgetSeconds,
      mixedCrushingCounts,
      mixedCrushingIssue,
      mixedCrushingResult,
      prices,
      reset,
      setMixedCrushingCounts,
      setMixedCrushingMode,
      setValue,
    ],
  );

  return (
    <EarningsOverviewToolContext.Provider value={contextValue}>
      {children}
    </EarningsOverviewToolContext.Provider>
  );
}

function getErrorMessage(
  field: EarningsOverviewField,
  errors: EarningsOverviewErrors,
  labels: EarningsOverviewToolLabels,
) {
  const error = errors[field];
  if (
    error === 'search-level'
    || error === 'printing-level'
    || error === 'mining-level'
  ) return labels.validationLevel;
  if (error === 'btc-buff') return labels.validationBuff;
  if (error === 'comparison-mode') return labels.validationComparisonMode;
  return undefined;
}

function EarningsOverviewComparisonField({
  labels,
  onComparisonModeChange,
}: {
  readonly labels: EarningsOverviewToolLabels;
  readonly onComparisonModeChange: (value: string) => void;
}) {
  const { values } = useEarningsOverviewTool();
  const options = [
    { value: 'per-minute', label: labels.perMinuteOption },
    { value: 'elapsed-15', label: labels.elapsed15Option },
    { value: 'elapsed-30', label: labels.elapsed30Option },
    { value: 'elapsed-45', label: labels.elapsed45Option },
    { value: 'elapsed-60', label: labels.elapsed60Option },
    { value: 'elapsed-105', label: labels.elapsed105Option },
  ] satisfies ReadonlyArray<{ value: EarningsComparisonMode; label: string }>;

  return (
    <div className="space-y-2">
      <label htmlFor="earnings-overview-comparison-mode" className="text-sm font-medium leading-none">
        {labels.comparisonMode}
      </label>
      <select
        id="earnings-overview-comparison-mode"
        value={values.comparisonMode}
        onChange={(event) => onComparisonModeChange(event.target.value)}
        className="flex h-[var(--cco-input-height)] w-full min-w-0 rounded-[var(--cco-input-radius)] border border-input bg-background px-[var(--cco-input-padding-x)] py-[var(--cco-input-padding-y)] text-base outline-none transition-[color,box-shadow] duration-[var(--cco-duration-fast)] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 md:text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function EarningsOverviewInputField({
  field,
  id,
  label,
  labels,
}: {
  readonly field: 'searchLevel' | 'printingLevel' | 'miningLevel' | 'btcBuffPercent';
  readonly id: string;
  readonly label: string;
  readonly labels: EarningsOverviewToolLabels;
}) {
  const { values, errors, setValue } = useEarningsOverviewTool();
  const isLevel = field === 'searchLevel'
    || field === 'printingLevel'
    || field === 'miningLevel';

  if (field === 'btcBuffPercent') {
    return (
      <ToolBuffSliderField
        id={id}
        label={label}
        range={labels.buffRange}
        unit={labels.percentUnit}
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
      min={isLevel ? EARNINGS_LEVEL_MIN : 0}
      max={isLevel ? EARNINGS_LEVEL_MAX : 100}
      step="1"
      value={values[field]}
      placeholder={isLevel ? labels.levelPlaceholder : undefined}
      onChange={(event) => setValue(field, event.target.value)}
      error={getErrorMessage(field, errors, labels)}
      range={isLevel ? labels.levelRange : labels.buffRange}
      unit={isLevel ? labels.levelUnit : labels.percentUnit}
    />
  );
}

function EarningsOverviewBargainField({
  value,
  locale,
}: {
  value: string;
  locale: Locale;
}) {
  const store = useSharedUserInputsStore();
  const sharedFields = getSharedFieldPresentation(locale);

  return (
    <ToolSharedNumberField
      id="earnings-overview-bargain-percent"
      label={sharedFields.bargain.label}
      sharedLabel={sharedFields.sharedLabel}
      value={value}
      min={0}
      max={40}
      integer
      unit={sharedFields.bargain.unit}
      range={sharedFields.bargain.range}
      invalidValueMessage={sharedFields.invalidValueMessage}
      onValueChange={(nextValue) => store.update((current) =>
        updateSharedEquipmentNumber(current, 'bargainPercent', nextValue),
      )}
    />
  );
}

function formatDecimal(formatNumber: NumberFormatter, value: number) {
  return formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMinutes(formatNumber: NumberFormatter, value: number) {
  return formatNumber(value, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatWhole(formatNumber: NumberFormatter, value: number) {
  return formatNumber(value, { maximumFractionDigits: 0 });
}

function MixedCrushingManualControls({
  locale,
  formatNumber,
  counts,
  committedCounts,
  mode,
  issue,
  baseTimeBudgetSeconds,
  onCountChange,
  onUseRecommended,
}: {
  readonly locale: Locale;
  readonly formatNumber: NumberFormatter;
  readonly counts: MixedCrushingCountInputs;
  readonly committedCounts: MixedCrushingCounts;
  readonly mode: MixedCrushingMode;
  readonly issue: 'count' | 'time' | null;
  readonly baseTimeBudgetSeconds: number;
  readonly onCountChange: (counts: MixedCrushingCountInputs) => void;
  readonly onUseRecommended: () => void;
}) {
  const labels = mixedCrushingUiLabels[locale];
  const parsedDraft = parseMixedCrushingCountInputs(counts);
  const dynamicCounts = parsedDraft ?? committedCounts;
  const usedBaseSeconds = parsedDraft
    ? getMixedCrushingBaseSeconds(parsedDraft, mixedCrushingUnitSeconds)
    : getMixedCrushingBaseSeconds(committedCounts, mixedCrushingUnitSeconds);
  const typeLabels: Readonly<Record<MixedCrushingTypeKey, string>> = {
    medical: labels.medical,
    ammunition: labels.ammunition,
    military: labels.military,
  };
  const errorMessage = issue === 'count'
    ? formatMixedCrushingMessage(labels.invalidCount, { max: 1_000 })
    : issue === 'time'
      ? formatMixedCrushingMessage(labels.overBudget, {
          used: usedBaseSeconds ?? '—',
          budget: baseTimeBudgetSeconds,
        })
      : null;

  return (
    <details
      className="rounded-[var(--cco-card-radius)] border border-border bg-card px-4 py-3"
      data-mixed-crushing-controls="true"
      data-mixed-crushing-mode={mode}
    >
      <summary className="cursor-pointer rounded-sm py-1 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
        {labels.manualControls}
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-sm text-muted-foreground">{labels.stateHint}</p>
        {mixedCrushingTypeKeys.map((type) => {
          const inputId = `earnings-overview-mixed-${type}-count`;
          const sliderId = `${inputId}-slider`;
          const dynamicMax = getMixedCrushingDynamicMax(
            dynamicCounts,
            type,
            baseTimeBudgetSeconds,
            mixedCrushingUnitSeconds,
          );
          const rawCount = counts[type];
          const numericCount = /^\d+$/.test(rawCount) ? Number(rawCount) : 0;
          const sliderValue = Math.min(numericCount, dynamicMax);

          return (
            <div key={type} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem] sm:items-end">
              <div className="min-w-0 space-y-2">
                <label htmlFor={inputId} className="text-sm font-medium text-foreground">
                  {typeLabels[type]}
                </label>
                <input
                  id={sliderId}
                  type="range"
                  min={0}
                  max={dynamicMax}
                  step={1}
                  value={sliderValue}
                  aria-label={`${typeLabels[type]} ${labels.count}`}
                  aria-describedby={errorMessage ? 'earnings-overview-mixed-error' : undefined}
                  aria-invalid={issue !== null}
                  data-mixed-crushing-slider={type}
                  onChange={(event) => onCountChange({
                    ...counts,
                    [type]: event.target.value,
                  })}
                  className="h-6 w-full cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor={inputId} className="text-xs text-muted-foreground">
                  {labels.count} · 0–{formatWhole(formatNumber, dynamicMax)}
                </label>
                <input
                  id={inputId}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={dynamicMax}
                  step={1}
                  value={rawCount}
                  aria-describedby={errorMessage ? 'earnings-overview-mixed-error' : undefined}
                  aria-invalid={issue !== null}
                  data-mixed-crushing-number={type}
                  onChange={(event) => onCountChange({
                    ...counts,
                    [type]: event.target.value,
                  })}
                  className="flex h-[var(--cco-input-height)] w-full min-w-0 rounded-[var(--cco-input-radius)] border border-input bg-background px-[var(--cco-input-padding-x)] py-[var(--cco-input-padding-y)] text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 md:text-sm"
                />
              </div>
            </div>
          );
        })}
        {errorMessage ? (
          <p
            id="earnings-overview-mixed-error"
            className="text-sm text-destructive"
            role="alert"
            aria-live="polite"
            data-mixed-crushing-validation={issue}
          >
            {errorMessage}
          </p>
        ) : null}
        {mode !== 'recommended' || issue !== null ? (
          <button
            type="button"
            className="rounded-sm text-sm font-medium text-primary underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            data-mixed-crushing-use-recommended="true"
            onClick={onUseRecommended}
          >
            {labels.useRecommended}
          </button>
        ) : null}
      </div>
    </details>
  );
}

export function EarningsOverviewResultTable({
  labels,
  locale,
  closeLabel,
  result,
  mixedCrushingResult = null,
  formatNumber,
}: {
  readonly labels: EarningsOverviewToolLabels;
  readonly locale: Locale;
  readonly closeLabel: string;
  readonly result: EarningsCalculation;
  readonly mixedCrushingResult?: MixedCrushingResult | null;
  readonly formatNumber: NumberFormatter;
}) {
  const isElapsedMode = result.comparisonMode !== 'per-minute';
  const mixedLabels = mixedCrushingUiLabels[locale];
  const mixedCounts = mixedCrushingResult?.counts ?? null;
  const compositionItems = mixedCounts === null
    ? null
    : [
        {
          type: 'medical',
          label: mixedLabels.medical,
          count: formatWhole(formatNumber, mixedCounts.medical),
        },
        {
          type: 'ammunition',
          label: mixedLabels.ammunition,
          count: formatWhole(formatNumber, mixedCounts.ammunition),
        },
        {
          type: 'military',
          label: mixedLabels.military,
          count: formatWhole(formatNumber, mixedCounts.military),
        },
      ] as const;
  const mixedOutput = mixedCrushingResult === null
    ? labels.notAvailable
    : `${mixedLabels.output}: ${formatNumber(mixedCrushingResult.outputTechScrap, {
        maximumFractionDigits: 1,
      })} ${mixedLabels.itemUnit}`;
  const mixedValue = getMixedCrushingComparisonValue(
    mixedCrushingResult,
    result.comparisonMode,
  );
  const rows: Array<
    | { readonly kind: 'activity'; readonly order: number; readonly value: number | null; readonly activity: EarningsActivityResult }
    | { readonly kind: 'mixed'; readonly order: number; readonly value: number | null }
  > = [
    ...result.activities.map((activity, order) => ({
      kind: 'activity' as const,
      order,
      value: isElapsedMode ? activity.elapsed?.totalNetAi ?? null : activity.aiPerMinute,
      activity,
    })),
    { kind: 'mixed', order: result.activities.length, value: mixedValue },
  ];
  rows.sort((left, right) => {
    if (left.value === null && right.value === null) return left.order - right.order;
    if (left.value === null) return 1;
    if (right.value === null) return -1;
    return right.value - left.value || left.order - right.order;
  });

  return (
      <div
        data-result-layout="table"
        data-comparison-mode={result.comparisonMode}
        data-earnings-overview-table-scroll="true"
        className="overflow-x-auto rounded-[var(--cco-card-radius)] border border-border"
      >
        <table
          data-earnings-overview-table="true"
          className="w-full min-w-[40rem] table-fixed border-collapse text-left text-sm"
        >
        <colgroup>
          <col className="w-[31%]" />
          <col className="w-[14%]" />
          <col className="w-[17%]" />
          <col className="w-[19%]" />
          <col className="w-[19%]" />
        </colgroup>
        <caption className="sr-only">{labels.results}</caption>
        <thead className="bg-muted/40 text-muted-foreground">
          <tr className="border-b border-border">
            <th scope="col" className="px-4 py-3 font-medium">{labels.activity}</th>
            {isElapsedMode ? (
              <>
                <th scope="col" className="px-4 py-3 font-medium">{labels.elapsedCount}</th>
                <th scope="col" className="px-4 py-3 font-medium">{labels.actualTime}</th>
                <th scope="col" className="px-4 py-3 font-medium">{labels.elapsedNet}</th>
                <th scope="col" className="px-4 py-3 font-medium">{labels.timeUtilization}</th>
              </>
            ) : (
              <>
                <th scope="col" className="px-4 py-3 font-medium">{labels.batch}</th>
                <th scope="col" className="px-4 py-3 font-medium">{labels.time}</th>
                <th scope="col" className="px-4 py-3 font-medium">{labels.batchNet}</th>
                <th scope="col" className="px-4 py-3 font-medium">{labels.perMinute}</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            if (row.kind === 'mixed') {
              const displayedNet = mixedCrushingResult?.totalNetAi ?? null;
              const rate = mixedCrushingResult?.aiPerMinute ?? null;
              const isNegativeNet = displayedNet !== null && displayedNet < 0;
              const isNegativeRate = rate !== null && rate < 0;

              return (
                <tr
                  key="crush-mixed"
                  className="border-b border-border last:border-b-0"
                  data-earnings-overview-mixed-crushing="true"
                >
                  <th scope="row" className="px-4 py-3 font-medium text-foreground">
                    <div className="flex flex-col items-start gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                      <span>{mixedLabels.activity}</span>
                      {mixedCrushingResult ? (
                        <ContextSheet
                          side="center"
                          title={mixedLabels.activity}
                          closeLabel={closeLabel}
                          className="h-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-1rem)] max-w-sm sm:h-auto sm:max-h-[min(80dvh,24rem)] sm:w-[min(calc(100vw-2rem),24rem)]"
                          trigger={(
                            <button
                              type="button"
                              data-mixed-crushing-details-trigger="true"
                              className="rounded-sm text-xs font-normal text-muted-foreground underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                            >
                              {mixedCrushingResult.source === 'recommended'
                                ? mixedLabels.recommended
                                : mixedLabels.manual}
                            </button>
                          )}
                        >
                          <dl
                            className="min-w-0 space-y-3"
                            data-mixed-crushing-details-dialog="true"
                          >
                            {compositionItems?.map((item) => (
                              <div
                                key={item.type}
                                className="flex min-w-0 items-start justify-between gap-3"
                                data-mixed-crushing-detail-row={item.type}
                              >
                                <dt className="min-w-0 whitespace-normal text-muted-foreground">
                                  {item.label}
                                </dt>
                                <dd className="shrink-0 whitespace-nowrap font-medium">
                                  {item.count} {mixedLabels.itemUnit}
                                </dd>
                              </div>
                            ))}
                            <div
                              className="flex min-w-0 items-start justify-between gap-3 border-t border-border pt-3"
                              data-mixed-crushing-detail-output="true"
                            >
                              <dt className="min-w-0 whitespace-normal text-muted-foreground">
                                {mixedLabels.output}
                              </dt>
                              <dd className="shrink-0 whitespace-nowrap font-medium">
                                {formatNumber(mixedCrushingResult.outputTechScrap, {
                                  maximumFractionDigits: 1,
                                })} {mixedLabels.itemUnit}
                              </dd>
                            </div>
                          </dl>
                        </ContextSheet>
                      ) : null}
                    </div>
                  {compositionItems ? (
                    <div className="mt-1 hidden flex-wrap gap-x-2 text-xs font-normal leading-5 text-muted-foreground sm:flex">
                      {compositionItems.map((item, index) => (
                        <span key={item.type} className="whitespace-nowrap">
                          {item.label} {item.count} {mixedLabels.itemUnit}
                          {index < compositionItems.length - 1 ? (
                            <span aria-hidden="true"> · </span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="mt-1 hidden text-xs font-normal leading-5 text-muted-foreground sm:block">
                      {labels.notAvailable}
                    </span>
                  )}
                  <span className="hidden text-xs font-normal leading-5 text-muted-foreground sm:block">
                    {mixedOutput}
                  </span>
                    {mixedCrushingResult?.source === 'recommended'
                      && !mixedCrushingResult.isRecommended ? (
                        <span className="block text-xs font-normal leading-5 text-muted-foreground">
                          {mixedLabels.noRecommendation}
                        </span>
                      ) : null}
                  </th>
                  {isElapsedMode ? (
                    <>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {mixedCrushingResult
                          ? `${formatWhole(formatNumber, mixedCrushingResult.totalCount)} ${mixedLabels.timesUnit}`
                          : labels.notAvailable}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {mixedCrushingResult
                          ? `${formatMinutes(formatNumber, mixedCrushingResult.actualSeconds / 60)} ${labels.minutesUnit}`
                          : labels.notAvailable}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3 font-medium ${isNegativeNet
                        ? 'text-destructive'
                        : 'text-foreground'}`}
                      >
                        {displayedNet === null
                          ? labels.notAvailable
                          : `${formatDecimal(formatNumber, displayedNet)} ${labels.aiUnit}`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                        {mixedCrushingResult
                          ? `${formatNumber(mixedCrushingResult.timeUtilizationPercent, {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })} ${labels.percentUnit}`
                          : labels.notAvailable}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {mixedCrushingResult
                          ? `${formatWhole(formatNumber, mixedCrushingResult.totalCount)} ${mixedLabels.timesUnit}`
                          : labels.notAvailable}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {mixedCrushingResult
                          ? `${formatMinutes(formatNumber, mixedCrushingResult.actualSeconds / 60)} ${labels.minutesUnit}`
                          : labels.notAvailable}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3 font-medium ${isNegativeNet
                        ? 'text-destructive'
                        : 'text-foreground'}`}
                      >
                        {displayedNet === null
                          ? labels.notAvailable
                          : `${formatDecimal(formatNumber, displayedNet)} ${labels.aiUnit}`}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3 font-medium ${isNegativeRate
                        ? 'text-destructive'
                        : 'text-foreground'}`}
                      >
                        {rate === null
                          ? labels.notAvailable
                          : `${formatDecimal(formatNumber, rate)} ${labels.aiUnit}`}
                      </td>
                    </>
                  )}
                </tr>
              );
            }

            const activityResult = row.activity;
            const activity = earningsActivityCatalog.find(
              (candidate) => candidate.id === activityResult.id,
            );
            const activityLabel = activity?.labels[locale] ?? activityResult.id;
            const displayedNet = isElapsedMode
              ? activityResult.elapsed?.totalNetAi ?? null
              : activityResult.batchNetAi;
            const netClass = displayedNet !== null && displayedNet < 0
              ? 'text-destructive'
              : 'text-foreground';
            const rateClass = activityResult.aiPerMinute !== null && activityResult.aiPerMinute < 0
              ? 'text-destructive'
              : 'text-foreground';

            return (
              <tr key={activityResult.id} className="border-b border-border last:border-b-0">
                <th scope="row" className="px-4 py-3 font-medium text-foreground">
                  {activityLabel}
                </th>
                {isElapsedMode ? (
                  <>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatWhole(formatNumber, activityResult.elapsed?.count ?? 0)} {labels.batchUnit}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatMinutes(
                        formatNumber,
                        (activityResult.elapsed?.usedSeconds ?? 0) / 60,
                      )} {labels.minutesUnit}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 font-medium ${netClass}`}>
                      {displayedNet === null
                        ? labels.notAvailable
                        : `${formatDecimal(formatNumber, displayedNet)} ${labels.aiUnit}`}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                      {activityResult.elapsed
                        ? `${formatNumber(activityResult.elapsed.timeUtilizationPercent, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })} ${labels.percentUnit}`
                        : labels.notAvailable}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatWhole(formatNumber, activityResult.batchSize)} {labels.batchUnit}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatMinutes(formatNumber, activityResult.effectiveBatchMinutes)} {labels.minutesUnit}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 font-medium ${netClass}`}>
                      {activityResult.batchNetAi === null
                        ? labels.notAvailable
                        : `${formatDecimal(formatNumber, activityResult.batchNetAi)} ${labels.aiUnit}`}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 font-medium ${rateClass}`}>
                      {activityResult.aiPerMinute === null
                        ? labels.notAvailable
                        : `${formatDecimal(formatNumber, activityResult.aiPerMinute)} ${labels.aiUnit}`}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>
  );
}

function EmptyEarningsOverviewResult({
  labels,
  hasErrors,
}: {
  readonly labels: EarningsOverviewToolLabels;
  readonly hasErrors: boolean;
}) {
  return (
    <ToolState
      variant={hasErrors ? 'error' : 'empty'}
      title={hasErrors ? labels.validationSummary : labels.noResult}
      description={!hasErrors ? labels.noResultHint : undefined}
    />
  );
}

export function EarningsOverviewCalculator({
  labels,
  locale,
  closeLabel,
  numberFormatter,
}: {
  readonly labels: EarningsOverviewToolLabels;
  readonly locale: Locale;
  readonly closeLabel: string;
  readonly numberFormatter?: NumberFormatter;
}) {
  const {
    errors,
    inputs,
    prices,
    result,
    values,
    mixedCrushingResult,
    mixedCrushingIssue,
    mixedCrushingCounts,
    mixedCrushingBaseTimeBudgetSeconds,
    setMixedCrushingCounts,
    setMixedCrushingMode,
    setValue,
    fillPlayer,
    reset,
  } = useEarningsOverviewTool();
  const [mixedCrushingDraft, setMixedCrushingDraft] = useState<{
    readonly comparisonMode: EarningsComparisonMode;
    readonly counts: MixedCrushingCountInputs;
  } | null>(null);
  const activeMixedCrushingDraftCounts = mixedCrushingDraft?.comparisonMode
      === values.comparisonMode
    ? mixedCrushingDraft.counts
    : null;
  const formatNumber = useMemo(
    () => numberFormatter ?? createNumberFormatter(locale),
    [locale, numberFormatter],
  );
  const hasErrors = Object.keys(errors).length > 0;
  const storedCountInputs: MixedCrushingCountInputs = {
    medical: values.mixedMedicalCount,
    ammunition: values.mixedAmmunitionCount,
    military: values.mixedMilitaryCount,
  };
  const displayedMixedResult = activeMixedCrushingDraftCounts === null
    ? mixedCrushingResult
    : (() => {
        const counts = parseMixedCrushingCountInputs(activeMixedCrushingDraftCounts);
        const issue = counts === null
          ? 'count'
          : validateMixedCrushingCounts(
              counts,
              mixedCrushingBaseTimeBudgetSeconds,
              mixedCrushingUnitSeconds,
            );
        return issue === null && result && counts
          ? calculateManualMixedCrushing(result, counts)
          : null;
      })();
  const displayedMixedIssue = activeMixedCrushingDraftCounts === null
    ? mixedCrushingIssue
    : (() => {
        const counts = parseMixedCrushingCountInputs(activeMixedCrushingDraftCounts);
        return counts === null
          ? 'count'
          : validateMixedCrushingCounts(
              counts,
              mixedCrushingBaseTimeBudgetSeconds,
              mixedCrushingUnitSeconds,
            );
      })();
  const displayedMixedCounts = activeMixedCrushingDraftCounts
    ?? (values.mixedCrushingMode === 'manual'
      ? storedCountInputs
      : {
          medical: String(mixedCrushingResult?.counts.medical ?? 0),
          ammunition: String(mixedCrushingResult?.counts.ammunition ?? 0),
          military: String(mixedCrushingResult?.counts.military ?? 0),
        });

  const handleMixedCrushingCountChange = (countInputs: MixedCrushingCountInputs) => {
    setMixedCrushingDraft({ comparisonMode: values.comparisonMode, counts: countInputs });
    const counts = parseMixedCrushingCountInputs(countInputs);
    if (
      counts !== null
      && validateMixedCrushingCounts(
        counts,
        mixedCrushingBaseTimeBudgetSeconds,
        mixedCrushingUnitSeconds,
      ) === null
    ) {
      setMixedCrushingCounts(counts);
    }
  };

  const handleUseRecommendedMixedCrushing = () => {
    setMixedCrushingDraft(null);
    setMixedCrushingMode('recommended');
  };

  const handleComparisonModeChange = (mode: string) => {
    if (!isEarningsComparisonMode(mode) || mode === values.comparisonMode) return;
    setMixedCrushingDraft(null);
    setValue('comparisonMode', mode);
  };

  return (
    <div className="not-prose my-8 space-y-6" data-tool="earnings-overview">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="site-tool-section-heading">{labels.primaryInputs}</CardTitle>
            </div>
            <ToolPrimaryActions
              fillPlayer={{ label: labels.fillPlayer, onClick: fillPlayer }}
              onReset={() => {
                setMixedCrushingDraft(null);
                reset();
              }}
              resetLabel={labels.reset}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="@container">
            <div className="grid gap-5 @min-[24rem]:grid-cols-2 @min-[40rem]:grid-cols-3">
              <EarningsOverviewInputField
                field="searchLevel"
                id="earnings-overview-search-level"
                label={labels.searchLevel}
                labels={labels}
              />
              <EarningsOverviewInputField
                field="printingLevel"
                id="earnings-overview-printing-level"
                label={labels.printingLevel}
                labels={labels}
              />
              <EarningsOverviewInputField
                field="miningLevel"
                id="earnings-overview-mining-level"
                label={labels.miningLevel}
                labels={labels}
              />
              <EarningsOverviewBargainField
                value={values.bargainPercent}
                locale={locale}
              />
              <EarningsOverviewInputField
                field="btcBuffPercent"
                id="earnings-overview-btc-buff-percent"
                label={labels.btcBuffPercent}
                labels={labels}
              />
              <EarningsOverviewComparisonField
                labels={labels}
                onComparisonModeChange={handleComparisonModeChange}
              />
            </div>
          </div>
          <p className="border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
            {labels.timeAssumption}
          </p>
        </CardContent>
      </Card>

      <MixedCrushingManualControls
        locale={locale}
        formatNumber={formatNumber}
        counts={displayedMixedCounts}
        committedCounts={mixedCrushingCounts}
        mode={values.mixedCrushingMode}
        issue={displayedMixedIssue}
        baseTimeBudgetSeconds={mixedCrushingBaseTimeBudgetSeconds}
        onCountChange={handleMixedCrushingCountChange}
        onUseRecommended={handleUseRecommendedMixedCrushing}
      />

      <div>
        <div className="mb-4">
          <h2 className="site-tool-section-heading text-xl font-semibold tracking-tight text-foreground">{labels.results}</h2>
        </div>
        {result ? (
          <EarningsOverviewResultTable
            labels={labels}
            locale={locale}
            closeLabel={closeLabel}
            result={result}
            mixedCrushingResult={displayedMixedResult}
            formatNumber={formatNumber}
          />
        ) : (
          <EmptyEarningsOverviewResult labels={labels} hasErrors={hasErrors} />
        )}
      </div>

      {result && inputs ? (
        <EarningsTrendChart
          labels={labels}
          locale={locale}
          inputs={inputs}
          prices={prices}
          comparisonMode={result.comparisonMode}
          mixedCrushingResult={displayedMixedResult}
          numberFormatter={formatNumber}
        />
      ) : null}
    </div>
  );
}

export function EarningsOverviewToolPage({
  toc,
  full,
  contextLabel,
  contextPanelLabel,
  contextCloseLabel,
  header,
  headerActions,
  children,
}: Omit<ContextualDocsPageProps, 'contextItems' | 'defaultContextId' | 'mobileContext' | 'children'> & {
  readonly labels: EarningsOverviewToolLabels;
  readonly locale: Locale;
  readonly header: ReactNode;
  readonly headerActions?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <EarningsOverviewToolProvider>
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
    </EarningsOverviewToolProvider>
  );
}
