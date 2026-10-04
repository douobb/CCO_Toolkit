import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type FormulaProps = Omit<ComponentPropsWithoutRef<'figure'>, 'children'> & {
  label?: ReactNode;
  ariaLabel?: string;
  children: ReactNode;
};

export function Formula({ label, ariaLabel, children, className, ...props }: FormulaProps) {
  return (
    <figure {...props} className={cn('not-prose my-6', className)}>
      {label ? (
        <figcaption className="mb-2 text-sm font-medium text-fd-muted-foreground">
          {label}
        </figcaption>
      ) : null}
      <pre
        role="math"
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : 'Formula')}
        tabIndex={0}
        className="overflow-x-auto rounded-xl border bg-fd-card px-4 py-3 text-sm leading-6 text-fd-foreground outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
      >
        <code>{children}</code>
      </pre>
    </figure>
  );
}
