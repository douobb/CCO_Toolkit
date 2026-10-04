import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Provider } from '@/components/provider';
import { getHtmlLanguage, isLocale, locales, toLocalePath } from '@/lib/i18n';
import { withBasePath } from '@/lib/site-paths';
import { getMessages } from '@/lib/translations';
import '@/app/global.css';

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{ lang: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
    title: {
      default: 'CCO Toolkit',
      template: '%s | CCO Toolkit',
    },
    description: getMessages(lang).metadata.description,
    alternates: {
      canonical: withBasePath(toLocalePath(lang)),
      languages: Object.fromEntries(
        locales.map((locale) => [
          getHtmlLanguage(locale),
          withBasePath(toLocalePath(locale)),
        ]),
      ),
    },
  };
}

export default async function LocaleRootLayout({ children, params }: LocaleLayoutProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html
      lang={getHtmlLanguage(lang)}
      className="dark"
      style={{ colorScheme: 'dark' }}
    >
      <body className="flex min-h-screen flex-col">
        <Provider locale={lang}>{children}</Provider>
      </body>
    </html>
  );
}
