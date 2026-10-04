'use client';

import Link from 'next/link';
import { Languages } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { getHtmlLanguage, type Locale, suggestLocale, toLocalePath } from '@/lib/i18n';
import { getMessages } from '@/lib/translations';
import { SitePageTitle } from '@/components/site-page-title';

const choices: Array<{
  locale: Locale;
  label: string;
  description: string;
}> = [
  {
    locale: 'zh-tw',
    label: '繁體中文',
    description: getMessages('zh-tw').languageSelector.traditionalChineseDescription,
  },
  {
    locale: 'zh-cn',
    label: '简体中文',
    description: getMessages('zh-cn').languageSelector.simplifiedChineseDescription,
  },
  {
    locale: 'en',
    label: 'English',
    description: getMessages('en').languageSelector.englishDescription,
  },
];

function subscribeToBrowserLanguages(onStoreChange: () => void) {
  window.addEventListener('languagechange', onStoreChange);
  return () => window.removeEventListener('languagechange', onStoreChange);
}

function getBrowserLanguagesSnapshot() {
  return navigator.languages.join('\u0000');
}

function getServerLanguagesSnapshot() {
  return '';
}

export function LanguageSelector() {
  const messages = getMessages('zh-tw').languageSelector;
  const browserLanguages = useSyncExternalStore(
    subscribeToBrowserLanguages,
    getBrowserLanguagesSnapshot,
    getServerLanguagesSnapshot,
  );
  const suggestedLocale = browserLanguages
    ? suggestLocale(browserLanguages.split('\u0000'))
    : null;

  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center bg-fd-background px-5 py-12 text-fd-foreground sm:px-8"
    >
      <section className="w-full max-w-3xl" aria-labelledby="language-title">
        <div className="mb-8 text-center sm:mb-10">
          <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl border bg-fd-card shadow-sm">
            <Languages className="size-6" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium tracking-wide text-fd-muted-foreground">
            {messages.eyebrow}
          </p>
          <SitePageTitle id="language-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {messages.title}
            <span lang="en" className="mt-1 block text-xl font-medium text-fd-muted-foreground sm:text-2xl">
              {messages.subtitle}
            </span>
          </SitePageTitle>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-fd-muted-foreground sm:text-base">
            {messages.description}
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={messages.title}>
          {choices.map((choice) => {
            const isSuggested = suggestedLocale === choice.locale;

            return (
              <li key={choice.locale}>
                <Link
                  href={toLocalePath(choice.locale)}
                  lang={getHtmlLanguage(choice.locale)}
                  className="group flex min-h-40 flex-col rounded-2xl border bg-fd-card p-6 shadow-sm transition-colors hover:border-fd-primary hover:bg-fd-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background motion-reduce:transition-none"
                  aria-describedby={`language-description-${choice.locale}`}
                >
                  <span className="flex min-h-6 items-center text-xs font-medium text-fd-primary">
                    {isSuggested ? messages.suggested : null}
                  </span>
                  <span className="mt-2 text-xl font-semibold">{choice.label}</span>
                  <span
                    id={`language-description-${choice.locale}`}
                    className="mt-3 text-sm leading-6 text-fd-muted-foreground"
                  >
                    {choice.description}
                  </span>
                  <span className="mt-auto pt-5 text-sm font-medium text-fd-foreground group-hover:text-fd-primary">
                    {getMessages(choice.locale).languageSelector.enterSite}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="sr-only" aria-live="polite">
          {suggestedLocale ? `${messages.suggested}：${suggestedLocale}` : ''}
        </p>
      </section>
    </main>
  );
}
