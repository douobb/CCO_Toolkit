'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';

import type { ContextualDocsPageProps } from '@/components/context';
import {
  getToolFieldIds,
  ToolBreakdown,
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
  backpackMaterialCatalog,
  backpackTierCatalog,
} from '@/data/game/backpack-progression';
import {
  calculateBackpackPlanner,
  getBackpackPlannerItemCatalog,
  type BackpackPlannerItemId,
  type BackpackPlannerInputs,
  type BackpackPlannerResult,
} from '@/lib/backpack-planner';
import {
  createDefaultBackpackPlannerToolState,
  isBackpackPlannerToolState,
  type BackpackPlannerToolState,
} from '@/lib/backpack-planner-state';
import type { Locale } from '@/lib/i18n';
import { createNumberFormatter, type NumberFormatter } from '@/lib/number-formatting';
import { useToolStateStorage } from '@/lib/storage/use-tool-state';

export interface BackpackPlannerToolLabels {
  readonly primaryInputs: string;
  readonly targetTier: string;
  readonly inventoryTitle: string;
  readonly backpacks: string;
  readonly materials: string;
  readonly quantityRange: string;
  readonly quantityUnit: string;
  readonly reset: string;
  readonly validationSummary: string;
  readonly validationTarget: string;
  readonly validationQuantity: string;
  readonly noResult: string;
  readonly noResultHint: string;
  readonly results: string;
  readonly progress: string;
  readonly progressPercent: string;
  readonly item: string;
  readonly itemEquivalent: string;
  readonly shareOfTotal: string;
  readonly emptyInventory: string;
  readonly techScrapUnit: string;
}

export interface BackpackPlannerFormValues {
  readonly targetTierId: string;
  readonly quantities: Readonly<Record<string, string>>;
}

export interface BackpackPlannerErrors {
  readonly targetTierId?: 'target';
  readonly quantities?: Readonly<Record<string, 'quantity'>>;
}

const backpackPlannerItemCatalog = getBackpackPlannerItemCatalog();

const defaultBackpackPlannerToolState = createDefaultBackpackPlannerToolState();

