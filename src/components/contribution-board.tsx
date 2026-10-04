'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  filterContributionItemsForLocale,
  selectContributionHighlights,
  type ContributionBoardItem,
  type ContributionKind,
} from '@/lib/contribution-board';
import { getMessages } from '@/lib/translations';
import { isLocale, locales, type Locale } from '@/lib/i18n';

type ContributionItemLinkProps = {
  item: ContributionBoardItem;
  locale: Locale;
};

function ContributionItemLink({ item, locale }: ContributionItemLinkProps) {
  const messages = getMessages(locale).contributionBoard;
  const sectionLabel = getMessages(locale).navigation[item.section];
  const kindLabel = item.kind === 'incomplete' ? messages.incompleteLabel : messages.translationLabel;

  return (
    <Link
      href={item.href}
      data-contribution-item={item.id}
      className="group flex min-w-0 flex-wrap items-center rounded-lg border border-fd-border bg-fd-card px-4 py-3 transition-colors hover:bg-fd-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background"
    >
      <article className="flex min-w-0 w-full flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex shrink-0 items-center gap-2 text-xs text-fd-muted-foreground">
          <span>{sectionLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{kindLabel}</span>
        </div>
        <h3 className="min-w-0 flex-1 basis-full break-words text-sm font-semibold text-fd-foreground group-hover:underline sm:basis-0">
          {item.title}
        </h3>
        {item.targetLocale ? (
          <span
            data-contribution-target-locale={item.targetLocale}
            className="shrink-0 text-xs text-fd-muted-foreground"
          >
            <span className="font-medium text-fd-foreground">{messages.targetLocale}：</span>
            {messages.targetLocales[item.targetLocale]}
          </span>
        ) : null}
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-fd-foreground sm:ml-auto">
          {messages.open}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </article>
    </Link>
  );
}

function ContributionEmptyState({ message }: { message: string }) {
  return <p className="rounded-lg border border-dashed border-fd-border px-4 py-3 text-sm text-fd-muted-foreground">{message}</p>;
}

export type ContributionBoardProps = {
  locale: Locale;
  items: readonly ContributionBoardItem[];
};

function ContributionBoardContent({ locale, items }: ContributionBoardProps) {
  const messages = getMessages(locale).contributionBoard;
  const [translationTargetLocale, setTranslationTargetLocale] = useState<Locale>(locale);

  const groups: Array<{
    kind: ContributionKind;
    title: string;
    items: ContributionBoardItem[];
    emptyMessage: string;
  }> = [
    {
      kind: 'incomplete',
      title: messages.incompleteTitle,
      items: items.filter((item) => item.kind === 'incomplete'),
      emptyMessage: messages.incompleteEmpty,
    },
    {
      kind: 'translation',
      title: messages.translationTitle,
      items: items.filter(
        (item) => item.kind === 'translation' && item.targetLocale === translationTargetLocale,
      ),
      emptyMessage: messages.translationEmpty,
    },
  ];

  return (
    <div data-contribution-board className="not-prose mt-10 space-y-12">
      {groups.map((group) => (
        <section key={group.kind} aria-labelledby={`contribution-${group.kind}-heading`} data-contribution-group={group.kind}>
          <h2 id={`contribution-${group.kind}-heading`} className="text-xl font-semibold tracking-tight text-fd-foreground">
            {group.title}
          </h2>
          {group.kind === 'translation' ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label htmlFor="contribution-translation-target-locale" className="text-sm font-medium text-fd-foreground">
                {messages.translationFilterLabel}
              </label>
              <select
                id="contribution-translation-target-locale"
                data-contribution-translation-filter=""
                value={translationTargetLocale}
                onChange={(event) => {
                  if (isLocale(event.target.value)) setTranslationTargetLocale(event.target.value);
                }}
                className="rounded-md border border-fd-border bg-fd-card px-2.5 py-1.5 text-sm text-fd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
              >
                {locales.map((targetLocale) => (
                  <option key={targetLocale} value={targetLocale}>
                    {messages.targetLocales[targetLocale]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="mt-4 space-y-2">
            {group.items.length > 0 ? (
              group.items.map((item) => <ContributionItemLink key={item.id} item={item} locale={locale} />)
            ) : (
              <ContributionEmptyState message={group.emptyMessage} />
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

export function ContributionBoard({ locale, items }: ContributionBoardProps) {
  return <ContributionBoardContent key={locale} locale={locale} items={items} />;
}

export type ContributionHighlightsProps = {
  locale: Locale;
  items: readonly ContributionBoardItem[];
  limit?: number;
  seed?: string;
};

export function ContributionHighlights({ locale, items, limit = 4, seed = 'home' }: ContributionHighlightsProps) {
  const messages = getMessages(locale).home.contribution;
  const highlights = selectContributionHighlights(
    filterContributionItemsForLocale(items, locale),
    limit,
    seed,
  );

  if (highlights.length === 0) {
    return <ContributionEmptyState message={messages.empty} />;
  }

  return (
    <div data-contribution-highlights className="space-y-2">
      {highlights.map((item) => <ContributionItemLink key={item.id} item={item} locale={locale} />)}
    </div>
  );
}
