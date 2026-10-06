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
  getToolFieldIds,
  ToolBuffSliderField,
  ToolField,
  ToolInputField,
  ToolPage,
  ToolPrimaryActions,
  ToolState,
} from '@/components/tools';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  getEconomyItemDefinition,
} from '@/data/game/economy';
import {
  getProgressionLevelDefinition,
  progressionLevelCatalog,
  type ProgressionLevelId,
  type ProgressionMethodId,
  type ProgressionResourceId,
} from '@/data/game/progression';
import {
  calculateLevelRequirements,
  LEVEL_MAX,
  LEVEL_MIN,
  isLevelTypeId,
  type LevelCalculation,
  type LevelCalculationInputs,
  type LevelMethodResult,
} from '@/lib/level-calculator';
import {
  BUFF_PERCENT_DEFAULT_STRING,
  normalizeLegacyBuffPercentString,
  parseBuffPercent,
} from '@/lib/buff-percent';
import { getDualPrice, resolveMarketPrices, type ResolvedMarketPrices } from '@/lib/market-prices';
import { createNumberFormatter, type NumberFormatter } from '@/lib/number-formatting';
import type { Locale } from '@/lib/i18n';
import {
  clearToolState,
  defaultSharedUserInputs,
  type SharedUserInputs,
} from '@/lib/storage';
import { useToolStateStorage } from '@/lib/storage/use-tool-state';

export interface LevelConversionToolLabels {
  readonly primaryInputs: string;
  readonly levelType: string;
  readonly currentLevel: string;
  readonly targetLevel: string;
  readonly levelPlaceholder: string;
  readonly levelRange: string;
  readonly levelUnit: string;
  readonly cortexBonus: string;
  readonly percentUnit: string;
  readonly buffRange: string;
  readonly reset: string;
  readonly fillPlayer: string;
  readonly validationSummary: string;
  readonly validationType: string;
  readonly validationLevel: string;
  readonly validationTargetBeforeCurrent: string;
  readonly validationBuff: string;
  readonly noResult: string;
  readonly noResultHint: string;
  readonly results: string;
  readonly method: string;
  readonly neededTimes: string;
  readonly timesUnit: string;
  readonly duration: string;
  readonly minutesUnit: string;
  readonly resources: string;
  readonly valueAi: string;
  readonly noResource: string;
  readonly notAvailable: string;
  readonly aiResource: string;
  readonly cacheResource: string;
  readonly methodNames: Readonly<Record<ProgressionMethodId, string>>;
}

export interface LevelConversionFormValues {
  readonly levelType: string;
  readonly currentLevel: string;
  readonly targetLevel: string;
  readonly cortexBonusPercent: string;
  readonly aiPerHash: string;
  readonly aiPerTechScrap: string;
  readonly aiPerMedicalTechParts: string;
  readonly aiPerAmmunitionTechParts: string;
  readonly aiPerMilitaryAmmunitionTechParts: string;
  readonly trashCachePerAi: string;
  readonly btcPerAi: string;
}

export type LevelConversionField = keyof LevelConversionFormValues;
export type LevelConversionError =
  | 'type'
  | 'level'
  | 'target'
  | 'buff';
export type LevelConversionErrors = Partial<
  Record<LevelConversionField, LevelConversionError>
>;

export interface LevelConversionToolState {
  readonly levelType: string;
  readonly currentLevel: string;
  readonly targetLevel: string;
  readonly cortexBonusPercent: string;
}

type LevelConversionToolField = keyof LevelConversionToolState;
export type LevelConversionSharedValues = Omit<LevelConversionFormValues, 'cortexBonusPercent'>;

const defaultLevelConversionToolState: LevelConversionToolState = {
  levelType: 'level',
  currentLevel: String(LEVEL_MIN),
  targetLevel: String(LEVEL_MIN),
  cortexBonusPercent: BUFF_PERCENT_DEFAULT_STRING,
};

function getSharedLevel(snapshot: SharedUserInputs, levelType: ProgressionLevelId): string {
  if (levelType === 'level') return String(snapshot.progression.player.level);

  const stored = snapshot.progression.skills.find((skill) => skill.id === levelType);
  return String(stored?.level ?? getProgressionLevelDefinition(levelType).defaultValue);
}