function parseQuantity(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return 0;
  if (!/^\d+$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function parseBackpackPlannerValues(values: BackpackPlannerFormValues): {
  readonly errors: BackpackPlannerErrors;
  readonly inputs: BackpackPlannerInputs | null;
} {
  const errors: {
    targetTierId?: 'target';
    quantities?: Record<string, 'quantity'>;
  } = {};
  const quantities: Record<string, number> = {};

  if (!backpackTierCatalog.some((tier) => tier.id === values.targetTierId)) {
    errors.targetTierId = 'target';
  }

  const quantityErrors: Record<string, 'quantity'> = {};
  for (const item of backpackPlannerItemCatalog) {
    const quantity = parseQuantity(values.quantities[item.id] ?? '');
    if (quantity === null) quantityErrors[item.id] = 'quantity';
    else quantities[item.id] = quantity;
  }
  if (Object.keys(quantityErrors).length > 0) errors.quantities = quantityErrors;

  if (Object.keys(errors).length > 0) return { errors, inputs: null };

  return {
    errors,
    inputs: {
      targetTierId: values.targetTierId,
      quantities,
    },
  };
}

export function calculateBackpackPlannerTool(values: BackpackPlannerFormValues): {
  readonly errors: BackpackPlannerErrors;
  readonly inputs: BackpackPlannerInputs | null;
  readonly result: BackpackPlannerResult | null;
} {
  const parsed = parseBackpackPlannerValues(values);
  return {
    errors: parsed.errors,
    inputs: parsed.inputs,
    result: parsed.inputs ? calculateBackpackPlanner(parsed.inputs) : null,
  };
}

interface BackpackPlannerContextValue {
  readonly values: BackpackPlannerToolState;
  readonly errors: BackpackPlannerErrors;
  readonly inputs: BackpackPlannerInputs | null;
  readonly result: BackpackPlannerResult | null;
  readonly setTargetTier: (value: string) => void;
  readonly setQuantity: (id: string, value: string) => void;
  readonly reset: () => void;
}

const BackpackPlannerToolContext = createContext<BackpackPlannerContextValue | null>(null);

function useBackpackPlannerTool() {
  const context = useContext(BackpackPlannerToolContext);
  if (!context) {
    throw new Error('BackpackPlanner 元件必須放在 BackpackPlannerToolProvider 內。');
  }

  return context;
}

export function BackpackPlannerToolProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useToolStateStorage<BackpackPlannerToolState>(
    'backpack-planner',
    defaultBackpackPlannerToolState,
    { validate: isBackpackPlannerToolState },
  );

  const setTargetTier = useCallback((value: string) => {
    setValues((current) => ({ ...current, targetTierId: value }));
  }, [setValues]);

  const setQuantity = useCallback((id: string, value: string) => {
    setValues((current) => ({
      ...current,
      quantities: { ...current.quantities, [id]: value },
    }));
  }, [setValues]);

  const reset = useCallback(() => {
    setValues((current) => ({
      ...current,
      targetTierId: defaultBackpackPlannerToolState.targetTierId,
    }));
  }, [setValues]);

  const calculation = useMemo(() => calculateBackpackPlannerTool(values), [values]);
  const contextValue = useMemo(
    () => ({
      values,
      errors: calculation.errors,
      inputs: calculation.inputs,
      result: calculation.result,
      setTargetTier,
      setQuantity,
      reset,
    }),
    [calculation, reset, setQuantity, setTargetTier, values],
  );

  return (
    <BackpackPlannerToolContext.Provider value={contextValue}>
      {children}
    </BackpackPlannerToolContext.Provider>
  );
}

function getItemLabel(id: string, locale: Locale): string {
  const tier = backpackTierCatalog.find((item) => item.id === id);
  if (tier) return tier.labels[locale];

  const material = backpackMaterialCatalog.find((item) => item.id === id);
  return material?.labels[locale] ?? id;
}

function BackpackTargetField({
  labels,
  locale,
}: {
  readonly labels: BackpackPlannerToolLabels;
  readonly locale: Locale;
}) {
  const { values, errors, setTargetTier } = useBackpackPlannerTool();
  const id = 'backpack-planner-target-tier';
  const fieldIds = getToolFieldIds(id, { error: Boolean(errors.targetTierId) });

  return (
    <ToolField
      id={id}
      label={labels.targetTier}
      error={errors.targetTierId ? labels.validationTarget : undefined}
    >
      <select
        id={id}
        value={values.targetTierId}
        onChange={(event) => setTargetTier(event.target.value)}
        aria-invalid={errors.targetTierId ? true : undefined}
        aria-describedby={fieldIds.describedBy}
        className="flex h-[var(--cco-input-height)] w-full min-w-0 rounded-[var(--cco-input-radius)] border border-input bg-background px-[var(--cco-input-padding-x)] py-[var(--cco-input-padding-y)] text-base text-foreground outline-none transition-[color,box-shadow] duration-[var(--cco-duration-fast)] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 md:text-sm"
      >
        {backpackTierCatalog.map((tier) => (
          <option key={tier.id} value={tier.id}>
            {tier.labels[locale]}
          </option>
        ))}
      </select>
    </ToolField>
  );
}

function BackpackQuantityField({
  id,
  itemId,
  label,
  labels,
}: {
  readonly id: string;
  readonly itemId: BackpackPlannerItemId;
  readonly label: string;
  readonly labels: BackpackPlannerToolLabels;
}) {
  const { values, errors, setQuantity } = useBackpackPlannerTool();
  const error = errors.quantities?.[itemId];

  return (
    <ToolInputField
      id={id}
      label={label}
      type="number"
      inputMode="numeric"
      min={0}
      step="1"
      value={values.quantities[itemId] ?? ''}
      onChange={(event) => setQuantity(itemId, event.target.value)}
      error={error ? labels.validationQuantity : undefined}
      range={labels.quantityRange}
      unit={labels.quantityUnit}
    />
  );
}

function formatDecimal(formatNumber: NumberFormatter, value: number) {
  return formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function BackpackPlannerResultTable({
  labels,
  locale,
  result,
  formatNumber,
}: {
  readonly labels: BackpackPlannerToolLabels;
  readonly locale: Locale;
  readonly result: BackpackPlannerResult;
  readonly formatNumber: NumberFormatter;
}) {
  const ownedItems = result.items.filter((item) => item.quantity > 0);

  return (
    <div
      data-result-layout="table"
      className="overflow-x-auto rounded-[var(--cco-card-radius)] border border-border"
    >
      <table className="w-full min-w-[30rem] table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col className="w-[42%]" />
          <col className="w-[34%]" />
          <col className="w-[24%]" />
        </colgroup>
        <caption className="sr-only">{labels.inventoryTitle}</caption>
        <thead className="bg-muted/40 text-muted-foreground">
          <tr className="border-b border-border">
            <th scope="col" className="px-4 py-3 font-medium">{labels.item}</th>
            <th scope="col" className="px-4 py-3 font-medium">{labels.itemEquivalent}</th>
            <th scope="col" className="px-4 py-3 font-medium">{labels.shareOfTotal}</th>
          </tr>
        </thead>
        <tbody>
          {ownedItems.length > 0 ? ownedItems.map((item) => {
            const share = result.ownedTechScrapEquivalent > 0
              ? item.techScrapEquivalent / result.ownedTechScrapEquivalent * 100
              : 0;

            return (
              <tr key={item.id} className="border-b border-border last:border-b-0">
                <th scope="row" className="px-4 py-3 font-medium text-foreground">
                  {getItemLabel(item.id, locale)}
                </th>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {formatDecimal(formatNumber, item.techScrapEquivalent)} {labels.techScrapUnit}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {formatDecimal(formatNumber, share)}%
                </td>
              </tr>
            );
          }) : (
            <tr>
              <td colSpan={3} className="px-4 py-4 text-sm text-muted-foreground">
                {labels.emptyInventory}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function EmptyBackpackPlannerResult({
  labels,
  hasErrors,
}: {
  readonly labels: BackpackPlannerToolLabels;
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

export function BackpackPlannerCalculator({
  labels,
  locale,
  numberFormatter,
}: {
  readonly labels: BackpackPlannerToolLabels;
  readonly locale: Locale;
  readonly numberFormatter?: NumberFormatter;
}) {
  const { errors, result, reset } = useBackpackPlannerTool();
  const formatNumber = useMemo(
    () => numberFormatter ?? createNumberFormatter(locale),
    [locale, numberFormatter],
  );
  const hasErrors = Object.keys(errors).length > 0;
  const targetLabel = result ? getItemLabel(result.targetTierId, locale) : '';

  return (
    <div className="not-prose my-8 space-y-6" data-tool="backpack-planner">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="site-tool-section-heading">{labels.primaryInputs}</CardTitle>
            </div>
            <ToolPrimaryActions
              onReset={reset}
              resetLabel={labels.reset}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="@container">
            <div className="grid gap-5 @min-[24rem]:grid-cols-2 @min-[40rem]:grid-cols-3">
              <BackpackTargetField labels={labels} locale={locale} />
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-medium text-foreground">{labels.inventoryTitle}</h3>
            </div>

            <div>
              <h4 className="text-sm font-medium text-foreground">{labels.backpacks}</h4>
              <div className="mt-4 @container">
                <div className="grid gap-5 @min-[24rem]:grid-cols-2 @min-[40rem]:grid-cols-3">
                  {backpackTierCatalog.map((tier) => (
                    <BackpackQuantityField
                      key={tier.id}
                      id={`backpack-planner-${tier.id}`}
                      itemId={tier.id as BackpackPlannerItemId}
                      label={tier.labels[locale]}
                      labels={labels}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-foreground">{labels.materials}</h4>
              <div className="mt-4 @container">
                <div className="grid gap-5 @min-[24rem]:grid-cols-2 @min-[40rem]:grid-cols-3">
                  {backpackMaterialCatalog.map((material) => (
                    <BackpackQuantityField
                      key={material.id}
                      id={`backpack-planner-${material.id}`}
                      itemId={material.id as BackpackPlannerItemId}
                      label={material.labels[locale]}
                      labels={labels}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      <div>
        <div className="mb-4">
          <h2 className="site-tool-section-heading text-xl font-semibold tracking-tight text-foreground">{labels.results}</h2>
        </div>
        {result ? (
          <div className="space-y-5">
            <ToolBreakdown
              title={targetLabel}
              titleId="backpack-planner-result-summary"
              layout="rows"
              columns={2}
              items={[
                {
                  id: 'progress',
                  label: labels.progress,
                  value: `${formatDecimal(formatNumber, result.ownedTechScrapEquivalent)} / ${formatDecimal(formatNumber, result.targetTechScrapEquivalent)} ${labels.techScrapUnit}`,
                },
                {
                  id: 'progress-percent',
                  label: labels.progressPercent,
                  value: `${formatDecimal(formatNumber, result.progressPercent)}%`,
                },
              ]}
            />
            <BackpackPlannerResultTable
              labels={labels}
              locale={locale}
              result={result}
              formatNumber={formatNumber}
            />
          </div>
        ) : (
          <EmptyBackpackPlannerResult labels={labels} hasErrors={hasErrors} />
        )}
      </div>
    </div>
  );
}

export function BackpackPlannerToolPage({
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
  readonly labels: BackpackPlannerToolLabels;
  readonly locale: Locale;
  readonly header: ReactNode;
  readonly headerActions?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <BackpackPlannerToolProvider>
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
    </BackpackPlannerToolProvider>
  );
}
