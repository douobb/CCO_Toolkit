import Link from 'next/link';
import type { ReactNode } from 'react';
import { Settings2 } from 'lucide-react';

import styles from './home-page-content.module.css';
import { SitePageTitle } from '@/components/site-page-title';
import { filterContributionItemsForLocale } from '@/lib/contribution-board';
import { getContributionBoard } from '@/lib/contribution-board-source';
import { toLocalePath, type Locale } from '@/lib/i18n';
import { getMessages } from '@/lib/translations';

const actionClassName =
  'inline-flex min-h-11 items-center justify-center rounded-lg border px-3 py-2 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background';
const primaryActionClassName = `${actionClassName} border-fd-primary bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/90`;
const secondaryActionClassName = `${actionClassName} border-fd-border bg-fd-card text-fd-foreground hover:bg-fd-accent`;
const cardClassName =
  'rounded-2xl border border-fd-border bg-fd-card transition-colors hover:bg-fd-accent focus-within:ring-2 focus-within:ring-fd-ring';
const featureCardPaddingClassName = 'p-6 sm:p-8';
const primaryCardClassName = `${cardClassName} ${featureCardPaddingClassName}`;
const summaryCardClassName = 'min-w-0 rounded-2xl border border-fd-border bg-fd-card p-5';
const summaryCardHeadingClassName =
  'site-home-section-heading text-2xl font-semibold tracking-tight text-fd-foreground';

function ContributionActionLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link href={href} className={primary ? primaryActionClassName : secondaryActionClassName}>
      {children}
    </Link>
  );
}

export function HomePageContent({ locale }: { locale: Locale }) {
  const messages = getMessages(locale).home;
  const contributionItems = getContributionBoard(locale);
  const visibleContributionItems = filterContributionItemsForLocale(contributionItems, locale);
  const incompleteCount = visibleContributionItems.filter((item) => item.kind === 'incomplete').length;
  const translationCount = visibleContributionItems.filter((item) => item.kind === 'translation').length;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:px-10 sm:py-16 lg:py-20">
        <section aria-labelledby="home-title" className="max-w-3xl">
          <p className="text-sm font-medium text-fd-muted-foreground">{messages.eyebrow}</p>
          <SitePageTitle id="home-title" appearance="home" className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">
            {messages.title}
          </SitePageTitle>
        </section>

        <div className="mt-8 grid gap-3 sm:mt-10 md:grid-cols-2">
          <Link
            href={toLocalePath(locale, 'tools')}
            className={primaryCardClassName + ' group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2'}
          >
            <h2 className="site-home-section-heading text-2xl font-semibold text-fd-foreground group-hover:underline">
              {messages.primary.toolsTitle}
            </h2>
            <p className="mt-3 leading-7 text-fd-muted-foreground">{messages.primary.toolsDescription}</p>
          </Link>

          <Link
            href={toLocalePath(locale, 'guides')}
            className={primaryCardClassName + ' group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2'}
          >
            <h2 className="site-home-section-heading text-2xl font-semibold text-fd-foreground group-hover:underline">
              {messages.primary.guidesTitle}
            </h2>
            <p className="mt-3 leading-7 text-fd-muted-foreground">{messages.primary.guidesDescription}</p>
          </Link>
        </div>

        <div className={`mt-4 ${styles.summaryCards}`} data-home-summary-cards="true">
          <Link
            href={toLocalePath(locale, 'settings')}
            className={`${summaryCardClassName} group block transition-colors hover:bg-fd-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2`}
          >
            <div className="flex items-start gap-3">
              <Settings2 className="mt-0.5 size-5 shrink-0 text-fd-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-fd-foreground group-hover:underline">{messages.settings.title}</h2>
                <p className="mt-1 text-sm leading-6 text-fd-muted-foreground">{messages.settings.description}</p>
              </div>
            </div>
          </Link>

          <section
            aria-labelledby="home-contribution-heading"
            data-contribution-card="true"
            className={`min-w-0 rounded-2xl border border-fd-border bg-fd-card ${featureCardPaddingClassName} ${styles.contributionCard}`}
          >
            <h2 id="home-contribution-heading" className={summaryCardHeadingClassName}>
              {messages.contribution.title}
            </h2>
            <div className={`mt-4 ${styles.summaryActions}`}>
              <dl data-contribution-counts className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                <div data-contribution-count="incomplete" className="inline-flex items-baseline gap-2 whitespace-nowrap">
                  <dt className="text-base leading-6 text-fd-muted-foreground">
                    {messages.contribution.counts.incomplete}
                  </dt>
                  <dd className="m-0 shrink-0 text-xl font-semibold tabular-nums text-fd-foreground">{incompleteCount}</dd>
                </div>
                <div data-contribution-count="translation" className="inline-flex items-baseline gap-2 whitespace-nowrap">
                  <dt className="text-base leading-6 text-fd-muted-foreground">
                    {messages.contribution.counts.translation}
                  </dt>
                  <dd className="m-0 shrink-0 text-xl font-semibold tabular-nums text-fd-foreground">{translationCount}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                <ContributionActionLink href={toLocalePath(locale, 'about/contribution-board')} primary>
                  {messages.contribution.boardLink}
                </ContributionActionLink>
                <ContributionActionLink href={toLocalePath(locale, 'about/contributing')}>
                  {messages.contribution.guideLink}
                </ContributionActionLink>
              </div>
            </div>
          </section>
        </div>

        <section aria-labelledby="home-secondary-heading" className="mt-8 sm:mt-12">
          <h2 id="home-secondary-heading" className="site-home-section-heading mt-2 text-2xl font-semibold tracking-tight text-fd-foreground">
            {messages.secondary.title}
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Link
              href={toLocalePath(locale, 'blog')}
              className={cardClassName + ' group p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2'}
            >
              <h3 className="font-semibold text-fd-foreground group-hover:underline">{messages.secondary.blogTitle}</h3>
              <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">{messages.secondary.blogDescription}</p>
            </Link>
            <Link
              href={toLocalePath(locale, 'recommendations')}
              className={cardClassName + ' group p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2'}
            >
              <h3 className="font-semibold text-fd-foreground group-hover:underline">
                {messages.secondary.recommendationsTitle}
              </h3>
              <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
                {messages.secondary.recommendationsDescription}
              </p>
            </Link>
            <Link
              href={toLocalePath(locale, 'about')}
              className={cardClassName + ' group p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2'}
            >
              <h3 className="font-semibold text-fd-foreground group-hover:underline">{messages.secondary.aboutTitle}</h3>
              <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">{messages.secondary.aboutDescription}</p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
