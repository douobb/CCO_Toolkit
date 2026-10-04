'use client';

import { RotateCcw } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@/components/ui';
import {
  economyDataSet,
  getEconomyCurrencyDefinition,
  getEconomyItemDefinition,
  marketCacheRateCatalog,
  marketPriceCatalog,
} from '@/data/game/economy';
import {
  SHARED_CRITICAL_DAMAGE_PERCENT_MAX,
  SHARED_CRITICAL_DAMAGE_PERCENT_MIN,
} from '@/lib/shared-user-inputs';
import {
  convertMarketPriceAmount,
  formatMarketPriceAmount,
  resolveMarketPrices,
  type MarketCurrency,
} from '@/lib/market-prices';
import { progressionLevelCatalog } from '@/data/game/progression';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/i18n';

import { useSharedUserInputs, useSharedUserInputsStore } from './shared-user-inputs-react';
import {
  createDefaultSharedPriceDrafts,
  createSharedUserInputsDraft,
  getSharedLevelInputMaximum,
  validateSharedUserInputsDraft,
  type SharedPriceDraft,
  type SharedUserInputsDraft,
  type SharedUserInputsDraftErrors,
} from './shared-user-inputs-form';

export interface SharedUserInputsManagerLabels {
  browserOnlyTitle: string;
  browserOnlyDescription: string;
  progressionTitle: string;
  progressionDescription: string;
  rangeHint: string;
  nonNegativeRange: string;
  priceRange: string;
  positiveRange: string;
  levelUnit: string;
  economyTitle: string;
  economyDescription: string;
  marketPricesTitle: string;
  marketPricesDescription: string;
  marketPriceDisplayCurrency: string;
  restorePrices: string;
  exchangeRatesTitle: string;
  cacheRatesTitle: string;
  equipmentTitle: string;
  equipmentDescription: string;
  bargainPercent: string;
  maxHealth: string;
  armor: string;
  destructiveWeaponDamage: string;
  criticalDamagePercent: string;
  damageReductionPercent: string;
  percentUnit: string;
  healthUnit: string;
  armorUnit: string;
  damageUnit: string;
  resetTitle: string;
  resetDescription: string;
  reset: string;
  validationSummary: string;
  invalidValue: string;
}

function formatTemplate(
  template: string,
  replacements: Record<string, string | number>,
): string {
  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.replace(`\${${key}}`, String(value)),
    template,
  );
}

