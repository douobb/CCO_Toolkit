import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SharedUserInputsManager } from '@/components/shared-user-inputs';
import { PlayerDataManager } from '@/components/player-data-manager';
import { SitePageTitle } from '@/components/site-page-title';
import { getHtmlLanguage, isLocale, locales, toLocalePath } from '@/lib/i18n';
import { withBasePath } from '@/lib/site-paths';
import { getMessages } from '@/lib/translations';

type SettingsRouteParams = { lang: string };

export const dynamicParams = false;

export default async function SettingsPage({ params }: { params: Promise<SettingsRouteParams> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const messages = getMessages(lang).settingsPage;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-8 sm:py-14">
        <header className="max-w-3xl">
          <p className="mb-3 text-sm font-medium text-fd-muted-foreground">{messages.eyebrow}</p>
          <SitePageTitle className="text-3xl font-bold tracking-tight sm:text-4xl">
            {messages.title}
          </SitePageTitle>
          <p className="mt-4 text-base leading-7 text-fd-muted-foreground sm:text-lg">
            {messages.description}
          </p>
        </header>
        <div className="mt-8 space-y-8">
          <SharedUserInputsManager labels={messages} locale={lang} />
          <PlayerDataManager labels={messages.dataManagement} />
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<SettingsRouteParams> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const messages = getMessages(lang).settingsPage;
  return {
    title: messages.title,
    description: messages.description,
    alternates: {
      canonical: withBasePath(toLocalePath(lang, 'settings')),
      languages: Object.fromEntries(
        locales.map((locale) => [
          getHtmlLanguage(locale),
          withBasePath(toLocalePath(locale, 'settings')),
        ]),
      ),
    },
  };
}
