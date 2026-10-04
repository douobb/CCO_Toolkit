import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowRight, Settings2 } from 'lucide-react';

import { SitePageTitle } from '@/components/site-page-title';
import { ContributionHighlights } from '@/components/contribution-board';
import { getContributionBoard } from '@/lib/contribution-board-source';
import { isLocale, toLocalePath, type Locale } from '@/lib/i18n';
import { getHomepageShareMetadata } from '@/lib/site-brand';
import { getMessages } from '@/lib/translations';

const actionClassName =
  'inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background';
const primaryActionClassName = `${actionClassName} border-fd-primary bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/90`;
const secondaryActionClassName = `${actionClassName} border-fd-border bg-fd-card text-fd-foreground hover:bg-fd-accent`;
const cardClassName =
  'rounded-2xl border border-fd-border bg-fd-card p-6 transition-colors hover:bg-fd-accent focus-within:ring-2 focus-within:ring-fd-ring';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return getHomepageShareMetadata(lang);
}

function ArrowLink({ href, children, primary = false }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link href={href} className={primary ? primaryActionClassName : secondaryActionClassName}>
      {children}
      <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  );
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const locale = lang as Locale;
  const messages = getMessages(locale).home;
  const contributionItems = getContributionBoard(locale);

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:px-10 sm:py-16 lg:py-20">
        <section aria-labelledby="home-title" className="max-w-3xl">
          <p className="text-sm font-medium text-fd-muted-foreground">{messages.eyebrow}</p>
          <SitePageTitle id="home-title" appearance="home" className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">
            {messages.title}
          </SitePageTitle>
        </section>

        <div className="mt-10 grid gap-5 sm:mt-12 md:grid-cols-2">
          <div className={cardClassName}>
            <Link
              href={toLocalePath(locale, 'tools')}
              className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2"
            >
              <h2 className="site-home-section-heading text-2xl font-semibold text-fd-foreground group-hover:underline">
                {messages.primary.toolsTitle}
              </h2>
              <p className="mt-3 leading-7 text-fd-muted-foreground">{messages.primary.toolsDescription}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-fd-foreground">
                {messages.primary.toolsLink}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          </div>

          <Link
            href={toLocalePath(locale, 'guides')}
            className={`${cardClassName} group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2`}
          >
            <h2 className="site-home-section-heading text-2xl font-semibold text-fd-foreground group-hover:underline">
              {messages.primary.guidesTitle}
            </h2>
            <p className="mt-3 leading-7 text-fd-muted-foreground">{messages.primary.guidesDescription}</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-fd-foreground">
              {messages.primary.guidesLink}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        </div>

        <aside className="mt-8 rounded-xl border border-fd-border bg-fd-card/70 p-4 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div className="flex items-start gap-3">
            <Settings2 className="mt-0.5 size-5 shrink-0 text-fd-muted-foreground" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-fd-foreground">{messages.settings.title}</h2>
              <p className="mt-1 text-sm leading-6 text-fd-muted-foreground">{messages.settings.description}</p>
            </div>
          </div>
          <Link
            href={toLocalePath(locale, 'settings')}
            className="mt-3 inline-flex shrink-0 rounded-md text-sm font-semibold text-fd-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring sm:mt-0"
          >
            {messages.settings.link}
          </Link>
        </aside>

        <section aria-labelledby="home-contribution-heading" className="mt-16 rounded-2xl border border-fd-border bg-fd-card/60 p-6 sm:mt-20 sm:p-8">
          <h2 id="home-contribution-heading" className="site-home-section-heading text-2xl font-semibold tracking-tight text-fd-foreground">
            {messages.contribution.title}
          </h2>
          <div className="mt-6">
            <ContributionHighlights locale={locale} items={contributionItems} limit={4} seed="home" />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <ArrowLink href={toLocalePath(locale, 'about/contribution-board')} primary>
              {messages.contribution.boardLink}
            </ArrowLink>
            <ArrowLink href={toLocalePath(locale, 'about/contributing')}>
              {messages.contribution.guideLink}
            </ArrowLink>
          </div>
        </section>

        <section aria-labelledby="home-secondary-heading" className="mt-16 sm:mt-20">
          <p className="text-sm font-medium text-fd-muted-foreground">{messages.secondary.eyebrow}</p>
          <h2 id="home-secondary-heading" className="mt-2 text-2xl font-semibold tracking-tight text-fd-foreground">
            {messages.secondary.title}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Link
              href={toLocalePath(locale, 'blog')}
              className={`${cardClassName} group p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2`}
            >
              <h3 className="font-semibold text-fd-foreground group-hover:underline">{messages.secondary.blogTitle}</h3>
              <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">{messages.secondary.blogDescription}</p>
            </Link>
            <Link
              href={toLocalePath(locale, 'recommendations')}
              className={`${cardClassName} group p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2`}
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
              className={`${cardClassName} group p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2`}
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