/** 將共享 progression 與 economy 投影成等級換算工具欄位；Buff 屬於工具自身狀態。 */
export function selectLevelConversionSharedValues(
  snapshot: SharedUserInputs,
  levelType: ProgressionLevelId = 'level',
): LevelConversionSharedValues {
  const prices = resolveMarketPrices(snapshot);

  return {
    levelType,
    currentLevel: getSharedLevel(snapshot, levelType),
    targetLevel: String(snapshot.progression.player.level),
    aiPerHash: String(getDualPrice(prices, 'hash', 'ai')),
    aiPerTechScrap: String(getDualPrice(prices, 'tech-scrap', 'ai')),
    aiPerMedicalTechParts: String(getDualPrice(prices, 'medical-tech-parts', 'ai')),
    aiPerAmmunitionTechParts: String(getDualPrice(prices, 'ammunition-tech-parts', 'ai')),
    aiPerMilitaryAmmunitionTechParts: String(
      getDualPrice(prices, 'military-ammunition-tech-parts', 'ai'),
    ),
    trashCachePerAi: String(prices.caches.trash.value),
    btcPerAi: String(prices.btcPerAi),
  };
}

/** 將玩家等級帶入目前試算；保留工具自己的 EXP Buff。 */
export function applyLevelConversionPlayerValues(
  current: LevelConversionToolState,
  shared: LevelConversionSharedValues,
): LevelConversionToolState {
  return {
    ...current,
    levelType: shared.levelType,
    currentLevel: shared.currentLevel,
    targetLevel: shared.targetLevel,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLevelConversionToolState(value: unknown): value is LevelConversionToolState {
  if (
    !isRecord(value) ||
    typeof value.levelType !== 'string' ||
    !isLevelTypeId(value.levelType) ||
    typeof value.currentLevel !== 'string' ||
    typeof value.targetLevel !== 'string' ||
    typeof value.cortexBonusPercent !== 'string'
  ) {
    return false;
  }

  const keys = Object.keys(value);
  return keys.length === 4 && keys.every((key) =>
    key === 'levelType' ||
    key === 'currentLevel' ||
    key === 'targetLevel' ||
    key === 'cortexBonusPercent',
  );
}

export function normalizeLevelConversionToolState(
  value: unknown,
): LevelConversionToolState | undefined {
  if (!isRecord(value)) return undefined;

  const keys = Object.keys(value);
  const requiredFields = ['levelType', 'currentLevel', 'targetLevel'] as const;
  if (
    (keys.length !== requiredFields.length && keys.length !== requiredFields.length + 1) ||
    !keys.every((key) => key === 'cortexBonusPercent' || requiredFields.includes(key as typeof requiredFields[number])) ||
    typeof value.levelType !== 'string' ||
    !isLevelTypeId(value.levelType) ||
    typeof value.currentLevel !== 'string' ||
    typeof value.targetLevel !== 'string'
  ) {
    return undefined;
  }

  const cortexBonusPercent = Object.prototype.hasOwnProperty.call(value, 'cortexBonusPercent')
    ? normalizeLegacyBuffPercentString(value.cortexBonusPercent)
    : BUFF_PERCENT_DEFAULT_STRING;
  if (cortexBonusPercent === undefined) return undefined;

  return {
    levelType: value.levelType,
    currentLevel: value.currentLevel,
    targetLevel: value.targetLevel,
    cortexBonusPercent,
  };
}

export function createLevelConversionValues(
  toolState: LevelConversionToolState,
  sharedValues: LevelConversionSharedValues,
): LevelConversionFormValues {
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

export function parseLevelConversionValues(values: LevelConversionFormValues): {
  readonly errors: LevelConversionErrors;
  readonly inputs: LevelCalculationInputs | null;
} {
  const levelType = isLevelTypeId(values.levelType) ? values.levelType : null;
  const currentLevel = parseInteger(values.currentLevel, LEVEL_MIN, LEVEL_MAX);
  const targetLevel = parseInteger(values.targetLevel, LEVEL_MIN, LEVEL_MAX);
  const cortexBonusPercent = parseBuffPercent(values.cortexBonusPercent);
  const errors: LevelConversionErrors = {};

  if (levelType === null) errors.levelType = 'type';
  if (currentLevel === null) errors.currentLevel = 'level';
  if (targetLevel === null) errors.targetLevel = 'level';
  if (cortexBonusPercent === null) errors.cortexBonusPercent = 'buff';
  if (currentLevel !== null && targetLevel !== null && targetLevel < currentLevel) {
    errors.targetLevel = 'target';
  }

  if (Object.keys(errors).length > 0) {
    return { errors, inputs: null };
  }

  return {
    errors,
    inputs: {
      levelType: levelType as ProgressionLevelId,
      currentLevel: currentLevel as number,
      targetLevel: targetLevel as number,
      cortexBonusPercent: cortexBonusPercent as number,
    },
  };
}

export function calculateLevelConversionTool(
  values: LevelConversionFormValues,
  snapshot: SharedUserInputs = defaultSharedUserInputs,
): {
  readonly errors: LevelConversionErrors;
  readonly inputs: LevelCalculationInputs | null;
  readonly result: LevelCalculation | null;
} {
  const parsed = parseLevelConversionValues(values);

  return {
    errors: parsed.errors,
    inputs: parsed.inputs,
    result: parsed.inputs
      ? calculateLevelRequirements(parsed.inputs, resolveMarketPrices(snapshot))
      : null,
  };
}

interface LevelConversionContextValue {
  readonly values: LevelConversionFormValues;
  readonly errors: LevelConversionErrors;
  readonly inputs: LevelCalculationInputs | null;
  readonly result: LevelCalculation | null;
  readonly setValue: (field: LevelConversionToolField, value: string) => void;
  readonly fillPlayer: () => void;
  readonly reset: () => void;
}

const LevelConversionToolContext = createContext<LevelConversionContextValue | null>(null);

function useLevelConversionTool() {
  const context = useContext(LevelConversionToolContext);
  if (!context) {
    throw new Error('LevelConversionTool 元件必須放在 LevelConversionToolProvider 內。');
  }

  return context;
}

export function LevelConversionToolProvider({ children }: { children: ReactNode }) {
  const sharedSnapshot = useSharedUserInputs();
  const sharedStore = useSharedUserInputsStore();
  const [toolState, setToolState] = useToolStateStorage<LevelConversionToolState>(
    'level-conversion',
    defaultLevelConversionToolState,
    {
      validate: isLevelConversionToolState,
      normalize: normalizeLevelConversionToolState,
      initialize: () => {
        const shared = selectLevelConversionSharedValues(
          sharedStore.getSnapshot(),
          'level',
        );
        return {
          levelType: shared.levelType,
          currentLevel: shared.currentLevel,
          targetLevel: shared.targetLevel,
          cortexBonusPercent: defaultLevelConversionToolState.cortexBonusPercent,
        };
      },
    },
  );
  const sharedValues = useMemo(
    () => selectLevelConversionSharedValues(sharedSnapshot, isLevelTypeId(toolState.levelType)
      ? toolState.levelType
      : 'level'),
    [sharedSnapshot, toolState.levelType],
  );

  const setValue = useCallback(
    (field: LevelConversionToolField, value: string) => {
      setToolState((current) => ({ ...current, [field]: value }));
    },
    [setToolState],
  );

  const fillPlayer = useCallback(() => {
    const latestSharedValues = selectLevelConversionSharedValues(
      sharedStore.getSnapshot(),
      isLevelTypeId(toolState.levelType) ? toolState.levelType : 'level',
    );
    setToolState((current) => applyLevelConversionPlayerValues(current, latestSharedValues));
  }, [setToolState, sharedStore, toolState.levelType]);

  const reset = useCallback(() => {
    clearToolState('level-conversion');
    const latestSharedValues = selectLevelConversionSharedValues(
      sharedStore.getSnapshot(),
      'level',
    );
    setToolState({
      levelType: latestSharedValues.levelType,
      currentLevel: latestSharedValues.currentLevel,
      targetLevel: latestSharedValues.targetLevel,
      cortexBonusPercent: defaultLevelConversionToolState.cortexBonusPercent,
    });
  }, [setToolState, sharedStore]);

  const values = useMemo(
    () => createLevelConversionValues(toolState, sharedValues),
    [sharedValues, toolState],
  );
  const calculation = useMemo(
    () => calculateLevelConversionTool(values, sharedSnapshot),
    [sharedSnapshot, values],
  );
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
    <LevelConversionToolContext.Provider value={contextValue}>
      {children}
    </LevelConversionToolContext.Provider>
  );
}

function getErrorMessage(
  field: LevelConversionField,
  errors: LevelConversionErrors,
  labels: LevelConversionToolLabels,
) {
  const error = errors[field];
  if (error === 'type') return labels.validationType;
  if (error === 'target') return labels.validationTargetBeforeCurrent;
  if (error === 'level') return labels.validationLevel;
  if (error === 'buff') return labels.validationBuff;
  return undefined;
}

function LevelTypeField({
  labels,
  locale,
  id,
}: {
  labels: LevelConversionToolLabels;
  locale: Locale;
  id: string;
}) {
  const { values, errors, setValue } = useLevelConversionTool();
  const fieldIds = getToolFieldIds(id, { error: Boolean(errors.levelType) });

  return (
    <ToolField
      id={id}
      label={labels.levelType}
      error={getErrorMessage('levelType', errors, labels)}
    >
      <select
        id={id}
        value={values.levelType}
        onChange={(event) => setValue('levelType', event.target.value)}
        aria-invalid={errors.levelType ? true : undefined}
        aria-describedby={fieldIds.describedBy}
        className="flex h-[var(--cco-input-height)] w-full min-w-0 rounded-[var(--cco-input-radius)] border border-input bg-background px-[var(--cco-input-padding-x)] py-[var(--cco-input-padding-y)] text-base text-foreground outline-none transition-[color,box-shadow] duration-[var(--cco-duration-fast)] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 md:text-sm"
      >
        {progressionLevelCatalog.map((definition) => (
          <option key={definition.id} value={definition.id}>
            {definition.labels[locale]}
          </option>
        ))}
      </select>
    </ToolField>
  );
}

function LevelNumberField({
  field,
  id,
  label,
  placeholder,
  labels,
}: {
  field: 'currentLevel' | 'targetLevel';
  id: string;
  label: string;
  placeholder: string;
  labels: LevelConversionToolLabels;
}) {
  const { values, errors, setValue } = useLevelConversionTool();

  return (
    <ToolInputField
      id={id}
      label={label}
      type="number"
      inputMode="numeric"
      min={LEVEL_MIN}
      max={LEVEL_MAX}
      step="1"
      value={values[field]}
      placeholder={placeholder}
      range={labels.levelRange}
      onChange={(event) => setValue(field, event.target.value)}
      error={getErrorMessage(field, errors, labels)}
      unit={labels.levelUnit}
    />
  );
}

function LevelSettingField({
  field,
  id,
  label,
  unit,
  labels,
}: {
  field: 'cortexBonusPercent';
  id: string;
  label: string;
  unit: string;
  labels: LevelConversionToolLabels;
}) {
  const { values, errors, setValue } = useLevelConversionTool();

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

function formatAmount(formatNumber: NumberFormatter, value: number) {
  return formatNumber(value, {
    maximumFractionDigits: 2,
  });
}

function formatDuration(
  formatNumber: NumberFormatter,
  value: number | null,
  labels: LevelConversionToolLabels,
) {
  if (value === null) return labels.notAvailable;

  return `${formatNumber(value, {
    maximumFractionDigits: 1,
  })} ${labels.minutesUnit}`;
}

function getResourceLabel(
  id: ProgressionResourceId,
  locale: Locale,
  labels: LevelConversionToolLabels,
) {
  if (id === 'ai') return labels.aiResource;
  if (id === 'cache') return labels.cacheResource;
  return getEconomyItemDefinition(id).labels[locale];
}

function formatResource(
  formatNumber: NumberFormatter,
  resource: LevelMethodResult['resourceResults'][number],
  locale: Locale,
  labels: LevelConversionToolLabels,
) {
  return `${getResourceLabel(resource.id, locale, labels)} × ${formatNumber(resource.amount, {
    maximumFractionDigits: 2,
  })}`;
}

function EmptyLevelConversionResult({
  labels,
  hasErrors,
}: {
  labels: LevelConversionToolLabels;
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

function LevelMethodResultTable({
  labels,
  locale,
  methods,
  formatNumber,
}: {
  labels: LevelConversionToolLabels;
  locale: Locale;
  methods: readonly LevelMethodResult[];
  formatNumber: NumberFormatter;
}) {
  return (
    <div
      data-result-layout="table"
      className="overflow-x-auto rounded-[var(--cco-card-radius)] border border-border"
    >
      <table className="w-full min-w-[40rem] table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col className="w-[18%]" />
          <col className="w-[16%]" />
          <col className="w-[18%]" />
          <col className="w-[30%]" />
          <col className="w-[18%]" />
        </colgroup>
        <caption className="sr-only">{labels.results}</caption>
        <thead className="bg-muted/40 text-muted-foreground">
          <tr className="border-b border-border">
            <th scope="col" className="px-3 py-2.5 font-medium">
              {labels.method}
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              {labels.neededTimes}
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              {labels.duration}
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              {labels.resources}
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              {labels.valueAi}
            </th>
          </tr>
        </thead>
        <tbody>
          {methods.map((method) => (
            <tr key={method.id} className="border-b border-border last:border-b-0">
              <th scope="row" className="px-3 py-2.5 font-medium text-foreground">
                {labels.methodNames[method.id]}
              </th>
              <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                {formatAmount(formatNumber, method.neededTimes)} {labels.timesUnit}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                {formatDuration(formatNumber, method.totalMinutes, labels)}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">
                {method.resourceResults.length === 0 ? (
                  labels.noResource
                ) : (
                  <ul className="list-none space-y-1 p-0">
                    {method.resourceResults.map((resource) => (
                      <li key={resource.id}>
                        {formatResource(formatNumber, resource, locale, labels)}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                {method.totalValueAi === null
                  ? labels.notAvailable
                  : `${formatAmount(formatNumber, method.totalValueAi)} AI`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LevelConversionCalculator({
  labels,
  locale,
  numberFormatter,
}: {
  labels: LevelConversionToolLabels;
  locale: Locale;
  numberFormatter?: NumberFormatter;
}) {
  const { errors, inputs, result, fillPlayer, reset } = useLevelConversionTool();
  const hasErrors = Object.keys(errors).length > 0;
  const formatNumber = useMemo(
    () => numberFormatter ?? createNumberFormatter(locale),
    [locale, numberFormatter],
  );

  return (
    <div className="not-prose my-8 space-y-6" data-tool="level-conversion">
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
        <CardContent>
          <div className="@container">
            <div className="grid gap-5 @min-[24rem]:grid-cols-2 @min-[48rem]:grid-cols-3">
              <LevelTypeField labels={labels} locale={locale} id="level-conversion-type" />
              <LevelNumberField
                field="currentLevel"
                id="level-conversion-current-level"
                label={labels.currentLevel}
                placeholder={labels.levelPlaceholder}
                labels={labels}
              />
              <LevelNumberField
                field="targetLevel"
                id="level-conversion-target-level"
                label={labels.targetLevel}
                placeholder={labels.levelPlaceholder}
                labels={labels}
              />
              <LevelSettingField
                field="cortexBonusPercent"
                id="level-conversion-cortex-bonus"
                label={labels.cortexBonus}
                unit={labels.percentUnit}
                labels={labels}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="mb-4">
          <h2 className="site-tool-section-heading text-xl font-semibold tracking-tight text-foreground">{labels.results}</h2>
        </div>
        {result && inputs ? (
          <LevelMethodResultTable
            labels={labels}
            locale={locale}
            methods={result.methods}
            formatNumber={formatNumber}
          />
        ) : (
          <EmptyLevelConversionResult labels={labels} hasErrors={hasErrors} />
        )}
      </div>
    </div>
  );
}

export function LevelConversionToolPage({
  toc,
  full,
  contextLabel,
  contextPanelLabel,
  contextCloseLabel,
  header,
  headerActions,
  children,
}: Omit<ContextualDocsPageProps, 'contextItems' | 'defaultContextId' | 'mobileContext' | 'children'> & {
  labels: LevelConversionToolLabels;
  locale: Locale;
  header: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <LevelConversionToolProvider>
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
    </LevelConversionToolProvider>
  );
}
