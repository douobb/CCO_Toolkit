import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BUFF_PERCENT_MAX,
  BUFF_PERCENT_MIN,
  BUFF_PERCENT_VALUES,
  normalizeLegacyBuffPercentString,
  type BuffPercent,
} from '@/lib/buff-percent';
import { cn } from '@/lib/cn';

function hasContent(value: ReactNode) {
  return value !== undefined && value !== null && value !== false && value !== '';
}

export function getToolFieldIds(
  id: string,
  options: { range?: boolean; hint?: boolean; error?: boolean } = {},
) {
  const rangeId = `${id}-range`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return {
    rangeId,
    hintId,
    errorId,
    describedBy: [
      options.range ? rangeId : undefined,
      options.hint ? hintId : undefined,
      options.error ? errorId : undefined,
    ]
      .filter(Boolean)
      .join(' ') || undefined,
  };
}

export type ToolFieldProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  id: string;
  label: ReactNode;
  range?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
};

export function ToolField({
  id,
  label,
  range,
  hint,
  error,
  children,
  className,
  ...props
}: ToolFieldProps) {
  const ids = getToolFieldIds(id, {
    range: hasContent(range),
    hint: hasContent(hint),
    error: hasContent(error),
  });

  return (
    <div {...props} className={cn('space-y-2', className)}>
      <div className="flex min-h-5 items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {hasContent(range) ? (
          <span id={ids.rangeId} className="text-right text-xs leading-5 text-muted-foreground">
            {range}
          </span>
        ) : null}
      </div>
      {children}
      {hasContent(hint) ? (
        <p id={ids.hintId} className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {hasContent(error) ? (
        <p id={ids.errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type ToolInputFieldProps = Omit<
  ComponentPropsWithoutRef<'input'>,
  'id' | 'className'
> & {
  id: string;
  label: ReactNode;
  range?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  unit?: ReactNode;
  className?: string;
  inputClassName?: string;
};

export function ToolInputField({
  id,
  label,
  range,
  hint,
  error,
  unit,
  className,
  inputClassName,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props
}: ToolInputFieldProps) {
  const ids = getToolFieldIds(id, {
    range: hasContent(range),
    hint: hasContent(hint),
    error: hasContent(error),
  });
  const unitId = unit ? `${id}-unit` : undefined;
  const describedBy = [ariaDescribedBy, ids.describedBy, unitId].filter(Boolean).join(' ') || undefined;

  return (
    <ToolField
      id={id}
      label={label}
      range={range}
      hint={hint}
      error={error}
      className={className}
    >
      <div className="relative">
        <Input
          {...props}
          id={id}
          className={cn(unit && 'pr-20', inputClassName)}
          aria-invalid={hasContent(error) ? true : ariaInvalid}
          aria-describedby={describedBy}
        />
        {unit ? (
          <span
            id={unitId}
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
          >
            {unit}
          </span>
        ) : null}
      </div>
    </ToolField>
  );
}

export type ToolBuffSliderFieldProps = Omit<
  ComponentPropsWithoutRef<'input'>,
  'id' | 'type' | 'className' | 'min' | 'max' | 'step' | 'value' | 'onChange'
> & {
  id: string;
  label: ReactNode;
  value: string | number;
  range?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  unit?: ReactNode;
  onValueChange?: (value: BuffPercent) => void;
  className?: string;
  inputClassName?: string;
};

/** 所有真正 Buff 共用的 0/40/80/100% 可存取離散滑桿。 */
export function ToolBuffSliderField({
  id,
  label,
  range,
  hint,
  error,
  unit = '%',
  value,
  onValueChange,
  className,
  inputClassName,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props
}: ToolBuffSliderFieldProps) {
  const ids = getToolFieldIds(id, {
    range: hasContent(range),
    hint: hasContent(hint),
    error: hasContent(error),
  });
  const valueId = `${id}-value`;
  const displayValue = normalizeLegacyBuffPercentString(value) ?? String(BUFF_PERCENT_MIN);
  const displayPercent = Number(displayValue) as BuffPercent;
  const selectedIndex = Math.max(BUFF_PERCENT_VALUES.indexOf(displayPercent), 0);
  const describedBy = [ariaDescribedBy, ids.describedBy, valueId].filter(Boolean).join(' ') || undefined;

  return (
    <ToolField
      id={id}
      label={label}
      range={range}
      hint={hint}
      error={error}
      className={className}
    >
      <div className="flex min-w-0 items-center gap-3">
        <input
          {...props}
          id={id}
          type="range"
          min={0}
          max={BUFF_PERCENT_VALUES.length - 1}
          step={1}
          value={selectedIndex}
          className={cn(
            'h-11 min-w-0 flex-1 cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
            inputClassName,
          )}
          aria-invalid={hasContent(error) ? true : ariaInvalid}
          aria-describedby={describedBy}
          aria-valuemin={BUFF_PERCENT_MIN}
          aria-valuemax={BUFF_PERCENT_MAX}
          aria-valuenow={displayPercent}
          aria-valuetext={`${displayValue}${String(unit)}`}
          data-buff-percent-values={BUFF_PERCENT_VALUES.join(',')}
          onChange={(event) => {
            const nextIndex = Number(event.currentTarget.value);
            const nextValue = BUFF_PERCENT_VALUES[nextIndex];
            if (nextValue !== undefined) onValueChange?.(nextValue);
          }}
        />
        <output
          id={valueId}
          htmlFor={id}
          className="min-w-[3.5rem] shrink-0 text-right text-sm font-medium tabular-nums text-foreground"
          aria-live="polite"
        >
          {displayValue}{unit}
        </output>
      </div>
    </ToolField>
  );
}

export type ToolValidationSummaryProps = ComponentPropsWithoutRef<'p'>;

export function ToolValidationSummary({ className, role = 'alert', ...props }: ToolValidationSummaryProps) {
  return <p {...props} role={role} className={cn('text-destructive', className)} />;
}

export type ToolResultCardProps = Omit<
  ComponentPropsWithoutRef<'div'>,
  'children' | 'title'
> & {
  title: ReactNode;
  titleId: string;
  description?: ReactNode;
  validation?: ReactNode;
  children: ReactNode;
  titleClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
};

export function ToolResultCard({
  title,
  titleId,
  description,
  validation,
  children,
  className,
  titleClassName,
  headerClassName,
  contentClassName,
  ...props
}: ToolResultCardProps) {
  return (
    <Card {...props} aria-labelledby={titleId} className={className}>
      <CardHeader className={headerClassName}>
        <CardTitle id={titleId} className={titleClassName}>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {validation}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

export type ToolBreakdownItem = {
  id?: string;
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
};

const breakdownColumns = {
  1: 'grid-cols-1',
  2: '@min-[40rem]:grid-cols-2',
  3: '@min-[40rem]:grid-cols-2 @min-[60rem]:grid-cols-3',
  4: '@min-[40rem]:grid-cols-2 @min-[72rem]:grid-cols-4',
} as const;

export type ToolBreakdownProps = Omit<ComponentPropsWithoutRef<'section'>, 'children' | 'title'> & {
  title: ReactNode;
  titleId: string;
  items: readonly ToolBreakdownItem[];
  columns?: keyof typeof breakdownColumns;
  firstItemFullWidth?: boolean;
  layout?: 'cards' | 'rows';
};

export function ToolBreakdown({
  title,
  titleId,
  items,
  layout = 'cards',
  columns = layout === 'rows' ? 1 : 3,
  firstItemFullWidth = false,
  className,
  ...props
}: ToolBreakdownProps) {
  const multiColumnRows = layout === 'rows' && columns > 1;
  const listClassName = layout === 'rows'
    ? multiColumnRows
      ? cn('mt-3 grid gap-x-6', breakdownColumns[columns])
      : 'mt-3 divide-y divide-border'
    : cn('mt-3 grid gap-3', breakdownColumns[columns]);

  return (
    <section
      {...props}
      aria-labelledby={titleId}
      data-breakdown-layout={layout}
      className={cn('@container min-w-0', className)}
    >
      <h3 id={titleId} className="text-sm font-medium text-foreground">
        {title}
      </h3>
      <dl className={listClassName}>
        {items.map((item, index) => (
          layout === 'rows' ? (
            <div
              key={item.id ?? index}
              className={cn(
                multiColumnRows
                  ? 'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-b border-border py-2.5'
                  : 'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 py-2.5 first:pt-0 last:pb-0',
                firstItemFullWidth && index === 0 && multiColumnRows
                  ? '@min-[40rem]:col-span-2'
                  : undefined,
              )}
            >
              <dt className="min-w-0 text-sm text-muted-foreground">
                {item.label}
                {item.description ? (
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {item.description}
                  </span>
                ) : null}
              </dt>
              <dd className="shrink-0 text-right font-medium text-foreground">{item.value}</dd>
            </div>
          ) : (
            <div key={item.id ?? index} className="rounded-md border border-border p-3">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 font-medium text-foreground">{item.value}</dd>
              {item.description ? (
                <dd className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</dd>
              ) : null}
            </div>
          )
        ))}
      </dl>
    </section>
  );
}

export type ToolStateProps = Omit<
  ComponentPropsWithoutRef<'div'>,
  'children' | 'title'
> & {
  variant?: 'empty' | 'error';
  title: ReactNode;
  description?: ReactNode;
};

export function ToolState({
  variant = 'empty',
  title,
  description,
  className,
  ...props
}: ToolStateProps) {
  return (
    <div
      {...props}
      role={variant === 'error' ? 'alert' : undefined}
      data-tool-state={variant}
      className={cn('rounded-md border border-dashed border-border p-5', className)}
    >
      <p className="font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export type ToolPresetButtonProps = Omit<ButtonProps, 'children'> & {
  label: ReactNode;
  icon?: ReactNode;
};

export function ToolPresetButton({ label, icon, ...props }: ToolPresetButtonProps) {
  return (
    <Button {...props}>
      {icon}
      {label}
    </Button>
  );
}
