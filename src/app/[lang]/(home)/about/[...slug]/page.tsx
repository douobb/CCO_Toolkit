import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { DocsBody } from 'fumadocs-ui/layouts/docs/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';

import { ContributionBoard } from '@/components/contribution-board';
import { Changelog } from '@/components/site-content';
import { getMDXComponents } from '@/components/mdx';
import { SitePageTitle } from '@/components/site-page-title';
import { SiteTranslationUnavailable } from '@/components/site-translation-unavailable';
import {
  defaultLocale,
  getHtmlLanguage,
  isLocale,
  locales,
  toLocalePath,
  type Locale,
} from '@/lib/i18n';
import { getMessages } from '@/lib/translations';
import { getContributionBoard } from '@/lib/contribution-board-source';
import { getPageImageUrl, source } from '@/lib/source';
import { withBasePath } from '@/lib/site-paths';

type AboutChildRouteParams = {
  lang: string;
  slug: string[];
};

type AboutChildPageResolution =
  | { kind: 'available'; locale: Locale; page: (typeof source)['$inferPage']; slugs: string[] }
  | { kind: 'unavailable'; locale: Locale; sourcePage: (typeof source)['$inferPage'] };

export const dynamicParams = false;

function getAboutChildPage(locale: Locale, slug: readonly string[]) {
  return source.getPage(['about', ...slug], locale);
}

function resolveAboutChildPage(params: AboutChildRouteParams): AboutChildPageResolution {
  if (!isLocale(params.lang) || params.slug.length === 0) notFound();

  const page = getAboutChildPage(params.lang, params.slug);
  if (page) {
    return {
      kind: 'available',
      locale: params.lang,
      page,
      slugs: ['about', ...params.slug],
    };
  }

  if (params.lang !== defaultLocale) {
    const sourcePage = getAboutChildPage(defaultLocale, params.slug);
    if (sourcePage) {
      return { kind: 'unavailable', locale: params.lang, sourcePage };
    }
  }

  notFound();
}

export default async function AboutChildPage({
  params,
}: {
  params: Promise<AboutChildRouteParams>;
}) {
  const state = resolveAboutChildPage(await params);

  if (state.kind === 'unavailable') {
    return (
      <SiteTranslationUnavailable
        locale={state.locale}
        sourceTitle={state.sourcePage.data.title}
        sourceUrl={state.sourcePage.url}
      />
    );
  }

  const MDX = state.page.data.body;
  const messages = getMessages(state.locale).aboutPage;
  const isContributionBoard = state.slugs.join('/') === 'about/contribution-board';

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 sm:px-10 sm:py-14">
        <Link
          href={toLocalePath(state.locale, 'about')}
          className="inline-flex items-center gap-2 text-sm font-medium text-fd-muted-foreground transition-colors hover:text-fd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {messages.title}
        </Link>
        <header className="mt-8 max-w-3xl">
          <p className="text-sm font-medium text-fd-muted-foreground">{messages.eyebrow}</p>
          <SitePageTitle className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            {state.page.data.title}
          </SitePageTitle>
          <p className="mt-5 text-lg text-fd-muted-foreground">
            {state.page.data.description}
          </p>
        </header>
        <article className="mt-10 max-w-4xl border-t pt-8">
          <DocsBody>
            <MDX
              components={getMDXComponents({
                a: createRelativeLink(source, state.page),
                Changelog: () => <Changelog locale={state.locale} />,
              }, { articleHeadings: true })}
            />
            {isContributionBoard ? (
              <ContributionBoard locale={state.locale} items={getContributionBoard(state.locale)} />
            ) : null}
          </DocsBody>
        </article>
      </div>
    </div>
  );
}

export function generateStaticParams(): AboutChildRouteParams[] {
  const paramsByPath = new Map<string, AboutChildRouteParams>();

  function addPages(locale: Locale, pages: readonly (typeof source)['$inferPage'][]) {
    for (const page of pages) {
      if (page.slugs[0] !== 'about' || page.slugs.length <= 1) continue;

      const slug = page.slugs.slice(1);
      paramsByPath.set(`${locale}/${slug.join('/')}`, { lang: locale, slug });
    }
  }

  for (const locale of locales) addPages(locale, source.getPages(locale));
  for (const locale of locales) {
    if (locale !== defaultLocale) addPages(locale, source.getPages(defaultLocale));
  }

  return [...paramsByPath.values()];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<AboutChildRouteParams>;
}): Promise<Metadata> {
  const state = resolveAboutChildPage(await params);

  if (state.kind === 'unavailable') {
    const messages = getMessages(state.locale).translationUnavailable;

    return {
      title: messages.title,
      description: messages.description,
      robots: { index: false, follow: true },
      alternates: {
        canonical: withBasePath(state.sourcePage.url),
        languages: {
          [getHtmlLanguage(defaultLocale)]: withBasePath(state.sourcePage.url),
        },
      },
    };
  }

  const languageAlternates = Object.fromEntries(
    locales.flatMap((locale) => {
      const translatedPage = getAboutChildPage(locale, state.slugs.slice(1));
      return translatedPage
        ? [[getHtmlLanguage(locale), withBasePath(translatedPage.url)]]
        : [];
    }),
  );

  return {
    title: state.page.data.title,
    description: state.page.data.description,
    alternates: {
      canonical: withBasePath(state.page.url),
      languages: languageAlternates,
    },
    openGraph: { images: getPageImageUrl(state.page).url },
  };
}