function Field({
  id,
  label,
  range,
  error,
  children,
}: {
  id: string;
  label: string;
  range?: string;
  error?: string;
  children: ReactNode;
}) {
  const rangeId = range ? `${id}-range` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {range ? (
          <span
            id={rangeId}
            className="text-right text-xs leading-5 text-muted-foreground"
          >
            {range}
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-xs leading-5 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function getFieldDescribedBy(id: string, error?: string): string | undefined {
  return (
    [`${id}-range`, error ? `${id}-error` : undefined].filter(Boolean).join(' ') || undefined
  );
}

const marketPriceDisplayCurrencies: readonly MarketCurrency[] = ['ai', 'btc'];

/** draft 匯率無效時回到目前 snapshot 的 resolved 值，避免單位與數值不一致。 */
function getDraftBtcPerAi(
  draft: SharedUserInputsDraft,
  fallbackBtcPerAi: number,
): number {
  const exchangeRate = draft.exchangeRates.find((rate) => rate.id === 'btc-per-ai');
  const value = Number(exchangeRate?.value);
  return Number.isSafeInteger(value) && value > 0 ? value : fallbackBtcPerAi;
}

function getDisplayedMarketPriceAmount(
  price: SharedPriceDraft,
  displayCurrency: MarketCurrency,
  btcPerAi: number,
): string {
  const basisCurrency = price.currencyId === 'ai' || price.currencyId === 'btc'
    ? price.currencyId
    : undefined;

  if (basisCurrency === undefined || basisCurrency === displayCurrency) {
    return price.amount;
  }

  const amount = Number(price.amount);
  if (price.amount.trim() === '' || !Number.isFinite(amount) || amount < 0) {
    return price.amount;
  }

  const converted = convertMarketPriceAmount(
    amount,
    basisCurrency,
    displayCurrency,
    btcPerAi,
  );
  return Number.isFinite(converted)
    ? formatMarketPriceAmount(converted)
    : price.amount;
}

function getDisplayedMarketPriceUnit(
  unit: string,
  displayCurrency: MarketCurrency,
): string {
  const separatorIndex = unit.indexOf('/');
  if (separatorIndex === -1) return unit;

  return `${getEconomyCurrencyDefinition(displayCurrency).code}${unit.slice(separatorIndex)}`;
}

type InputWithUnitProps = Omit<ComponentProps<typeof Input>, 'id'> & {
  id: string;
  unit: string;
};

function InputWithUnit({
  id,
  unit,
  className,
  'aria-describedby': ariaDescribedBy,
  ...props
}: InputWithUnitProps) {
  const unitId = `${id}-unit`;
  const describedBy = [ariaDescribedBy, unitId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="relative">
      <Input
        {...props}
        id={id}
        className={cn('pr-20', className)}
        aria-describedby={describedBy}
      />
      <span
        id={unitId}
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
      >
        {unit}
      </span>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="mt-2 leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function SharedUserInputsManager({
  labels,
  locale,
}: {
  labels: SharedUserInputsManagerLabels;
  locale: Locale;
}) {
  const snapshot = useSharedUserInputs();
  const store = useSharedUserInputsStore();
  const [draft, setDraft] = useState(() => createSharedUserInputsDraft(snapshot));
  const [errors, setErrors] = useState<SharedUserInputsDraftErrors>({});
  const [marketPriceDisplayCurrency, setMarketPriceDisplayCurrency] =
    useState<MarketCurrency>('ai');
  const lastSnapshot = useRef(snapshot);
  const resolvedBtcPerAi = resolveMarketPrices(snapshot).btcPerAi;

  useEffect(() => {
    if (snapshot === lastSnapshot.current) return;
    lastSnapshot.current = snapshot;
    setDraft(createSharedUserInputsDraft(snapshot));
    setErrors({});
  }, [snapshot]);

  const commit = useCallback(
    (next: SharedUserInputsDraft) => {
      setDraft(next);
      const result = validateSharedUserInputsDraft(next);
      if (!result.success) {
        setErrors(result.errors);
        return;
      }

      setErrors({});
      store.replace(result.value);
    },
    [store],
  );

  const restoreDefaultPrices = useCallback(() => {
    commit({
      ...draft,
      prices: createDefaultSharedPriceDrafts(),
    });
  }, [commit, draft]);

  const fieldError = (path: string) =>
    errors[path] ? labels.invalidValue : undefined;
  const draftBtcPerAi = getDraftBtcPerAi(draft, resolvedBtcPerAi);

  let skillIndex = 0;

  return (
    <div className="space-y-6" data-testid="shared-user-inputs-manager">
      <div
        className="rounded-[var(--cco-card-radius)] border border-border bg-muted/40 p-5"
        role="note"
      >
        <h2 className="font-semibold text-foreground">{labels.browserOnlyTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {labels.browserOnlyDescription}
        </p>
      </div>

      {Object.keys(errors).length > 0 ? (
        <p
          role="alert"
          className="rounded-[var(--cco-card-radius)] border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {labels.validationSummary}
        </p>
      ) : null}

      <Section title={labels.progressionTitle} description={labels.progressionDescription}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {draft.levels.map((level, index) => {
            const definition = progressionLevelCatalog.find((item) => item.id === level.id);
            if (!definition) return null;

            const isPlayerLevel = level.id === 'level';
            const path = isPlayerLevel
              ? 'progression.player.level'
              : `progression.skills.${skillIndex++}.level`;
            const id = `shared-level-${level.id}`;
            const maximum = getSharedLevelInputMaximum(draft, level.id);
            const range = formatTemplate(labels.rangeHint, {
              min: definition.range.min,
              max: maximum,
            });

            return (
              <Field
                key={level.id}
                id={id}
                label={definition.labels[locale]}
                range={range}
                error={fieldError(path)}
              >
                <InputWithUnit
                  id={id}
                  type="number"
                  inputMode="numeric"
                  min={definition.range.min}
                  max={maximum}
                  step={definition.range.step}
                  unit={labels.levelUnit}
                  value={level.value}
                  onChange={(event) =>
                    commit({
                      ...draft,
                      levels: draft.levels.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, value: event.target.value }
                          : item,
                      ),
                    })
                  }
                  aria-invalid={Boolean(fieldError(path))}
                  aria-describedby={getFieldDescribedBy(id, fieldError(path))}
                />
              </Field>
            );
          })}
        </div>
      </Section>

      <Section title={labels.equipmentTitle} description={labels.equipmentDescription}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            id="shared-equipment-bargain-percent"
            label={labels.bargainPercent}
            range={formatTemplate(labels.rangeHint, { min: 0, max: 40 })}
            error={fieldError('equipment.bargainPercent')}
          >
            <InputWithUnit
              id="shared-equipment-bargain-percent"
              type="number"
              inputMode="numeric"
              min="0"
              max="40"
              step="1"
              unit={labels.percentUnit}
              value={draft.equipment.bargainPercent}
              onChange={(event) =>
                commit({
                  ...draft,
                  equipment: {
                    ...draft.equipment,
                    bargainPercent: event.target.value,
                  },
                })
              }
              aria-invalid={Boolean(fieldError('equipment.bargainPercent'))}
              aria-describedby={getFieldDescribedBy(
                'shared-equipment-bargain-percent',
                fieldError('equipment.bargainPercent'),
              )}
            />
          </Field>

          <Field
            id="shared-equipment-max-health"
            label={labels.maxHealth}
            range={labels.nonNegativeRange}
            error={fieldError('equipment.maxHealth')}
          >
            <InputWithUnit
              id="shared-equipment-max-health"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              unit={labels.healthUnit}
              value={draft.equipment.maxHealth}
              onChange={(event) =>
                commit({
                  ...draft,
                  equipment: { ...draft.equipment, maxHealth: event.target.value },
                })
              }
              aria-invalid={Boolean(fieldError('equipment.maxHealth'))}
              aria-describedby={getFieldDescribedBy(
                'shared-equipment-max-health',
                fieldError('equipment.maxHealth'),
              )}
            />
          </Field>

          <Field
            id="shared-equipment-armor"
            label={labels.armor}
            range={labels.nonNegativeRange}
            error={fieldError('equipment.armor')}
          >
            <InputWithUnit
              id="shared-equipment-armor"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              unit={labels.armorUnit}
              value={draft.equipment.armor}
              onChange={(event) =>
                commit({
                  ...draft,
                  equipment: { ...draft.equipment, armor: event.target.value },
                })
              }
              aria-invalid={Boolean(fieldError('equipment.armor'))}
              aria-describedby={getFieldDescribedBy(
                'shared-equipment-armor',
                fieldError('equipment.armor'),
              )}
            />
          </Field>

          <Field
            id="shared-equipment-destructive-weapon-damage"
            label={labels.destructiveWeaponDamage}
            range={labels.positiveRange}
            error={fieldError('equipment.destructiveWeaponDamage')}
          >
            <InputWithUnit
              id="shared-equipment-destructive-weapon-damage"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              unit={labels.damageUnit}
              value={draft.equipment.destructiveWeaponDamage}
              onChange={(event) =>
                commit({
                  ...draft,
                  equipment: {
                    ...draft.equipment,
                    destructiveWeaponDamage: event.target.value,
                  },
                })
              }
              aria-invalid={Boolean(fieldError('equipment.destructiveWeaponDamage'))}
              aria-describedby={getFieldDescribedBy(
                'shared-equipment-destructive-weapon-damage',
                fieldError('equipment.destructiveWeaponDamage'),
              )}
            />
          </Field>

          <Field
            id="shared-equipment-critical-damage-percent"
            label={labels.criticalDamagePercent}
            range={formatTemplate(labels.rangeHint, {
              min: SHARED_CRITICAL_DAMAGE_PERCENT_MIN,
              max: SHARED_CRITICAL_DAMAGE_PERCENT_MAX,
            })}
            error={fieldError('equipment.criticalDamagePercent')}
          >
            <InputWithUnit
              id="shared-equipment-critical-damage-percent"
              type="number"
              inputMode="numeric"
              min={String(SHARED_CRITICAL_DAMAGE_PERCENT_MIN)}
              max={String(SHARED_CRITICAL_DAMAGE_PERCENT_MAX)}
              step="1"
              unit={labels.percentUnit}
              value={draft.equipment.criticalDamagePercent}
              onChange={(event) =>
                commit({
                  ...draft,
                  equipment: {
                    ...draft.equipment,
                    criticalDamagePercent: event.target.value,
                  },
                })
              }
              aria-invalid={Boolean(fieldError('equipment.criticalDamagePercent'))}
              aria-describedby={getFieldDescribedBy(
                'shared-equipment-critical-damage-percent',
                fieldError('equipment.criticalDamagePercent'),
              )}
            />
          </Field>

          <Field
            id="shared-equipment-damage-reduction-percent"
            label={labels.damageReductionPercent}
            range={formatTemplate(labels.rangeHint, { min: 0, max: 100 })}
            error={fieldError('equipment.damageReductionPercent')}
          >
            <InputWithUnit
              id="shared-equipment-damage-reduction-percent"
              type="number"
              inputMode="numeric"
              min="0"
              max="100"
              step="1"
              unit={labels.percentUnit}
              value={draft.equipment.damageReductionPercent}
              onChange={(event) =>
                commit({
                  ...draft,
                  equipment: {
                    ...draft.equipment,
                    damageReductionPercent: event.target.value,
                  },
                })
              }
              aria-invalid={Boolean(fieldError('equipment.damageReductionPercent'))}
              aria-describedby={getFieldDescribedBy(
                'shared-equipment-damage-reduction-percent',
                fieldError('equipment.damageReductionPercent'),
              )}
            />
          </Field>
        </div>
      </Section>

      <Section title={labels.economyTitle} description={labels.economyDescription}>
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-foreground">
                  {labels.marketPricesTitle}
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {labels.marketPricesDescription}
                </p>
              </div>
              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                <div
                  className="inline-flex items-center gap-1 rounded-[var(--cco-button-radius)] border border-border bg-muted/40 p-1"
                  role="group"
                  aria-label={labels.marketPriceDisplayCurrency}
                  data-testid="shared-market-price-currency-toggle"
                >
                  {marketPriceDisplayCurrencies.map((currency) => (
                    <Button
                      key={currency}
                      type="button"
                      size="sm"
                      variant={
                        marketPriceDisplayCurrency === currency ? 'secondary' : 'ghost'
                      }
                      aria-pressed={marketPriceDisplayCurrency === currency}
                      onClick={() => setMarketPriceDisplayCurrency(currency)}
                      data-testid={`shared-market-price-currency-${currency}`}
                    >
                      {getEconomyCurrencyDefinition(currency).labels[locale]}
                    </Button>
                  ))}
                </div>
                <Button type="button" variant="outline" onClick={restoreDefaultPrices}>
                  <RotateCcw aria-hidden="true" />
                  {labels.restorePrices}
                </Button>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {/* 價格 input 只顯示換算值；draft 仍保留各項原始基準貨幣與數值。 */}
              {draft.prices.map((price, index) => {
                const definition = marketPriceCatalog.find(
                  (item) => item.itemId === price.itemId,
                );
                if (!definition) return null;
                const item = getEconomyItemDefinition(definition.itemId);
                const id = `shared-price-${price.itemId}`;
                const path = `economy.prices.${index}.amount`;
                const displayAmount = getDisplayedMarketPriceAmount(
                  price,
                  marketPriceDisplayCurrency,
                  draftBtcPerAi,
                );
                const displayUnit = getDisplayedMarketPriceUnit(
                  definition.unit,
                  marketPriceDisplayCurrency,
                );

                return (
                  <Field
                    key={price.itemId}
                    id={id}
                    label={item.labels[locale]}
                    range={labels.priceRange}
                    error={fieldError(path)}
                  >
                    <InputWithUnit
                      id={id}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      unit={displayUnit}
                      value={displayAmount}
                      onChange={(event) =>
                        commit({
                          ...draft,
                          prices: draft.prices.map((itemPrice, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...itemPrice,
                                  currencyId: marketPriceDisplayCurrency,
                                  amount: event.target.value,
                                }
                              : itemPrice,
                          ),
                        })
                      }
                      aria-invalid={Boolean(fieldError(path))}
                      aria-describedby={getFieldDescribedBy(id, fieldError(path))}
                    />
                  </Field>
                );
              })}
            </div>
          </div>

          {economyDataSet.payload.exchangeRates.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-foreground">
                {labels.exchangeRatesTitle}
              </h3>
              <div className="grid gap-5 sm:grid-cols-2">
                {draft.exchangeRates.map((rate, index) => {
                  const definition = economyDataSet.payload.exchangeRates.find(
                    (item) => item.id === rate.id,
                  );
                  if (!definition) return null;
                  const baseCurrency = getEconomyCurrencyDefinition(
                    definition.baseCurrencyId,
                  );
                  const quoteCurrency = getEconomyCurrencyDefinition(
                    definition.quoteCurrencyId,
                  );
                  const id = `shared-exchange-${rate.id}`;
                  const path = `economy.exchangeRates.${index}.value`;

                  return (
                    <Field
                      key={rate.id}
                      id={id}
                      label={`${baseCurrency.code} → ${quoteCurrency.code}`}
                      range={labels.positiveRange}
                      error={fieldError(path)}
                    >
                      <InputWithUnit
                        id={id}
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        unit={definition.unit}
                        value={rate.value}
                        onChange={(event) =>
                          commit({
                            ...draft,
                            exchangeRates: draft.exchangeRates.map((itemRate, itemIndex) =>
                              itemIndex === index
                                ? { ...itemRate, value: event.target.value }
                                : itemRate,
                            ),
                          })
                        }
                        aria-invalid={Boolean(fieldError(path))}
                        aria-describedby={getFieldDescribedBy(id, fieldError(path))}
                      />
                    </Field>
                  );
                })}
              </div>
            </div>
          ) : null}

          {marketCacheRateCatalog.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-foreground">
                {labels.cacheRatesTitle}
              </h3>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {draft.cacheRates.map((rate, index) => {
                  const definition = marketCacheRateCatalog.find(
                    (item) => item.id === rate.id,
                  );
                  if (!definition) return null;
                  const id = `shared-cache-${rate.id}`;
                  const path = `economy.cacheRates.${index}.value`;

                  return (
                    <Field
                      key={rate.id}
                      id={id}
                      label={definition.labels[locale]}
                      range={labels.positiveRange}
                      error={fieldError(path)}
                    >
                      <InputWithUnit
                        id={id}
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        unit={definition.unit}
                        value={rate.value}
                        onChange={(event) =>
                          commit({
                            ...draft,
                            cacheRates: draft.cacheRates.map((itemRate, itemIndex) =>
                              itemIndex === index
                                ? { ...itemRate, value: event.target.value }
                                : itemRate,
                            ),
                          })
                        }
                        aria-invalid={Boolean(fieldError(path))}
                        aria-describedby={getFieldDescribedBy(id, fieldError(path))}
                      />
                    </Field>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </Section>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>{labels.resetTitle}</CardTitle>
          <CardDescription className="mt-2 leading-6">
            {labels.resetDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              store.reset();
              setDraft(createSharedUserInputsDraft(store.getSnapshot()));
              setErrors({});
            }}
          >
            <RotateCcw aria-hidden="true" />
            {labels.reset}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
