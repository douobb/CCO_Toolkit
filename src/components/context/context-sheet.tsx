'use client';

import type { DialogRootProps } from '@base-ui/react/dialog';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export type ContextSheetSide = 'right' | 'bottom' | 'center';

export type ContextSheetProps = Omit<DialogRootProps, 'children'> & {
  trigger?: ReactElement;
  title: ReactNode;
  description?: ReactNode;
  closeLabel: string;
  side?: ContextSheetSide;
  className?: string;
  closeButtonClassName?: string;
  children: ReactNode;
};

export function ContextSheet({
  trigger,
  title,
  description,
  closeLabel,
  side = 'right',
  className,
  closeButtonClassName,
  children,
  ...rootProps
}: ContextSheetProps) {
  return (
    <Dialog.Root {...rootProps}>
      {trigger ? <Dialog.Trigger render={trigger} /> : null}
      <Dialog.Portal className="z-50">
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-fd-overlay backdrop-blur-xs transition-opacity data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <Dialog.Viewport
          className={cn(
            'pointer-events-none fixed inset-0 z-50 flex',
            side === 'right'
              ? 'items-stretch justify-end p-4'
              : side === 'bottom'
                ? 'items-end justify-center p-4'
                : 'items-center justify-center p-2 sm:p-4',
          )}
        >
          <Dialog.Popup
            className={cn(
              'pointer-events-auto flex flex-col border border-border bg-background text-foreground shadow-lg outline-none transition-transform duration-[var(--cco-duration-normal)]',
              side === 'right'
                ? 'h-full max-h-[calc(100dvh-2rem)] w-[min(100%,24rem)] rounded-lg data-starting-style:translate-x-full data-ending-style:translate-x-full'
                : side === 'bottom'
                  ? 'max-h-[calc(100dvh-2rem)] w-full max-w-2xl rounded-t-xl data-starting-style:translate-y-full data-ending-style:translate-y-full'
                  : 'h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] rounded-xl data-starting-style:scale-[.98] data-ending-style:scale-[.98] sm:h-[min(80dvh,48rem)] sm:max-h-[calc(100dvh-2rem)] sm:w-[min(calc(100vw-2rem),42rem)]',
              className,
            )}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-4">
              <div className="min-w-0">
                <Dialog.Title className="text-base font-semibold">
                  {title}
                </Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                    {description}
                  </Dialog.Description>
                ) : null}
              </div>
              <Dialog.Close
                type="button"
                aria-label={closeLabel}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                  'shrink-0',
                  closeButtonClassName,
                )}
              >
                <X aria-hidden="true" />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">{children}</div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
