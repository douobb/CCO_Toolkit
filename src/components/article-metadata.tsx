import { getIntlLocale, type Locale } from '@/lib/i18n';

export type ArticleMetadataDate = string | Date;

export interface ArticleMetadataLabels {
  readonly author: string;
  readonly published: string;
  readonly updated: string;
}

export interface ArticleMetadataProps {
  readonly author?: string;
  readonly date?: ArticleMetadataDate;
  readonly updated?: ArticleMetadataDate;
  readonly locale: Locale;
  readonly labels: ArticleMetadataLabels;
}

function getDateTime(value: ArticleMetadataDate | undefined): string | undefined {
  if (!value) return undefined;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString().slice(0, 10);
  }

  const normalized = value.trim();
  if (!normalized) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const date = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
      return undefined;
    }

    return normalized;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

function formatDate(value: ArticleMetadataDate | undefined, locale: Locale) {
  const dateTime = getDateTime(value);
  if (!dateTime) return undefined;

  return {
    dateTime,
    label: new Intl.DateTimeFormat(getIntlLocale(locale), {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${dateTime}T00:00:00.000Z`)),
  };
}

const articleMetadataSections = new Set(['guides', 'tools']);

/** Guide 與 Tool 文件使用共用文章 metadata；Blog 等專用頁面除外。 */
export function isArticleMetadataContentPath(slugs: readonly string[]): boolean {
  return articleMetadataSections.has(slugs[0] ?? '');
}

/** 顯示 frontmatter 文章資訊；所有欄位省略時不產生任何 markup。 */
export function ArticleMetadata({
  author,
  date,
  updated,
  locale,
  labels,
}: ArticleMetadataProps) {
  const normalizedAuthor = author?.trim();
  const published = formatDate(date, locale);
  const modified = formatDate(updated, locale);

  if (!normalizedAuthor && !published && !modified) return null;

  return (
    <dl
      data-article-metadata=""
      className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-sm leading-6 text-fd-muted-foreground"
    >
      {normalizedAuthor ? (
        <div className="flex min-w-0 max-w-full items-baseline gap-1.5">
          <dt>{labels.author}</dt>
          <dd className="min-w-0 break-words font-medium text-fd-foreground">
            {normalizedAuthor}
          </dd>
        </div>
      ) : null}
      {published ? (
        <div className="flex min-w-0 max-w-full items-baseline gap-1.5">
          <dt>{labels.published}</dt>
          <dd className="min-w-0 break-words font-medium text-fd-foreground">
            <time dateTime={published.dateTime}>{published.label}</time>
          </dd>
        </div>
      ) : null}
      {modified ? (
        <div className="flex min-w-0 max-w-full items-baseline gap-1.5">
          <dt>{labels.updated}</dt>
          <dd className="min-w-0 break-words font-medium text-fd-foreground">
            <time dateTime={modified.dateTime}>{modified.label}</time>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
