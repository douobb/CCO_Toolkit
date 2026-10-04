'use client';

import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export type ResponsiveCardDialogProps = {
  children: ReactNode;
  defaultOpen?: boolean;
  modal?: boolean | 'trap-focus';
};

export function ResponsiveCardDialog({
  children,
  defaultOpen,
  modal,
}: ResponsiveCardDialogProps) {
  return (
    <Dialog.Root defaultOpen={defaultOpen} modal={modal}>
      {children}
    </Dialog.Root>
  );
}

export function ResponsiveCardDialogTrigger({
  ariaLabel,
  children,
  className,
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      data-responsive-card-dialog-trigger=""
      className={cn(
        'group relative h-full cursor-pointer overflow-hidden rounded-xl border border-fd-border bg-fd-card transition-colors hover:border-fd-ring hover:bg-fd-accent/30 focus-within:border-fd-ring focus-within:bg-fd-accent/30 motion-reduce:transition-none',
        className,
      )}
    >
      <Dialog.Trigger
        render={
          <button
            type="button"
            aria-label={ariaLabel}
            className="absolute inset-0 z-10 size-full cursor-pointer rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
        }
      />
      {children}
    </article>
  );
}

export function ResponsiveCardDialogContent({
  title,
  closeLabel,
  children,
  className,
}: {
  title: ReactNode;
  closeLabel: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Portal className="z-50">
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-fd-overlay backdrop-blur-xs transition-opacity data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none" />
      <Dialog.Viewport className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
        <Dialog.Popup
          data-responsive-card-dialog-content=""
          className={cn(
            'pointer-events-auto flex max-h-[80vh] max-h-[80dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-background text-foreground shadow-lg outline-none transition-transform duration-[var(--cco-duration-normal)] data-starting-style:translate-y-full data-ending-style:translate-y-full motion-reduce:transition-none sm:max-w-4xl sm:rounded-2xl sm:data-starting-style:translate-y-2 sm:data-ending-style:translate-y-2',
            className,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-8">
            <Dialog.Title className="min-w-0 text-lg font-semibold tracking-tight">
              {title}
            </Dialog.Title>
            <Dialog.Close
              type="button"
              aria-label={closeLabel}
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'icon' }),
                'shrink-0',
              )}
            >
              <X aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-7">
            {children}
          </div>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  );
}
