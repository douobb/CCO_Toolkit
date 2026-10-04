'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { Download } from 'lucide-react';

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
import { earningsActivityCatalog } from '@/data/game/earnings-activities';
import { getProgressionLevelDefinition } from '@/data/game/progression';
import {
  calculateEarnings,
  EARNINGS_COMPARISON_MODES,
  EARNINGS_LEVEL_MAX,
  EARNINGS_LEVEL_MIN,
  type EarningsCalculation,
  type EarningsComparisonMode,
  type EarningsInputs,
  type EarningsInputError,
} from '@/lib/earnings-calculator';
import {
  BUFF_PERCENT_DEFAULT_STRING,
  normalizeLegacyBuffPercentString,
  parseBuffPercent,
} from '@/lib/buff-percent';
import { resolveMarketPrices, type ResolvedMarketPrices } from '@/lib/market-prices';
import type { Locale } from '@/lib/i18n';
import { createNumberFormatter, type NumberFormatter } from '@/lib/number-formatting';
import {
  defaultSharedUserInputs,
  type SharedUserInputs,
} from '@/lib/storage';
import { useToolStateStorage } from '@/lib/storage/use-tool-state';

import { EarningsTrendChart } from './earnings-chart';

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
  readonly bargainPercent: string;
  readonly btcBuffPercent: string;
  readonly levelPlaceholder: string;
  readonly levelRange: string;
  readonly levelUnit: string;
  readonly bargainRange: string;
  readonly buffRange: string;
  readonly percentUnit: string;
  readonly fillShared: string;
  readonly validationSummary: string;
  readonly validationLevel: string;
  readonly validationBargain: string;
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

export type EarningsOverviewToolState = EarningsOverviewFormValues & {
  readonly comparisonMode: EarningsComparisonMode;
};
export type EarningsOverviewField = keyof EarningsOverviewFormValues;
export type EarningsOverviewErrors = Partial<
  Record<EarningsOverviewField, EarningsInputError | 'comparison-mode'>
>;
export type EarningsOverviewSharedValues = Pick<
  EarningsOverviewFormValues,
  'searchLevel' | 'printingLevel' | 'miningLevel' | 'bargainPercent'
>;

const defaultEarningsOverviewToolState: EarningsOverviewToolState = {
  searchLevel: String(EARNINGS_LEVEL_MIN),
  printingLevel: String(EARNINGS_LEVEL_MIN),
  miningLevel: String(EARNINGS_LEVEL_MIN),
  bargainPercent: '0',
  btcBuffPercent: BUFF_PERCENT_DEFAULT_STRING,
  comparisonMode: 'per-minute',
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
const earningsOverviewStateFields = [
  ...legacyEarningsOverviewFields,
  'comparisonMode',
] as const;
const earningsOverviewStateFieldsWithoutBuff = [
  ...legacyEarningsOverviewFieldsWithoutBuff,
  'comparisonMode',
] as const;

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
    return {
      searchLevel: value.searchLevel,
      printingLevel: value.printingLevel,
      miningLevel: value.miningLevel,
      bargainPercent: value.bargainPercent,
      btcBuffPercent,
      comparisonMode: 'per-minute',
    };
  }

  if (hasStringFields(value, legacyEarningsOverviewFieldsWithoutBuff)) {
    return {
      searchLevel: value.searchLevel,
      printingLevel: value.printingLevel,
      miningLevel: value.miningLevel,
      bargainPercent: value.bargainPercent,
      btcBuffPercent,
      comparisonMode: 'per-minute',
    };
  }

  if (hasStringFields(value, earningsOverviewStateFields)) {
    if (!isEarningsComparisonMode(value.comparisonMode)) return undefined;

    return {
      searchLevel: value.searchLevel,
      printingLevel: value.printingLevel,
      miningLevel: value.miningLevel,
      bargainPercent: value.bargainPercent,
      btcBuffPercent,
      comparisonMode: value.comparisonMode,
    };
  }

  if (!hasStringFields(value, earningsOverviewStateFieldsWithoutBuff)) return undefined;
  if (!isEarningsComparisonMode(value.comparisonMode)) return undefined;

  return {
    searchLevel: value.searchLevel,
    printingLevel: value.printingLevel,
    miningLevel: value.miningLevel,
    bargainPercent: value.bargainPercent,
    btcBuffPercent,
    comparisonMode: value.comparisonMode,
  };
}

