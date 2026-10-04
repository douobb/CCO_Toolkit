import Link from 'next/link';
import { ArrowLeft, Languages } from 'lucide-react';

import { defaultLocale, getHtmlLanguage, toLocalePath, type Locale } from '@/lib/i18n';
import { getMessages } from '@/lib/translations';
import { SitePageTitle } from '@/components/site-page-title';

export function SiteTranslationUnavailable({
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
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:px-10 sm:py-16">
        <p className="mb-3 flex items-center gap-2 text-sm font-medium text-fd-muted-foreground">
          <Languages className="size-4" aria-hidden="true" />
          {messages.eyebrow}
        </p>
        <SitePageTitle className="text-3xl font-bold tracking-tight sm:text-4xl">{messages.title}</SitePageTitle>
        <p className="mt-5 text-lg text-fd-muted-foreground">{messages.description}</p>
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
      </div>
    </div>
  );
}
