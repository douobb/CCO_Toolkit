import { loader } from 'fumadocs-core/source';
import { defineI18n } from 'fumadocs-core/i18n';
import { docsContentRoute, docsImageRoute, docsRoute } from './shared';
import { defaultLocale, i18n, isLocale, locales } from './i18n';
import { defineDocs } from 'fumadocs-mdx/macro';
import { pageSchema } from 'fumadocs-core/source/schema';
import { withBasePath, withBasePathInMarkdown } from './site-paths';
import { assertContentDataReferenceConsistency } from './content-data-consistency';
import {
  acceptedContributionRecords,
  assertContributorDataConsistency,
  contributorProfiles,
} from './site-content';
import {
  blogFrontmatterSchema,
  guideFrontmatterSchema,
  toolFrontmatterSchema,
} from './content-schema';
import { assertToolRegistryConsistency } from './tools/consistency';
import { toolRegistry } from './tools/registry';
import {
  localizedMetaSchema,
  simplifiedChinesePageTreeTransformer,
} from './docs-navigation';

const tools = defineDocs({
  dir: 'content/tools',
  docs: {
    schema: toolFrontmatterSchema,
    postprocess: { includeProcessedMarkdown: true },
  },
  meta: { schema: localizedMetaSchema },
});

const guides = defineDocs({
  dir: 'content/guides',
  docs: {
    schema: guideFrontmatterSchema,
    postprocess: { includeProcessedMarkdown: true },
  },
  meta: { schema: localizedMetaSchema },
});

const blog = defineDocs({
  dir: 'content/blog',
  docs: {
    schema: blogFrontmatterSchema,
    postprocess: { includeProcessedMarkdown: true },
  },
  meta: { schema: localizedMetaSchema },
});

const about = defineDocs({
  dir: 'content/about',
  docs: { schema: pageSchema, postprocess: { includeProcessedMarkdown: true } },
  meta: { schema: localizedMetaSchema },
});

const recommendations = defineDocs({
  dir: 'content/recommendations',
  docs: { schema: pageSchema, postprocess: { includeProcessedMarkdown: true } },
  meta: { schema: localizedMetaSchema },
});

const docsTreeI18n = defineI18n({
  languages: [...locales],
  defaultLanguage: defaultLocale,
  hideLocale: 'never',
  parser: 'dot',
  fallbackLanguage: defaultLocale,
});

export const source = loader({
  baseUrl: docsRoute,
  i18n,
  source: {
    tools: tools.toFumadocsSource({ baseDir: 'tools' }),
    guides: guides.toFumadocsSource({ baseDir: 'guides' }),
    blog: blog.toFumadocsSource({ baseDir: 'blog' }),
    about: about.toFumadocsSource({ baseDir: 'about' }),
    recommendations: recommendations.toFumadocsSource({ baseDir: 'recommendations' }),
  },
  pageTree: { transformers: [simplifiedChinesePageTreeTransformer] },
  plugins: [],
});

/**
 * 建置／模組載入時逐語系檢查實際存在的可執行工具頁與其 path、toolId 是否一致。
 * i18n fallback 為 null，因此未翻譯的語系不會被當成已存在的 fallback Tool page。
 */
const localizedContentPages = locales.flatMap((locale) =>
  source.getPages(locale).map((page) => ({
    locale,
    slugs: page.slugs,
    data: page.data,
  })),
);

assertToolRegistryConsistency(toolRegistry, localizedContentPages);
assertContentDataReferenceConsistency(localizedContentPages);
assertContributorDataConsistency(
  contributorProfiles,
  acceptedContributionRecords,
  localizedContentPages.map(({ locale, slugs }) => ({ locale, path: slugs.join('/') })),
);

/** 文件側欄只使用工具與教學，非預設語系缺頁則以預設語系內容建立 fallback tree。 */
export const docsSource = loader({
  baseUrl: docsRoute,
  i18n: docsTreeI18n,
  source: {
    tools: tools.toFumadocsSource({ baseDir: 'tools' }),
    guides: guides.toFumadocsSource({ baseDir: 'guides' }),
  },
  pageTree: { transformers: [simplifiedChinesePageTreeTransformer] },
  plugins: [],
});

/** Blog 使用獨立 loader，讓列表與單篇文章頁能取得專用 metadata 型別。 */
export const blogSource = loader({
  baseUrl: docsRoute,
  i18n,
  source: {
    blog: blog.toFumadocsSource({ baseDir: 'blog' }),
  },
  plugins: [],
});

export function getPageImageUrl(page: (typeof source)['$inferPage']) {
  if (!page.locale || !isLocale(page.locale)) {
    throw new Error(`頁面缺少有效 locale：${page.url}`);
  }

  const segments = [page.locale, ...page.slugs, 'image.png'];

  return {
    segments,
    url: withBasePath('/' + [...docsImageRoute.split('/'), ...segments].filter(Boolean).join('/')),
  };
}

export function getPageMarkdownUrl(page: (typeof source)['$inferPage']) {
  if (!page.locale || !isLocale(page.locale)) {
    throw new Error(`頁面缺少有效 locale：${page.url}`);
  }

  const segments = [page.locale, ...page.slugs, 'content.md'];

  return {
    segments,
    url: withBasePath('/' + [...docsContentRoute.split('/'), ...segments].filter(Boolean).join('/')),
  };
}

export async function getLLMText(page: (typeof source)['$inferPage']) {
  const processed = await page.data.getText('processed');

  return `# ${page.data.title} (${withBasePath(page.url)})

${withBasePathInMarkdown(processed)}`;
}
