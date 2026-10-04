import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsBody } from 'fumadocs-ui/layouts/docs/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';

import { getMDXComponents } from '@/components/mdx';
import { SitePageTitle } from '@/components/site-page-title';
import { SiteTranslationUnavailable } from '@/components/site-translation-unavailable';
import { RecommendationsGrid } from '@/components/site-content';
import {
  defaultLocale,
  getHtmlLanguage,
  isLocale,
  locales,
  type Locale,
} from '@/lib/i18n';
import { getMessages } from '@/lib/translations';
import { getPageImageUrl, source } from '@/lib/source';
import { withBasePath } from '@/lib/site-paths';

type RecommendationsRouteParams = { lang: string };

export const dynamicParams = false;

function getRecommendationsPage(locale: Locale) {
  return source.getPage(['recommendations'], locale);
}

function getFallbackMetadata(
  locale: Locale,
  sourcePage: ReturnType<typeof getRecommendationsPage>,
): Metadata {
  if (!sourcePage) return {};

  const messages = getMessages(locale).translationUnavailable;
  return {
    title: messages.title,
    description: messages.description,
    robots: { index: false, follow: true },
    alternates: {
      canonical: withBasePath(sourcePage.url),
      languages: { [getHtmlLanguage(defaultLocale)]: withBasePath(sourcePage.url) },
    },
  };
}

export default async function RecommendationsPage({
  params,
}: {
  params: Promise<RecommendationsRouteParams>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const page = getRecommendationsPage(lang);
  if (!page && lang !== defaultLocale) {
    const sourcePage = getRecommendationsPage(defaultLocale);
    if (!sourcePage) notFound();

    return (
      <SiteTranslationUnavailable
        locale={lang}
        sourceTitle={sourcePage.data.title}
        sourceUrl={sourcePage.url}
      />
    );
  }

  if (!page) notFound();

  const MDX = page.data.body;
  const messages = getMessages(lang).recommendationsPage;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:px-10 sm:py-16">
        <header className="max-w-3xl">
          <p className="mb-3 text-sm font-medium text-fd-muted-foreground">{messages.eyebrow}</p>
          <SitePageTitle className="text-4xl font-bold tracking-tight sm:text-5xl">{page.data.title}</SitePageTitle>
          <p className="mt-5 text-lg text-fd-muted-foreground">{page.data.description}</p>
        </header>
        <article className="mt-10 max-w-5xl border-t pt-8">
          <DocsBody>
            <MDX
              components={getMDXComponents({
                a: createRelativeLink(source, page),
                RecommendationsGrid: () => <RecommendationsGrid locale={lang} />,
              }, { articleHeadings: true })}
            />
          </DocsBody>
        </article>
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RecommendationsRouteParams>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const page = getRecommendationsPage(lang);
  if (!page) {
    return getFallbackMetadata(lang, getRecommendationsPage(defaultLocale));
  }

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: {
      canonical: withBasePath(page.url),
      languages: Object.fromEntries(
        locales.flatMap((locale) => {
          const translatedPage = getRecommendationsPage(locale);
          return translatedPage
            ? [[getHtmlLanguage(locale), withBasePath(translatedPage.url)]]
            : [];
        }),
      ),
    },
    openGraph: { images: getPageImageUrl(page).url },
  };
}