function isEarningsOverviewToolState(value: unknown): value is EarningsOverviewToolState {
  if (!isRecord(value) || !hasStringFields(value, earningsOverviewStateFields)) return false;
  return isEarningsComparisonMode(value.comparisonMode);
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

/** 將共用設定帶入等級／討價還價欄位；刻意不觸碰工具自己的 Buff。 */
export function applyEarningsOverviewSharedValues(
  current: EarningsOverviewToolState,
  shared: EarningsOverviewSharedValues,
): EarningsOverviewToolState {
  return { ...current, ...shared };
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
  readonly values: EarningsOverviewFormValues;
  readonly errors: EarningsOverviewErrors;
  readonly inputs: EarningsInputs | null;
  readonly result: EarningsCalculation | null;
  readonly prices: ResolvedMarketPrices;
  readonly setValue: (field: EarningsOverviewField, value: string) => void;
  readonly fillFromShared: () => void;
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
      initialize: () => ({
        ...selectEarningsOverviewSharedValues(sharedStore.getSnapshot()),
        btcBuffPercent: defaultEarningsOverviewToolState.btcBuffPercent,
        comparisonMode: 'per-minute',
      }),
    },
  );

  const setValue = useCallback(
    (field: EarningsOverviewField, value: string) => {
      setValues((current) => ({ ...current, [field]: value }));
    },
    [setValues],
  );

  const fillFromShared = useCallback(() => {
    setValues((current) => applyEarningsOverviewSharedValues(
      current,
      selectEarningsOverviewSharedValues(sharedStore.getSnapshot()),
    ));
  }, [setValues, sharedStore]);

  const calculation = useMemo(
    () => calculateEarningsOverviewTool(values, sharedSnapshot),
    [sharedSnapshot, values],
  );
  const contextValue = useMemo(
    () => ({
      values,
      errors: calculation.errors,
      inputs: calculation.inputs,
      result: calculation.result,
      prices,
      setValue,
      fillFromShared,
    }),
    [calculation, fillFromShared, prices, setValue, values],
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
  if (error === 'bargain') return labels.validationBargain;
  if (error === 'btc-buff') return labels.validationBuff;
  if (error === 'comparison-mode') return labels.validationComparisonMode;
  return undefined;
}

function EarningsOverviewComparisonField({
  labels,
}: {
  readonly labels: EarningsOverviewToolLabels;
}) {
  const { values, setValue } = useEarningsOverviewTool();
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
        onChange={(event) => setValue('comparisonMode', event.target.value)}
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
  readonly field: EarningsOverviewField;
  readonly id: string;
  readonly label: string;
  readonly labels: EarningsOverviewToolLabels;
}) {
  const { values, errors, setValue } = useEarningsOverviewTool();
  const isLevel = field === 'searchLevel'
    || field === 'printingLevel'
    || field === 'miningLevel';
  const isBargain = field === 'bargainPercent';

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
      max={isLevel ? EARNINGS_LEVEL_MAX : isBargain ? 40 : 100}
      step="1"
      value={values[field]}
      placeholder={isLevel ? labels.levelPlaceholder : undefined}
      onChange={(event) => setValue(field, event.target.value)}
      error={getErrorMessage(field, errors, labels)}
      range={isLevel ? labels.levelRange : isBargain ? labels.bargainRange : labels.buffRange}
      unit={isLevel ? labels.levelUnit : labels.percentUnit}
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

export function EarningsOverviewResultTable({
  labels,
  locale,
  result,
  formatNumber,
}: {
  readonly labels: EarningsOverviewToolLabels;
  readonly locale: Locale;
  readonly result: EarningsCalculation;
  readonly formatNumber: NumberFormatter;
}) {
  const isElapsedMode = result.comparisonMode !== 'per-minute';

  return (
    <div
      data-result-layout="table"
      data-comparison-mode={result.comparisonMode}
      className="overflow-x-auto rounded-[var(--cco-card-radius)] border border-border"
    >
      <table className="w-full min-w-[40rem] table-fixed border-collapse text-left text-sm">
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
          {result.activities.map((activityResult) => {
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
  numberFormatter,
}: {
  readonly labels: EarningsOverviewToolLabels;
  readonly locale: Locale;
  readonly numberFormatter?: NumberFormatter;
}) {
  const {
    errors,
    inputs,
    prices,
    result,
    fillFromShared,
  } = useEarningsOverviewTool();
  const formatNumber = useMemo(
    () => numberFormatter ?? createNumberFormatter(locale),
    [locale, numberFormatter],
  );
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="not-prose my-8 space-y-6" data-tool="earnings-overview">
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
              <EarningsOverviewInputField
                field="bargainPercent"
                id="earnings-overview-bargain-percent"
                label={labels.bargainPercent}
                labels={labels}
              />
              <EarningsOverviewInputField
                field="btcBuffPercent"
                id="earnings-overview-btc-buff-percent"
                label={labels.btcBuffPercent}
                labels={labels}
              />
              <EarningsOverviewComparisonField labels={labels} />
            </div>
          </div>
          <p className="border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
            {labels.timeAssumption}
          </p>
        </CardContent>
      </Card>

      <div>
        <div className="mb-4">
          <h2 className="site-tool-section-heading text-xl font-semibold tracking-tight text-foreground">{labels.results}</h2>
        </div>
        {result ? (
          <EarningsOverviewResultTable
            labels={labels}
            locale={locale}
            result={result}
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
  labels,
  locale,
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
