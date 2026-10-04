import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { InlineTOC } from 'fumadocs-ui/components/inline-toc';
import { DocsBody } from 'fumadocs-ui/layouts/docs/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';

import { getMDXComponents } from '@/components/mdx';
import {
  defaultLocale,
  getHtmlLanguage,
  getListSeparator,
  isLocale,
  locales,
  toLocalePath,
  type Locale,
} from '@/lib/i18n';
import {
  formatBlogDate,
  getBlogDate,
  getBlogDateTime,
  getBlogPage,
  getBlogPages,
  type BlogPage,
} from '@/lib/blog';
import { getMessages } from '@/lib/translations';
import { SitePageTitle } from '@/components/site-page-title';
import { getPageImageUrl, source } from '@/lib/source';
import { withBasePath } from '@/lib/site-paths';

type BlogRouteParams = {
  lang: string;
  slug: string;
};

type BlogPageResolution =
  | { kind: 'available'; locale: Locale; page: BlogPage }
  | { kind: 'unavailable'; locale: Locale; sourcePage: BlogPage };

export const dynamicParams = false;

function resolveBlogPage(params: BlogRouteParams): BlogPageResolution {
  if (!isLocale(params.lang)) notFound();
  if (params.slug === '__empty-blog__') notFound();

  const page = getBlogPage(params.lang, params.slug);
  if (page) return { kind: 'available', locale: params.lang, page };

  if (params.lang !== defaultLocale) {
    const sourcePage = getBlogPage(defaultLocale, params.slug);
    if (sourcePage) {
      return { kind: 'unavailable', locale: params.lang, sourcePage };
    }
  }

  notFound();
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<BlogRouteParams>;
}) {
  const state = resolveBlogPage(await params);

  if (state.kind === 'unavailable') {
    const messages = getMessages(state.locale).translationUnavailable;

    return (
      <div className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:px-10 sm:py-16">
          <p className="mb-3 text-sm font-medium text-fd-muted-foreground">
            {messages.eyebrow}
          </p>
          <SitePageTitle className="text-3xl font-bold tracking-tight sm:text-4xl">{messages.title}</SitePageTitle>
          <p className="mt-5 text-lg text-fd-muted-foreground">{messages.description}</p>
          <div className="mt-8 rounded-xl border bg-fd-card p-5 sm:p-6">
            <p className="text-sm text-fd-muted-foreground">{messages.sourceLabel}</p>
            <p lang={getHtmlLanguage(defaultLocale)} className="mt-1 text-lg font-semibold text-fd-foreground">
              {state.sourcePage.data.title}
            </p>
            <Link
              href={state.sourcePage.url}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              {messages.openTraditionalChinese}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const messages = getMessages(state.locale).blogPage;
  const listSeparator = getListSeparator(state.locale);
  const MDX = state.page.data.body;
  const date = getBlogDate(state.page);
  const author = state.page.data.author;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:px-10 sm:py-14">
        <Link
          href={toLocalePath(state.locale, 'blog')}
          className="inline-flex items-center gap-2 text-sm font-medium text-fd-muted-foreground transition-colors hover:text-fd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {messages.backToBlog}
        </Link>

        <header className="mt-8 border-b pb-8">
          <p className="text-sm font-medium text-fd-muted-foreground">{messages.article}</p>
          <SitePageTitle className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {state.page.data.title}
          </SitePageTitle>
          <p className="mt-4 text-lg leading-8 text-fd-muted-foreground">
            {state.page.data.description}
          </p>
          {date || author ? (
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fd-muted-foreground">
              {author ? <span>{messages.author}：{author}</span> : null}
              {author && date ? <span aria-hidden="true">·</span> : null}
              {date ? (
                <time dateTime={getBlogDateTime(state.page)}>
                  {messages.date} {formatBlogDate(state.page, state.locale)}
                </time>
              ) : null}
            {state.page.data.tags.length > 0 ? (
              <>
                {(author || date) ? <span aria-hidden="true">·</span> : null}
                <span>
                  {messages.tags}：{state.page.data.tags.join(listSeparator)}
                </span>
              </>
            ) : null}
            </div>
          ) : state.page.data.tags.length > 0 ? (
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fd-muted-foreground">
              <span>{messages.tags}：{state.page.data.tags.join(listSeparator)}</span>
            </div>
          ) : null}
        </header>

        <article className="mt-8 min-w-0">
          {state.page.data.toc.length > 0 ? (
            <InlineTOC items={state.page.data.toc} className="mb-8" />
          ) : null}
          <DocsBody>
            <MDX
              components={getMDXComponents({
                a: createRelativeLink(source, state.page),
              }, { articleHeadings: true })}
            />
          </DocsBody>
        </article>
      </div>
    </div>
  );
}

export function generateStaticParams(): Array<{ lang: Locale; slug: string }> {
  const paramsByPath = new Map<string, { lang: Locale; slug: string }>();

  function addPages(locale: Locale) {
    for (const page of getBlogPages(locale)) {
      const slug = page.slugs.at(-1);
      if (slug) paramsByPath.set(`${locale}/${slug}`, { lang: locale, slug });
    }
  }

  for (const locale of locales) addPages(locale);
  for (const locale of locales) {
    if (locale === defaultLocale) continue;
    for (const page of getBlogPages(defaultLocale)) {
      const slug = page.slugs.at(-1);
      if (slug) paramsByPath.set(`${locale}/${slug}`, { lang: locale, slug });
    }
  }

  // 靜態匯出不接受空參數；保留 404 驗證路徑，建置後移除其匯出檔案。
  return paramsByPath.size > 0
    ? [...paramsByPath.values()]
    : [{ lang: defaultLocale, slug: '__empty-blog__' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<BlogRouteParams>;
}): Promise<Metadata> {
  const state = resolveBlogPage(await params);

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
      const translatedPage = getBlogPage(locale, state.page.slugs.at(-1) ?? '');
      return translatedPage
        ? [[getHtmlLanguage(locale), withBasePath(translatedPage.url)]]
        : [];
    }),
  );
  const sourcePage = source.getPage(state.page.slugs, state.locale);

  return {
    title: state.page.data.title,
    description: state.page.data.description,
    alternates: {
      canonical: withBasePath(state.page.url),
      languages: languageAlternates,
    },
    openGraph: sourcePage
      ? { images: getPageImageUrl(sourcePage).url }
      : undefined,
  };
}
