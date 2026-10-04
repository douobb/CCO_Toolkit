'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  ToolInputField,
  ToolPage,
  ToolResultCard,
  ToolPresetButton,
  ToolState,
  ToolValidationSummary,
} from '@/components/tools';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getProgressionLevelDefinition } from '@/data/game/progression';
import {
  calculateSearchReward,
  defaultSearchRewards,
  parseSearchRewardPrice,
  searchRewardInputLimits,
  type SearchRewardCalculation,
  type SearchRewardErrors,
  type SearchRewardField,
  type SearchRewardFormValues,
  type SearchRewardInputs,
} from '@/lib/search-reward';
import { getMarketPriceDefinition, type MarketPriceItemId } from '@/data/game/economy';
import { getSearchRewardPriceDefinition } from '@/lib/game-data-catalog';
import { cn } from '@/lib/cn';
import {
  getDualPrice,
  resolveMarketPrices,
  type ResolvedMarketPrices,
} from '@/lib/market-prices';
import {
  clearToolState,
  defaultSharedUserInputs,
  type SharedUserInputs,
} from '@/lib/storage';
import { useToolStateStorage } from '@/lib/storage/use-tool-state';
import { createNumberFormatter, type NumberFormatter } from '@/lib/number-formatting';
import type { Locale } from '@/lib/i18n';

export interface SearchRewardToolLabels {
  readonly settingsTab: string;
  readonly settingsTitle: string;
  readonly openSettings: string;
  readonly closeSettings: string;
  readonly primaryInputs: string;
  readonly playerLevel: string;
  readonly playerLevelPlaceholder: string;
  readonly playerLevelRange: string;
  readonly playerLevelUnit: string;
  readonly searchCount: string;
  readonly searchCountPlaceholder: string;
  readonly searchCountRange: string;
  readonly searchCountUnit: string;
  readonly prices: string;
  readonly priceUnit: string;
  readonly priceRange: string;
  readonly medicalPartsPrice: string;
  readonly ammoPartsPrice: string;
  readonly militaryAmmoPartsPrice: string;
  readonly reset: string;
  readonly resultTitle: string;
  readonly area: string;
  readonly expectedValue: string;
  readonly expectedValueUnit: string;
  readonly validationSummary: string;
  readonly noResult: string;
  readonly noResultHint: string;
  readonly breakdown: string;
  readonly medicalParts: string;
  readonly ammoParts: string;
  readonly militaryAmmoParts: string;
  readonly ladder: string;
  readonly level: string;
  readonly value: string;
  readonly current: string;
  readonly chartTitle: string;
  readonly chartMetricLabel: string;
  readonly chartMetricQuantity: string;
  readonly chartMetricValue: string;
  readonly chartLegend: string;
  readonly chartLadderPointLabel: string;
  readonly chartCurrentLevel: string;
  readonly chartAxisLevel: string;
  readonly chartAxisQuantity: string;
  readonly chartAxisValue: string;
  readonly chartInteractionHint: string;
  readonly chartNoData: string;
  readonly chartNoDataHint: string;
  readonly validationLevel: string;
  readonly validationCount: string;
  readonly validationPrice: string;
  readonly fillShared: string;
}

type SearchRewardPriceField = 'mtPrice' | 'atpPrice' | 'matpPrice';
type SearchRewardSharedValues = Pick<
  SearchRewardFormValues,
  'playerLevel' | SearchRewardPriceField
>;
type SearchRewardPriceValues = Pick<SearchRewardFormValues, SearchRewardPriceField>;

interface SearchRewardToolState {
  readonly searchCount: string;
  /** 初始值來自共用設定；使用者修改後只保留在本工具。 */
  readonly playerLevel: string;
}

const defaultSearchRewardToolState: SearchRewardToolState = {
  searchCount: '10',
  playerLevel: '1',
};

const searchRewardPriceFields = ['mtPrice', 'atpPrice', 'matpPrice'] as const;

const searchRewardPriceItems = {
  mtPrice: getSearchRewardPriceDefinition('mt').itemId,
  atpPrice: getSearchRewardPriceDefinition('atp').itemId,
  matpPrice: getSearchRewardPriceDefinition('matp').itemId,
} as const satisfies Record<'mtPrice' | 'atpPrice' | 'matpPrice', MarketPriceItemId>;

