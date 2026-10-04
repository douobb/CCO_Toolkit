'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import { Download, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ContextualDocsPageProps } from '@/components/context';
import {
  useSharedUserInputs,
  useSharedUserInputsStore,
} from '@/components/shared-user-inputs';
import {
  getToolFieldIds,
  ToolBreakdown,
  ToolField,
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
import { dungeonPrefixIds } from '@/data/game/dungeon';
import {
  calculateDungeon,
  deriveDestructiveWeaponCriticalDamage,
  DUNGEON_CRITICAL_DAMAGE_MAX,
  DUNGEON_CRITICAL_DAMAGE_MIN,
  DUNGEON_DEFAULT_LEVEL,
  DUNGEON_LEVEL_MAX,
  DUNGEON_LEVEL_MIN,
  type DungeonCalculation,
  type DungeonCalculationInput,
  type DungeonEnemyKind,
  type DungeonEnemyStats,
  type DungeonPrefixInput,
  type DungeonType,
} from '@/lib/dungeon-calculator';
import { cn } from '@/lib/cn';
import { getListSeparator, type Locale } from '@/lib/i18n';
import { createNumberFormatter, type NumberFormatter } from '@/lib/number-formatting';
import { SHARED_DESTRUCTIVE_WEAPON_DAMAGE_DEFAULT } from '@/lib/shared-user-inputs';
import {
  clearToolState,
  defaultSharedUserInputs,
  type SharedUserInputs,
} from '@/lib/storage';
import { useToolStateStorage } from '@/lib/storage/use-tool-state';

export interface DungeonToolLabels {
  readonly settingsTab: string;
  readonly settingsTitle: string;
  readonly openSettings: string;
  readonly closeSettings: string;
  readonly inputs: string;
  readonly enemyLevel: string;
  readonly dungeonType: string;
  readonly types: Readonly<Record<DungeonType, string>>;
  readonly levelUnit: string;
  readonly playerValues: string;
  readonly maxHealth: string;
  readonly shield: string;
  readonly destructiveWeaponDamage: string;
  readonly criticalDamagePercent: string;
  readonly damageReductionPercent: string;
  readonly healthUnit: string;
  readonly shieldUnit: string;
  readonly damageUnit: string;
  readonly percentUnit: string;
  readonly levelRange: string;
  readonly nonNegativeRange: string;
  readonly positiveRange: string;
  readonly criticalDamageRange: string;
  readonly percentRange: string;
  readonly fillShared: string;
  readonly reset: string;
  readonly validationSummary: string;
  readonly validationLevel: string;
  readonly validationType: string;
  readonly validationValue: string;
  readonly validationCriticalDamage: string;
  readonly noResult: string;
  readonly noResultHint: string;
  readonly summary: string;
  readonly safety: string;
  readonly roomLevels: string;
  readonly none: string;
  readonly maxSafeEnemyLevel: string;
  readonly maxSafeRoomLevel: string;
  readonly playerEffectiveHealth: string;
  readonly actualCriticalDamage: string;
  readonly experience: string;
  readonly smallAverageExperience: string;
  readonly smallAverageClicks: string;
  readonly smallExperiencePerClick: string;
  readonly bossAverageExperience: string;
  readonly bossAverageClicks: string;
  readonly bossExperiencePerClick: string;
  readonly critDeathProbability: string;
  readonly critDeathProbabilityForRoom: string;
  readonly enemyDetails: string;
  readonly smallEnemies: string;
  readonly bosses: string;
  readonly prefix: string;
  readonly hp: string;
  readonly attackRange: string;
  readonly experienceRange: string;
  readonly btc: string;
  readonly prefixes: Readonly<Record<(typeof dungeonPrefixIds)[number], string>>;
}

export interface DungeonFormValues {
  readonly enemyLevel: string;
  readonly dungeonType: string;
  readonly maxHealth: string;
  readonly shield: string;
  readonly destructiveWeaponDamage: string;
  readonly criticalDamagePercent: string;
  readonly damageReductionPercent: string;
}

export type DungeonField = keyof DungeonFormValues;
export type DungeonError = 'level' | 'type' | 'value' | 'criticalDamage';
export type DungeonErrors = Partial<Record<DungeonField, DungeonError>>;

export interface DungeonSharedValues {
  readonly maxHealth: string;
  readonly shield: string;
  readonly destructiveWeaponDamage: string;
  readonly criticalDamagePercent: string;
  readonly damageReductionPercent: string;
}

type DungeonToolState = DungeonFormValues;

const defaultDungeonToolState: DungeonToolState = {
  enemyLevel: String(DUNGEON_DEFAULT_LEVEL),
  dungeonType: 'normal',
  maxHealth: '0',
  shield: '0',
  destructiveWeaponDamage: String(SHARED_DESTRUCTIVE_WEAPON_DAMAGE_DEFAULT),
  criticalDamagePercent: String(DUNGEON_CRITICAL_DAMAGE_MIN),
  damageReductionPercent: '0',
};

const dungeonNumericFields = [
  'enemyLevel',
  'maxHealth',
  'shield',
  'destructiveWeaponDamage',
  'criticalDamagePercent',
  'damageReductionPercent',
] as const satisfies readonly Exclude<DungeonField, 'dungeonType'>[];

function isDungeonType(value: string): value is DungeonType {
  return value === 'normal' || value === 'invasion';
}

/** 將共用裝備／戰鬥輸入投影成地城工具可一次帶入的欄位。 */
export function selectDungeonSharedValues(
  snapshot: SharedUserInputs,
): DungeonSharedValues {
  const criticalDamagePercent =
    snapshot.equipment.criticalDamagePercent ?? DUNGEON_CRITICAL_DAMAGE_MIN;

  return {
    maxHealth: String(snapshot.equipment.maxHealth ?? 0),
    shield: String(snapshot.equipment.armor ?? 0),
    destructiveWeaponDamage: String(
      snapshot.equipment.destructiveWeaponDamage
        ?? SHARED_DESTRUCTIVE_WEAPON_DAMAGE_DEFAULT,
    ),
    criticalDamagePercent: String(criticalDamagePercent),
    damageReductionPercent: String(snapshot.equipment.damageReductionPercent ?? 0),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDungeonToolState(value: unknown): value is DungeonToolState {
  if (!isRecord(value)) return false;

  if (
    dungeonNumericFields.some((field) => typeof value[field] !== 'string') ||
    typeof value.dungeonType !== 'string' ||
    !isDungeonType(value.dungeonType)
  ) {
    return false;
  }

  const keys = Object.keys(value);
  return keys.length === 7 && keys.every((key) =>
    key === 'enemyLevel' ||
    key === 'dungeonType' ||
    key === 'maxHealth' ||
    key === 'shield' ||
    key === 'destructiveWeaponDamage' ||
    key === 'criticalDamagePercent' ||
    key === 'damageReductionPercent',
  );
}

function parseInteger(value: string, min: number, max: number): number | null {
  const normalized = value.trim();
  if (!normalized || !/^\d+$/.test(normalized)) return null;

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return null;

  return parsed;
}

export function parseDungeonValues(values: DungeonFormValues): {
  readonly errors: DungeonErrors;
  readonly inputs: DungeonCalculationInput | null;
} {
  const enemyLevel = parseInteger(values.enemyLevel, DUNGEON_LEVEL_MIN, DUNGEON_LEVEL_MAX);
  const dungeonType = isDungeonType(values.dungeonType) ? values.dungeonType : null;
  const maxHealth = parseInteger(values.maxHealth, 0, Number.MAX_SAFE_INTEGER);
  const shield = parseInteger(values.shield, 0, Number.MAX_SAFE_INTEGER);
  const destructiveWeaponDamage = parseInteger(
    values.destructiveWeaponDamage,
    1,
    Number.MAX_SAFE_INTEGER,
  );
  const criticalDamagePercent = parseInteger(
    values.criticalDamagePercent,
    DUNGEON_CRITICAL_DAMAGE_MIN,
    DUNGEON_CRITICAL_DAMAGE_MAX,
  );
  const damageReductionPercent = parseInteger(values.damageReductionPercent, 0, 100);
  const errors: DungeonErrors = {};

  if (enemyLevel === null) errors.enemyLevel = 'level';
  if (dungeonType === null) errors.dungeonType = 'type';
  if (maxHealth === null) errors.maxHealth = 'value';
  if (shield === null) errors.shield = 'value';
  if (destructiveWeaponDamage === null) errors.destructiveWeaponDamage = 'criticalDamage';
  if (criticalDamagePercent === null) errors.criticalDamagePercent = 'criticalDamage';
  if (damageReductionPercent === null) errors.damageReductionPercent = 'value';

  if (Object.keys(errors).length > 0) {
    return { errors, inputs: null };
  }

  const destructiveWeaponCriticalDamage = deriveDestructiveWeaponCriticalDamage(
    destructiveWeaponDamage as number,
    criticalDamagePercent as number,
  );
  if (destructiveWeaponCriticalDamage === null) {
    errors.destructiveWeaponDamage = 'criticalDamage';
    errors.criticalDamagePercent = 'criticalDamage';
    return { errors, inputs: null };
  }

  return {
    errors,
    inputs: {
      enemyLevel: enemyLevel as number,
      dungeonType: dungeonType as DungeonType,
      playerMaxHealth: maxHealth as number,
      playerShield: shield as number,
      damageReductionPercent: damageReductionPercent as number,
      destructiveWeaponCriticalDamage,
    },
  };
}

export function calculateDungeonTool(values: DungeonFormValues): {
  readonly errors: DungeonErrors;
  readonly inputs: DungeonCalculationInput | null;
  readonly result: DungeonCalculation | null;
} {
  const parsed = parseDungeonValues(values);

  return {
    errors: parsed.errors,
    inputs: parsed.inputs,
    result: parsed.inputs ? calculateDungeon(parsed.inputs) : null,
  };
}

interface DungeonToolContextValue {
  readonly values: DungeonFormValues;
  readonly errors: DungeonErrors;
  readonly inputs: DungeonCalculationInput | null;
  readonly result: DungeonCalculation | null;
  readonly setValue: (field: DungeonField, value: string) => void;
  readonly fillFromShared: () => void;
  readonly reset: () => void;
}

const DungeonToolContext = createContext<DungeonToolContextValue | null>(null);

function useDungeonTool() {
  const context = useContext(DungeonToolContext);
  if (!context) {
    throw new Error('DungeonTool 元件必須放在 DungeonToolProvider 內。');
  }

  return context;
}

export function DungeonToolProvider({ children }: { children: ReactNode }) {
  const sharedSnapshot = useSharedUserInputs();
  const sharedStore = useSharedUserInputsStore();
  const [toolState, setToolState] = useToolStateStorage<DungeonToolState>(
    'dungeon',
    defaultDungeonToolState,
    {
      validate: isDungeonToolState,
      initialize: () => ({
        ...defaultDungeonToolState,
        ...selectDungeonSharedValues(sharedStore.getSnapshot()),
      }),
    },
  );

  const setValue = useCallback((field: DungeonField, value: string) => {
    setToolState((current) => ({ ...current, [field]: value }));
  }, [setToolState]);

  const fillFromShared = useCallback(() => {
    setToolState((current) => ({
      ...current,
      ...selectDungeonSharedValues(sharedStore.getSnapshot()),
    }));
  }, [setToolState, sharedStore]);

  const reset = useCallback(() => {
    clearToolState('dungeon');
    setToolState({
      ...defaultDungeonToolState,
      ...selectDungeonSharedValues(sharedStore.getSnapshot()),
    });
  }, [setToolState, sharedStore]);

  const calculation = useMemo(() => calculateDungeonTool(toolState), [toolState]);
  const contextValue = useMemo(
    () => ({
      values: toolState,
      errors: calculation.errors,
      inputs: calculation.inputs,
      result: calculation.result,
      setValue,
      fillFromShared,
      reset,
    }),
    [calculation, fillFromShared, reset, setValue, toolState],
  );

  return (
    <DungeonToolContext.Provider value={contextValue}>
      {children}
    </DungeonToolContext.Provider>
  );
}

function getErrorMessage(
  field: DungeonField,
  errors: DungeonErrors,
  labels: DungeonToolLabels,
) {
  const error = errors[field];
  if (error === 'level') return labels.validationLevel;
  if (error === 'type') return labels.validationType;
  if (error === 'criticalDamage') return labels.validationCriticalDamage;
  if (error === 'value') return labels.validationValue;
  return undefined;
}

function DungeonNumberField({
  field,
  id,
  label,
  unit,
  min,
  max,
  range,
  labels,
}: {
  field: Exclude<DungeonField, 'dungeonType'>;
  id: string;
  label: string;
  unit?: string;
  min: number;
  max?: number;
  range: string;
  labels: DungeonToolLabels;
}) {
  const { values, errors, setValue } = useDungeonTool();

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
      onChange={(event) => setValue(field, event.target.value)}
      error={getErrorMessage(field, errors, labels)}
      range={range}
      unit={unit}
    />
  );
}

function DungeonTypeField({
  id,
  labels,
}: {
  id: string;
  labels: DungeonToolLabels;
}) {
  const { values, errors, setValue } = useDungeonTool();
  const fieldIds = getToolFieldIds(id, { error: Boolean(errors.dungeonType) });

  return (
    <ToolField
      id={id}
      label={labels.dungeonType}
      error={getErrorMessage('dungeonType', errors, labels)}
    >
      <select
        id={id}
        value={values.dungeonType}
        onChange={(event) => setValue('dungeonType', event.target.value)}
        aria-invalid={errors.dungeonType ? true : undefined}
        aria-describedby={fieldIds.describedBy}
        className="flex h-[var(--cco-input-height)] w-full min-w-0 rounded-[var(--cco-input-radius)] border border-input bg-background px-[var(--cco-input-padding-x)] py-[var(--cco-input-padding-y)] text-base text-foreground outline-none transition-[color,box-shadow] duration-[var(--cco-duration-fast)] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 md:text-sm"
      >
        <option value="normal">{labels.types.normal}</option>
        <option value="invasion">{labels.types.invasion}</option>
      </select>
    </ToolField>
  );
}

export function DungeonSettingsPanel({
  labels,
  idPrefix = 'dungeon-settings',
}: {
  labels: DungeonToolLabels;
  idPrefix?: string;
}) {
  const { reset } = useDungeonTool();

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div>
        <h2 className="font-semibold text-foreground">{labels.settingsTitle}</h2>
      </div>

      <div className="space-y-5">
        <h3 className="text-sm font-medium text-foreground">{labels.playerValues}</h3>
        <DungeonNumberField
          field="damageReductionPercent"
          id={`${idPrefix}-damage-reduction-percent`}
          label={labels.damageReductionPercent}
          unit={labels.percentUnit}
          min={0}
          max={100}
          range={labels.percentRange}
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

function formatTemplate(template: string, replacements: Record<string, string | number>) {
  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.replace('$' + '{' + key + '}', String(value)),
    template,
  );
}

function formatWhole(formatNumber: NumberFormatter, value: number) {
  return formatNumber(value, { maximumFractionDigits: 0 });
}

function formatDecimal(formatNumber: NumberFormatter, value: number) {
  return formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(formatNumber: NumberFormatter, value: number) {
  return `${formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatLevel(formatNumber: NumberFormatter, level: number, labels: DungeonToolLabels) {
  return `${labels.levelUnit}${formatWhole(formatNumber, level)}`;
}

function formatRange(formatNumber: NumberFormatter, min: number, max: number) {
  return `${formatWhole(formatNumber, min)} - ${formatWhole(formatNumber, max)}`;
}

function EmptyDungeonResult({
  labels,
  hasErrors,
}: {
  labels: DungeonToolLabels;
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

export function CritProbabilityList({
  labels,
  result,
  formatNumber,
}: {
  labels: DungeonToolLabels;
  result: DungeonCalculation;
  formatNumber: NumberFormatter;
}) {
  const hasMultipleResults = result.summary.critDeathProbabilities.length > 1;

  return (
    <section aria-labelledby="dungeon-crit-probability-title" className="@container">
      <h3 id="dungeon-crit-probability-title" className="text-sm font-medium text-foreground">
        {labels.critDeathProbability}
      </h3>
      <div
        className={cn(
          'mt-3 rounded-md border border-border',
          hasMultipleResults
            ? 'grid gap-x-6 @min-[40rem]:grid-cols-2'
            : 'divide-y divide-border',
        )}
      >
        {result.summary.critDeathProbabilities.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">{labels.none}</p>
        ) : (
          result.summary.critDeathProbabilities.map((probability) => (
            <div
              key={probability.roomLevel}
              className={cn(
                'flex flex-wrap items-center justify-between gap-3 p-3 text-sm',
                hasMultipleResults
                  ? 'border-b border-border last:border-b-0'
                  : undefined,
              )}
            >
              <span className="text-muted-foreground">
                {formatTemplate(labels.critDeathProbabilityForRoom, {
                  level: formatWhole(formatNumber, probability.roomLevel),
                })}
              </span>
              <span className={cn(
                'font-medium',
                probability.probabilityPercent >= 100
                  ? 'text-destructive'
                  : 'text-foreground',
              )}>
                {formatPercent(formatNumber, probability.probabilityPercent)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function enemyPrefixLabel(
  prefix: DungeonPrefixInput,
  labels: DungeonToolLabels,
): string {
  const normalized = prefix === 'X' ? 'x' : prefix;
  return labels.prefixes[normalized] ?? normalized;
}

function DungeonEnemyTable({
  kind,
  enemies,
  labels,
  formatNumber,
}: {
  kind: DungeonEnemyKind;
  enemies: readonly DungeonEnemyStats[];
  labels: DungeonToolLabels;
  formatNumber: NumberFormatter;
}) {
  return (
    <section aria-labelledby={`dungeon-${kind}-enemies-title`} className="space-y-3">
      <h3 id={`dungeon-${kind}-enemies-title`} className="text-sm font-medium text-foreground">
        {kind === 'small' ? labels.smallEnemies : labels.bosses}
      </h3>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr className="border-b border-border">
              {[labels.prefix, labels.hp, labels.shield, labels.attackRange, labels.experienceRange, labels.btc].map((label) => (
                <th key={label} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {enemies.map((enemy) => (
              <tr key={enemy.prefix} className="border-b border-border last:border-b-0">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-foreground">
                  {enemyPrefixLabel(enemy.prefix, labels)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatWhole(formatNumber, enemy.hp)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatWhole(formatNumber, enemy.shield)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {formatRange(formatNumber, enemy.attackMin, enemy.attackMax)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {formatRange(formatNumber, enemy.experienceMin, enemy.experienceMax)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatWhole(formatNumber, enemy.btc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DungeonResult({
  locale,
  labels,
  result,
  hasErrors,
  formatNumber,
}: {
  locale: Locale;
  labels: DungeonToolLabels;
  result: DungeonCalculation;
  hasErrors: boolean;
  formatNumber: NumberFormatter;
}) {
  const summary = result.summary;

  return (
    <ToolResultCard
      titleId="dungeon-summary-title"
      title={labels.summary}
      titleClassName="site-tool-section-heading"
      className="h-full"
      validation={hasErrors ? <ToolValidationSummary>{labels.validationSummary}</ToolValidationSummary> : undefined}
    >
      <div className="space-y-8">
        <ToolBreakdown
          title={labels.safety}
          titleId="dungeon-safety-breakdown-title"
          layout="rows"
          columns={2}
          firstItemFullWidth
          items={[
            {
              id: 'dungeon-room-levels',
              label: labels.roomLevels,
              value: result.roomLevels.length === 0
                ? labels.none
                : result.roomLevels
                    .map((level) => formatLevel(formatNumber, level, labels))
                    .join(getListSeparator(locale)),
            },
            {
              id: 'dungeon-max-safe-enemy-level',
              label: labels.maxSafeEnemyLevel,
              value: formatLevel(formatNumber, summary.maxSafeEnemyLevel, labels),
            },
            {
              id: 'dungeon-max-safe-room-level',
              label: labels.maxSafeRoomLevel,
              value: formatLevel(formatNumber, summary.maxSafeRoomLevel, labels),
            },
            {
              id: 'dungeon-player-effective-health',
              label: labels.playerEffectiveHealth,
              value: formatWhole(formatNumber, summary.playerEffectiveHealth),
            },
            {
              id: 'dungeon-actual-critical-damage',
              label: labels.actualCriticalDamage,
              value: formatWhole(formatNumber, result.input.destructiveWeaponCriticalDamage),
            },
          ]}
        />

        <ToolBreakdown
          title={labels.experience}
          titleId="dungeon-experience-breakdown-title"
          layout="rows"
          columns={2}
          items={[
            {
              id: 'dungeon-small-average-experience',
              label: labels.smallAverageExperience,
              value: formatWhole(formatNumber, summary.smallEnemyAverageExperience),
            },
            {
              id: 'dungeon-boss-average-experience',
              label: labels.bossAverageExperience,
              value: formatWhole(formatNumber, summary.bossAverageExperience),
            },
            {
              id: 'dungeon-small-average-clicks',
              label: labels.smallAverageClicks,
              value: formatWhole(formatNumber, summary.smallEnemyAverageClicks),
            },
            {
              id: 'dungeon-boss-average-clicks',
              label: labels.bossAverageClicks,
              value: formatWhole(formatNumber, summary.bossAverageClicks),
            },
            {
              id: 'dungeon-small-experience-per-click',
              label: labels.smallExperiencePerClick,
              value: formatDecimal(formatNumber, summary.smallEnemyExperiencePerClick),
            },
            {
              id: 'dungeon-boss-experience-per-click',
              label: labels.bossExperiencePerClick,
              value: formatDecimal(formatNumber, summary.bossExperiencePerClick),
            },
          ]}
        />

        <CritProbabilityList
          labels={labels}
          result={result}
          formatNumber={formatNumber}
        />

        <details className="rounded-md border border-border">
          <summary className="cursor-pointer px-4 py-3 font-medium text-foreground">
            {labels.enemyDetails}
          </summary>
          <div className="space-y-6 border-t border-border p-4">
            <DungeonEnemyTable
              kind="small"
              enemies={result.enemies.small}
              labels={labels}
              formatNumber={formatNumber}
            />
            <DungeonEnemyTable
              kind="boss"
              enemies={result.enemies.boss}
              labels={labels}
              formatNumber={formatNumber}
            />
          </div>
        </details>
      </div>
    </ToolResultCard>
  );
}

export function DungeonCalculator({
  labels,
  locale,
  numberFormatter,
}: {
  labels: DungeonToolLabels;
  locale: Locale;
  numberFormatter?: NumberFormatter;
}) {
  const { errors, result, fillFromShared } = useDungeonTool();
  const hasErrors = Object.keys(errors).length > 0;
  const formatNumber = useMemo(
    () => numberFormatter ?? createNumberFormatter(locale),
    [locale, numberFormatter],
  );

  return (
    <div className="not-prose my-8 space-y-6" data-tool="dungeon">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="site-tool-section-heading">{labels.inputs}</CardTitle>
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
            <div className="grid gap-5 @min-[24rem]:grid-cols-2">
              <DungeonNumberField
                field="enemyLevel"
                id="dungeon-enemy-level"
                label={labels.enemyLevel}
                unit={labels.levelUnit}
                min={DUNGEON_LEVEL_MIN}
                max={DUNGEON_LEVEL_MAX}
                range={labels.levelRange}
                labels={labels}
              />
              <DungeonTypeField id="dungeon-type" labels={labels} />
              <DungeonNumberField
                field="maxHealth"
                id="dungeon-max-health"
                label={labels.maxHealth}
                unit={labels.healthUnit}
                min={0}
                range={labels.nonNegativeRange}
                labels={labels}
              />
              <DungeonNumberField
                field="shield"
                id="dungeon-shield"
                label={labels.shield}
                unit={labels.shieldUnit}
                min={0}
                range={labels.nonNegativeRange}
                labels={labels}
              />
              <DungeonNumberField
                field="destructiveWeaponDamage"
                id="dungeon-destructive-weapon-damage"
                label={labels.destructiveWeaponDamage}
                unit={labels.damageUnit}
                min={1}
                range={labels.positiveRange}
                labels={labels}
              />
              <DungeonNumberField
                field="criticalDamagePercent"
                id="dungeon-critical-damage-percent"
                label={labels.criticalDamagePercent}
                unit={labels.percentUnit}
                min={DUNGEON_CRITICAL_DAMAGE_MIN}
                max={DUNGEON_CRITICAL_DAMAGE_MAX}
                range={labels.criticalDamageRange}
                labels={labels}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        {result ? (
          <DungeonResult
            locale={locale}
            labels={labels}
            result={result}
            hasErrors={hasErrors}
            formatNumber={formatNumber}
          />
        ) : (
          <EmptyDungeonResult labels={labels} hasErrors={hasErrors} />
        )}
      </div>
    </div>
  );
}

export function DungeonToolPage({
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
  labels: DungeonToolLabels;
  header: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <DungeonToolProvider>
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
          idPrefix: 'dungeon-settings',
          render: ({ idPrefix }) => (
            <DungeonSettingsPanel labels={labels} idPrefix={idPrefix} />
          ),
        }}
      >
        {children}
      </ToolPage>
    </DungeonToolProvider>
  );
}

export { dungeonPrefixIds };
