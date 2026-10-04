import { ChevronDown } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import type { TOCItemType } from 'fumadocs-core/toc';
import { TOCProvider, TOCScrollArea } from 'fumadocs-ui/components/toc';
import { TOCEmpty, TOCItem, TOCItems } from 'fumadocs-ui/components/toc/default';

import { cn } from '@/lib/cn';

export type MobileTOCProps = Omit<
  ComponentProps<'details'>,
  'children' | 'open' | 'title'
> & {
  items: TOCItemType[];
  label: ReactNode;
  defaultOpen?: boolean;
};

export function MobileTOC({
  items,
  label,
  defaultOpen = false,
  className,
  ...props
}: MobileTOCProps) {
  if (items.length === 0) return null;

  return (
    <details
      data-context-mode="toc"
      open={defaultOpen}
      className={cn('border-y border-border xl:hidden', className)}
      {...props}
    >
      <summary className="group flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
        <span>{label}</span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-[var(--cco-duration-fast)] group-open:rotate-180"
        />
      </summary>
      <TOCProvider toc={items}>
        <TOCScrollArea className="border-t border-border px-4">
          <TOCItems thumbBox={false}>
            {items.length === 0 && <TOCEmpty />}
            {items.map((item) => (
              <TOCItem key={item.url} item={item} />
            ))}
          </TOCItems>
        </TOCScrollArea>
      </TOCProvider>
    </details>
  );
}