function getSharedMarketPrice(
  prices: ResolvedMarketPrices,
  itemId: MarketPriceItemId,
) {
  const definition = getMarketPriceDefinition(itemId);
  return String(getDualPrice(prices, itemId, definition.defaultBasisCurrencyId));
}

const searchRewardSharedInputProjector = {
  playerLevel: (snapshot: SharedUserInputs) => {
    const stored = snapshot.progression.skills.find(
      (skill) => skill.id === 'scavenge-skill',
    );
    return String(stored?.level ?? getProgressionLevelDefinition('scavenge-skill').defaultValue);
  },
} satisfies Pick<
  Record<keyof SearchRewardSharedValues, (snapshot: SharedUserInputs) => string>,
  'playerLevel'
>;

export function selectSearchRewardSharedValues(
  snapshot: SharedUserInputs,
): SearchRewardSharedValues {
  const prices = resolveMarketPrices(snapshot);

  return {
    playerLevel: searchRewardSharedInputProjector.playerLevel(snapshot),
    mtPrice: getSharedMarketPrice(prices, searchRewardPriceItems.mtPrice),
    atpPrice: getSharedMarketPrice(prices, searchRewardPriceItems.atpPrice),
    matpPrice: getSharedMarketPrice(prices, searchRewardPriceItems.matpPrice),
  };
}

