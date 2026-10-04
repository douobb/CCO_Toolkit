import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type ToolEmbedProps = Omit<ComponentPropsWithoutRef<'div'>, 'title'> & {
  href: string;
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actionLabel?: ReactNode;
  external?: boolean;
};

function isExternalUrl(href: string) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href);
}

const toolEmbedLinkClassName =
  'not-prose block rounded-xl no-underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2';

export function ToolEmbed({
  href,
  title,
  description,
  eyebrow,
  actionLabel,
  external,
  className,
  ...props
}: ToolEmbedProps) {
  const isExternal = external ?? isExternalUrl(href);
  const card = (
    <div
      {...props}
      className={cn(
        'not-prose group flex h-full flex-col rounded-xl border bg-fd-card p-5 transition-colors hover:bg-fd-accent motion-reduce:transition-none',
        className,
      )}
    >
      {eyebrow ? (
        <span className="text-sm font-medium text-fd-muted-foreground">{eyebrow}</span>
      ) : null}
      <span className="mt-2 text-lg font-semibold tracking-tight group-hover:underline group-hover:underline-offset-4">
        {title}
      </span>
      {description ? (
        <span className="mt-2 text-sm leading-6 text-fd-muted-foreground">{description}</span>
      ) : null}
      {actionLabel ? (
        <span className="mt-auto flex items-center gap-2 pt-5 text-sm font-medium">
          {actionLabel}
          {isExternal ? (
            <ExternalLink className="size-4" aria-hidden="true" />
          ) : (
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden="true"
            />
          )}
        </span>
      ) : null}
    </div>
  );

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={typeof title === 'string' ? title : undefined}
        className={toolEmbedLinkClassName}
      >
        {card}
      </a>
    );
  }

  return (
    <Link
      href={href}
      aria-label={typeof title === 'string' ? title : undefined}
      className={toolEmbedLinkClassName}
    >
      {card}
    </Link>
  );
}
