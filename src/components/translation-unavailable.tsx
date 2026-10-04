import Link from 'next/link';
import { ArrowLeft, Languages } from 'lucide-react';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page';
import { defaultLocale, getHtmlLanguage, toLocalePath, type Locale } from '@/lib/i18n';
import { getMessages } from '@/lib/translations';
import { sitePageTitleClassName } from '@/components/site-page-title';

export function TranslationUnavailable({
  locale,
  sourceTitle,
  sourceUrl,
}: {
  locale: Locale;
  sourceTitle: string;
  sourceUrl: string;
}) {
  const messages = getMessages(locale).translationUnavailable;

  return (
    <DocsPage toc={[]}>
      <p className="mb-3 flex items-center gap-2 text-sm font-medium text-fd-muted-foreground">
        <Languages className="size-4" aria-hidden="true" />
        {messages.eyebrow}
      </p>
      <DocsTitle className={sitePageTitleClassName}>{messages.title}</DocsTitle>
      <DocsDescription>{messages.description}</DocsDescription>
      <DocsBody>
        <div className="mt-8 rounded-2xl border bg-fd-card p-5 sm:p-6">
          <p className="text-sm text-fd-muted-foreground">{messages.sourceLabel}</p>
          <p lang={getHtmlLanguage(defaultLocale)} className="mt-1 text-lg font-semibold text-fd-foreground">
            {sourceTitle}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={sourceUrl}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              {messages.openTraditionalChinese}
            </Link>
            <Link
              href={toLocalePath(locale)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-fd-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {messages.backToEnglishHome}
            </Link>
          </div>
        </div>
      </DocsBody>
    </DocsPage>
  );
}