/** 將工具中的有效物價寫回共用庫，並固定使用工具計算所需的 AI/k 基準。 */
export function updateSearchRewardSharedPrice(
  snapshot: SharedUserInputs,
  field: SearchRewardPriceField,
  amount: number,
): SharedUserInputs {
  const itemId = searchRewardPriceItems[field];
  const definition = getMarketPriceDefinition(itemId);
  const nextPrice = {
    itemId,
    currencyId: definition.defaultBasisCurrencyId,
    amount,
  };
  const pricesWithoutItem = snapshot.economy.prices.filter((price) => price.itemId !== itemId);
  const isDefaultPrice = amount === definition.defaultBasisValue;

  return {
    ...snapshot,
    economy: {
      ...snapshot.economy,
      prices: isDefaultPrice ? pricesWithoutItem : [...pricesWithoutItem, nextPrice],
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSearchRewardToolState(value: unknown): value is SearchRewardToolState {
  if (
    !isRecord(value) ||
    typeof value.searchCount !== 'string' ||
    typeof value.playerLevel !== 'string'
  ) {
    return false;
  }

  const keys = Object.keys(value);
  return (
    keys.length === 2 &&
    keys.every((key) => key === 'searchCount' || key === 'playerLevel')
  );
}

export function createSearchRewardValues(
  toolState: Pick<SearchRewardToolState, 'searchCount' | 'playerLevel'>,
  priceDrafts: SearchRewardPriceValues,
): SearchRewardFormValues {
  return {
    playerLevel: toolState.playerLevel,
    searchCount: toolState.searchCount,
    mtPrice: priceDrafts.mtPrice,
    atpPrice: priceDrafts.atpPrice,
    matpPrice: priceDrafts.matpPrice,
  };
}

interface SearchRewardContextValue {
  readonly values: SearchRewardFormValues;
  readonly errors: SearchRewardErrors;
  readonly inputs: SearchRewardInputs | null;
  readonly result: SearchRewardCalculation['result'];
  readonly setValue: (field: SearchRewardField, value: string) => void;
  readonly fillFromShared: () => void;
  readonly reset: () => void;
}

const SearchRewardToolContext = createContext<SearchRewardContextValue | null>(null);

export function useSearchRewardTool() {
  const context = useContext(SearchRewardToolContext);
  if (!context) {
    throw new Error('SearchRewardTool 元件必須放在 SearchRewardToolProvider 內。');
  }

  return context;
}

export function SearchRewardToolProvider({ children }: { children: ReactNode }) {
  const sharedSnapshot = useSharedUserInputs();
  const sharedStore = useSharedUserInputsStore();
  const [toolState, setToolState] = useToolStateStorage<SearchRewardToolState>(
    'search-reward',
    defaultSearchRewardToolState,
    {
      validate: isSearchRewardToolState,
      initialize: () => ({
        ...defaultSearchRewardToolState,
        playerLevel: selectSearchRewardSharedValues(sharedStore.getSnapshot()).playerLevel,
      }),
    },
  );
  const [priceDrafts, setPriceDrafts] = useState<SearchRewardPriceValues>(() => {
    const defaults = selectSearchRewardSharedValues(defaultSharedUserInputs);
    return {
      mtPrice: defaults.mtPrice,
      atpPrice: defaults.atpPrice,
      matpPrice: defaults.matpPrice,
    };
  });
  const [dirtyPriceFields, setDirtyPriceFields] = useState<
    ReadonlySet<SearchRewardPriceField>
  >(() => new Set());
  const sharedValues = useMemo<SearchRewardSharedValues>(
    () => selectSearchRewardSharedValues(sharedSnapshot),
    [sharedSnapshot],
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;

      setPriceDrafts((current) => {
        let next: SearchRewardPriceValues | null = null;

        for (const field of searchRewardPriceFields) {
          if (!dirtyPriceFields.has(field) && current[field] !== sharedValues[field]) {
            next = { ...(next ?? current), [field]: sharedValues[field] };
          }
        }

        return next ?? current;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [dirtyPriceFields, sharedValues]);

  const setValue = useCallback(
    (field: SearchRewardField, value: string) => {
      if (field === 'searchCount' || field === 'playerLevel') {
        setToolState((current) => ({ ...current, [field]: value }));
        return;
      }

      setPriceDrafts((current) => ({ ...current, [field]: value }));
      setDirtyPriceFields((current) => {
        const next = new Set(current);
        next.add(field);
        return next;
      });

      const parsed = parseSearchRewardPrice(value);
      if (parsed === null) return;

      const accepted = sharedStore.update((current) =>
        updateSearchRewardSharedPrice(current, field, parsed),
      );
      if (!accepted) return;

      setDirtyPriceFields((current) => {
        if (!current.has(field)) return current;
        const next = new Set(current);
        next.delete(field);
        return next;
      });
    },
    [setToolState, sharedStore],
  );

  const fillFromShared = useCallback(() => {
    const latestSharedValues = selectSearchRewardSharedValues(sharedStore.getSnapshot());
    setToolState((current) => ({
      ...current,
      playerLevel: latestSharedValues.playerLevel,
    }));
    setPriceDrafts({
      mtPrice: latestSharedValues.mtPrice,
      atpPrice: latestSharedValues.atpPrice,
      matpPrice: latestSharedValues.matpPrice,
    });
    setDirtyPriceFields(new Set());
  }, [setDirtyPriceFields, setPriceDrafts, setToolState, sharedStore]);

  const reset = useCallback(() => {
    clearToolState('search-reward');
    const latestSharedValues = selectSearchRewardSharedValues(sharedStore.getSnapshot());
    setToolState({
      ...defaultSearchRewardToolState,
      playerLevel: latestSharedValues.playerLevel,
    });
    setPriceDrafts({
      mtPrice: latestSharedValues.mtPrice,
      atpPrice: latestSharedValues.atpPrice,
      matpPrice: latestSharedValues.matpPrice,
    });
    setDirtyPriceFields(new Set());
  }, [setDirtyPriceFields, setPriceDrafts, setToolState, sharedStore]);

  const values = useMemo<SearchRewardFormValues>(
    () => createSearchRewardValues(toolState, priceDrafts),
    [priceDrafts, toolState],
  );

  const calculation = useMemo(() => calculateSearchReward(defaultSearchRewards, values), [values]);

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
    <SearchRewardToolContext.Provider value={contextValue}>
      {children}
    </SearchRewardToolContext.Provider>
  );
}

function formatTemplate(template: string, replacements: Record<string, number>) {
  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.replace(`\${${key}}`, String(value)),
    template,
  );
}

function getErrorMessage(
  field: SearchRewardField,
  errors: SearchRewardErrors,
  labels: SearchRewardToolLabels,
) {
  const error = errors[field];
  if (error === 'level') return labels.validationLevel;
  if (error === 'count') return labels.validationCount;
  if (error === 'price') return labels.validationPrice;
  return undefined;
}

function SearchRewardPriceField({
  field,
  id,
  label,
  labels,
}: {
  field: SearchRewardPriceField;
  id: string;
  label: string;
  labels: SearchRewardToolLabels;
}) {
  const { values, errors, setValue } = useSearchRewardTool();
  const errorMessage = getErrorMessage(field, errors, labels);

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
      error={errorMessage}
      range={labels.priceRange}
      unit={labels.priceUnit}
    />
  );
}

export function SearchRewardSettingsPanel({
  labels,
  idPrefix = 'search-reward-settings',
}: {
  labels: SearchRewardToolLabels;
  idPrefix?: string;
}) {
  const { reset } = useSearchRewardTool();

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div>
        <h2 className="font-semibold text-foreground">{labels.settingsTitle}</h2>
      </div>
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">{labels.prices}</h3>
        <SearchRewardPriceField
          field="mtPrice"
          id={`${idPrefix}-mt-price`}
          label={labels.medicalPartsPrice}
          labels={labels}
        />
        <SearchRewardPriceField
          field="atpPrice"
          id={`${idPrefix}-atp-price`}
          label={labels.ammoPartsPrice}
          labels={labels}
        />
        <SearchRewardPriceField
          field="matpPrice"
          id={`${idPrefix}-matp-price`}
          label={labels.militaryAmmoPartsPrice}
          labels={labels}
        />
      </div>
      <div className="mt-auto space-y-3 border-t border-border pt-4">
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

function PrimaryInputField({
  field,
  id,
  label,
  placeholder,
  range,
  unit,
  labels,
}: {
  field: 'playerLevel' | 'searchCount';
  id: string;
  label: string;
  placeholder: string;
  range: string;
  unit: string;
  labels: SearchRewardToolLabels;
}) {
  const { values, errors, setValue } = useSearchRewardTool();
  const errorMessage = getErrorMessage(field, errors, labels);
  const limit = searchRewardInputLimits[field];

  return (
    <ToolInputField
      id={id}
      label={label}
      type="number"
      inputMode="numeric"
      min={limit.min}
      max={limit.max}
      step="1"
      value={values[field]}
      placeholder={placeholder}
      onChange={(event) => setValue(field, event.target.value)}
      range={range}
      error={errorMessage}
      unit={unit}
    />
  );
}

export function SearchRewardCalculator({
  labels,
  locale,
  numberFormatter,
}: {
  labels: SearchRewardToolLabels;
  locale: Locale;
  numberFormatter?: NumberFormatter;
}) {
  const { errors, inputs, result, fillFromShared } = useSearchRewardTool();
  const optimalArea = result?.optimalArea;
  const hasErrors = Object.keys(errors).length > 0;
  const formatNumber = useMemo(
    () => numberFormatter ?? createNumberFormatter(locale),
    [locale, numberFormatter],
  );
  const resultCardRef = useRef<HTMLDivElement>(null);
  const [resultCardHeight, setResultCardHeight] = useState<number | null>(null);

  useEffect(() => {
    const element = resultCardRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(([entry]) => {
      const nextHeight = Math.ceil(entry.contentRect.height);
      if (nextHeight <= 0) return;

      setResultCardHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight,
      );
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="not-prose my-8 space-y-6" data-tool="search-reward">
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
        <CardContent className="@container space-y-6">
          <div className="grid gap-5 @min-[24rem]:grid-cols-2">
            <PrimaryInputField
              field="playerLevel"
              id="search-reward-player-level"
              label={labels.playerLevel}
              placeholder={labels.playerLevelPlaceholder}
              range={labels.playerLevelRange}
              unit={labels.playerLevelUnit}
              labels={labels}
            />
            <PrimaryInputField
              field="searchCount"
              id="search-reward-count"
              label={labels.searchCount}
              placeholder={labels.searchCountPlaceholder}
              range={labels.searchCountRange}
              unit={labels.searchCountUnit}
              labels={labels}
            />
          </div>
        </CardContent>
      </Card>

      <div className="@container">
        <div className="grid gap-6 @min-[48rem]:grid-cols-2 @min-[48rem]:items-stretch">
          <div ref={resultCardRef} className="min-w-0 @min-[48rem]:h-full">
            <ToolResultCard
              titleId="search-reward-result-title"
              title={labels.resultTitle}
              titleClassName="site-tool-section-heading"
              className="@min-[48rem]:flex @min-[48rem]:h-full @min-[48rem]:min-h-0 @min-[48rem]:flex-col"
              contentClassName="@min-[48rem]:flex-1"
              validation={
                hasErrors ? (
                  <ToolValidationSummary>{labels.validationSummary}</ToolValidationSummary>
                ) : undefined
              }
            >
              {optimalArea && inputs ? (
                <div className="space-y-6">
                  <div className="rounded-[var(--cco-card-radius)] border border-border bg-muted/40 p-5">
                    <p className="text-sm font-medium text-muted-foreground">
                      {formatTemplate(labels.area, { level: optimalArea.level })}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">{labels.expectedValue}</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                      {formatNumber(optimalArea.totalExpectedValue, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      <span className="ml-2 text-sm font-medium text-muted-foreground">
                        {labels.expectedValueUnit}
                      </span>
                    </p>
                  </div>
                  <ToolBreakdown
                    title={labels.breakdown}
                    titleId="search-reward-breakdown-title"
                    layout="rows"
                    items={[
                      {
                        id: 'medical-parts',
                        label: labels.medicalParts,
                        value: formatNumber(optimalArea.expectedMtQty, {
                          maximumFractionDigits: 2,
                        }),
                      },
                      {
                        id: 'ammo-parts',
                        label: labels.ammoParts,
                        value: formatNumber(optimalArea.expectedAtpQty, {
                          maximumFractionDigits: 2,
                        }),
                      },
                      {
                        id: 'military-ammo-parts',
                        label: labels.militaryAmmoParts,
                        value: formatNumber(optimalArea.expectedMatpQty, {
                          maximumFractionDigits: 2,
                        }),
                      },
                    ]}
                  />
                </div>
              ) : (
                <ToolState
                  variant={hasErrors ? 'error' : 'empty'}
                  title={hasErrors ? labels.validationSummary : labels.noResult}
                  description={!hasErrors ? labels.noResultHint : undefined}
                />
              )}
            </ToolResultCard>
          </div>

          {result ? (
            <div className="min-w-0 @min-[48rem]:relative @min-[48rem]:h-full">
              <Card
                aria-labelledby="search-reward-ladder-title"
                style={
                  resultCardHeight === null
                    ? undefined
                    : { height: `${resultCardHeight}px` }
                }
                className="flex min-h-0 flex-col overflow-hidden @min-[48rem]:absolute @min-[48rem]:inset-0"
              >
                <CardHeader>
                  <CardTitle id="search-reward-ladder-title">{labels.ladder}</CardTitle>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
                    <table className="w-full min-w-0 text-left text-sm">
                      <caption className="sr-only">{labels.ladder}</caption>
                      <thead className="border-b border-border text-muted-foreground">
                        <tr>
                          <th scope="col" className="px-3 py-2 font-medium">{labels.level}</th>
                          <th scope="col" className="px-3 py-2 font-medium">{labels.value}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.ladder.map((entry) => (
                          <tr
                            key={entry.level}
                            className={cn(
                              'border-b border-border last:border-0',
                              entry.isCurrentOptimal && 'bg-primary/10',
                            )}
                          >
                            <th
                              scope="row"
                              className={cn(
                                'px-3 py-2 font-medium text-foreground',
                                entry.isCurrentOptimal && 'font-bold text-primary',
                              )}
                            >
                              {formatTemplate(labels.area, { level: entry.level })}
                              {entry.isCurrentOptimal ? (
                                <span className="sr-only">（{labels.current}）</span>
                              ) : null}
                            </th>
                            <td className="px-3 py-2 text-muted-foreground">
                              {formatNumber(entry.expectedValue, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{' '}
                              {labels.expectedValueUnit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </div>

    </div>
  );
}

export function SearchRewardToolPage({
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
  labels: SearchRewardToolLabels;
  header: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SearchRewardToolProvider>
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
          idPrefix: 'search-reward-settings',
          render: ({ idPrefix }) => (
            <SearchRewardSettingsPanel labels={labels} idPrefix={idPrefix} />
          ),
        }}
      >
        {children}
      </ToolPage>
    </SearchRewardToolProvider>
  );
}
