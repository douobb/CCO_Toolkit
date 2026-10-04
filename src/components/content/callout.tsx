import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CircleCheck, Info, Lightbulb, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/cn';

export type CalloutType = 'info' | 'tip' | 'warning' | 'danger' | 'success';

type CalloutProps = Omit<ComponentPropsWithoutRef<'aside'>, 'title'> & {
  type?: CalloutType;
  title?: ReactNode;
  children?: ReactNode;
};

const calloutVariants: Record<
  CalloutType,
  { icon: LucideIcon; label: string; className: string }
> = {
  info: {
    icon: Info,
    label: 'Information',
    className: 'border-fd-border bg-fd-card',
  },
  tip: {
    icon: Lightbulb,
    label: 'Tip',
    className: 'border-fd-primary/40 bg-fd-card',
  },
  warning: {
    icon: TriangleAlert,
    label: 'Warning',
    className: 'border-amber-500/40 bg-fd-card',
  },
  danger: {
    icon: TriangleAlert,
    label: 'Warning',
    className: 'border-red-500/40 bg-fd-card',
  },
  success: {
    icon: CircleCheck,
    label: 'Success',
    className: 'border-emerald-500/40 bg-fd-card',
  },
};

export function Callout({
  type = 'info',
  title,
  children,
  className,
  role = 'note',
  'aria-label': ariaLabel,
  ...props
}: CalloutProps) {
  const variant = calloutVariants[type];
  const Icon = variant.icon;

  return (
    <aside
      {...props}
      role={role}
      aria-label={ariaLabel ?? (typeof title === 'string' ? title : variant.label)}
      data-callout-type={type}
      className={cn(
        'not-prose my-6 flex gap-3 rounded-xl border p-4 text-sm leading-6',
        variant.className,
        className,
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0 text-fd-primary" aria-hidden="true" />
      <div className="min-w-0">
        {title ? <p className="font-medium text-fd-foreground">{title}</p> : null}
        <div className={cn('text-fd-muted-foreground', title && 'mt-1')}>{children}</div>
      </div>
    </aside>
  );
}
