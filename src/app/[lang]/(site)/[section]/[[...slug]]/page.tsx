import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  DocsBody,
  DocsDescription,
  DocsTitle,
  MarkdownCopyButton,
} from 'fumadocs-ui/layouts/docs/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import {
  ArticleMetadata,
  isArticleMetadataContentPath,
} from '@/components/article-metadata';
import { ContextualDocsPage } from '@/components/context';
import { getMDXComponents } from '@/components/mdx';
import { getToolRenderer } from '@/components/tools/tool-renderer-registry';
import { TranslationUnavailable } from '@/components/translation-unavailable';
import { sitePageTitleClassName } from '@/components/site-page-title';
import {
  defaultLocale,
  getHtmlLanguage,
  getTranslationAvailability,
  isLocale,
  locales,
  type Locale,
} from '@/lib/i18n';
import { getPageImageUrl, getPageMarkdownUrl, source } from '@/lib/source';
import { withBasePath } from '@/lib/site-paths';
import { getToolDefinitionByPath } from '@/lib/tools';
import { getMessages } from '@/lib/translations';

type RouteParams = {
  lang: string;
  section: string;
  slug?: string[];
};

type LocalizedRouteParams = RouteParams & { lang: Locale };

export const dynamicParams = false;

function getSlugs(params: RouteParams) {
  return [params.section, ...(params.slug ?? [])];
}

function resolvePage(params: RouteParams) {
  if (!isLocale(params.lang)) notFound();

  const localizedParams: LocalizedRouteParams = { ...params, lang: params.lang };
  const slugs = getSlugs(localizedParams);
  const page = source.getPage(slugs, localizedParams.lang);
  const sourcePage =
    localizedParams.lang !== defaultLocale ? source.getPage(slugs, defaultLocale) : undefined;
  const availability = getTranslationAvailability(
    localizedParams.lang,
    Boolean(page && page.slugs[0] === localizedParams.section),
    Boolean(sourcePage && sourcePage.slugs[0] === localizedParams.section),
  );

  if (availability === 'available' && page) {
    return { kind: 'page' as const, locale: localizedParams.lang, page, slugs };
  }

  if (availability === 'unavailable' && sourcePage) {
    return {
      kind: 'unavailable' as const,
      locale: localizedParams.lang,
      sourcePage,
      slugs,
    };
  }

  notFound();
}

export default async function Page({ params }: { params: Promise<RouteParams> }) {
  const state = resolvePage(await params);

  if (state.kind === 'unavailable') {
    return (
      <TranslationUnavailable
        locale={state.locale}
        sourceTitle={state.sourcePage.data.title}
        sourceUrl={state.sourcePage.url}
      />
    );
  }

  const MDX = state.page.data.body;
  const messages = getMessages(state.locale);
  const markdownUrl = getPageMarkdownUrl(state.page).url;
  const articleMetadata = {
    author: 'author' in state.page.data ? state.page.data.author : undefined,
    date: 'date' in state.page.data ? state.page.data.date : undefined,
    updated: 'updated' in state.page.data ? state.page.data.updated : undefined,
  };
  const toolDefinition = getToolDefinitionByPath(state.slugs.join('/'));
  // Helper 暫存頁僅在內文顯示開發狀態，避免必要的 metadata 描述重複呈現。
  const isHelperPreview = state.slugs.join('/') === 'tools/helper-overview'
    && state.page.data.description === '正在穩定性測試與開發中...';
  const body = (
    <DocsBody>
      <MDX
        components={getMDXComponents({
          a: createRelativeLink(source, state.page),
        }, { articleHeadings: true })}
      />
    </DocsBody>
  );

  if (toolDefinition) {
    const renderer = getToolRenderer(toolDefinition.renderer);
    if (!renderer) {
      throw new Error(
        `工具 ${toolDefinition.id} 的 renderer 未註冊：${toolDefinition.renderer}`,
      );
    }

    return renderer({
      page: {
        title: state.page.data.title,
        description: state.page.data.description ?? '',
        toc: state.page.data.toc,
        full: state.page.data.full,
        ...articleMetadata,
      },
      locale: state.locale,
      messages,
      body,
      markdownUrl,
    });
  }

  return (
    <ContextualDocsPage
      toc={state.page.data.toc}
      full={state.page.data.full}
      contextLabel={messages.context.onThisPage}
      contextPanelLabel={messages.context.panelLabel}
      contextCloseLabel={messages.context.closePanel}
    >
      <DocsTitle className={sitePageTitleClassName}>{state.page.data.title}</DocsTitle>
      {isHelperPreview ? null : (
        <DocsDescription className="mb-0">{state.page.data.description}</DocsDescription>
      )}
      {isArticleMetadataContentPath(state.slugs) ? (
        <ArticleMetadata
          {...articleMetadata}
          locale={state.locale}
          labels={messages.articleMetadata}
        />
      ) : null}
      <div className="flex flex-row items-center gap-2 border-b pb-6">
        <MarkdownCopyButton markdownUrl={getPageMarkdownUrl(state.page).url} />
      </div>
      {body}
    </ContextualDocsPage>
  );
}

export function generateStaticParams(): LocalizedRouteParams[] {
  const paramsByPath = new Map<string, LocalizedRouteParams>();

  function addPage(locale: Locale, slugs: string[]) {
    const [section, ...slug] = slugs;
    if (!section) return;

    const params = { lang: locale, section, slug };
    paramsByPath.set(`${locale}/${slugs.join('/')}`, params);
  }

  for (const locale of locales) {
    for (const page of source.getPages(locale)) {
      // Blog、About 與推薦頁由獨立路由輸出，避免 Static Export 互相覆寫。
      if (['blog', 'about', 'recommendations'].includes(page.slugs[0] ?? '')) continue;
      addPage(locale, page.slugs);
    }
  }

  for (const locale of locales) {
    if (locale === defaultLocale) continue;
    for (const page of source.getPages(defaultLocale)) {
      if (['blog', 'about', 'recommendations'].includes(page.slugs[0] ?? '')) continue;
      addPage(locale, page.slugs);
    }
  }

  return [...paramsByPath.values()];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const state = resolvePage(await params);

  if (state.kind === 'unavailable') {
    const messages = getMessages(state.locale).translationUnavailable;

    return {
      title: messages.title,
      description: messages.description,
      robots: {
        index: false,
        follow: true,
      },
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
      const translatedPage = source.getPage(state.slugs, locale);
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
    openGraph: {
      images: getPageImageUrl(state.page).url,
    },
  };
}
