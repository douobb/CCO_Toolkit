import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/cn';

export type GameTermProps = Omit<ComponentPropsWithoutRef<'dfn'>, 'children' | 'title'> & {
  term: string;
  definition?: string;
};

export function GameTerm({ term, definition, className, ...props }: GameTermProps) {
  return (
    <dfn
      {...props}
      title={definition}
      aria-label={definition ? `${term}: ${definition}` : term}
      data-game-term={term}
      className={cn('cursor-help border-b border-dashed border-fd-border not-italic', className)}
    >
      {term}
    </dfn>
  );
}
