import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { DocsBody } from 'fumadocs-ui/layouts/docs/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';

import { Changelog, Contributors } from '@/components/site-content';
import { getMDXComponents } from '@/components/mdx';
import { SitePageTitle } from '@/components/site-page-title';
import { SiteTranslationUnavailable } from '@/components/site-translation-unavailable';
import { getContributorRecordViews } from '@/lib/contributor-content-source';
import { defaultLocale, getHtmlLanguage, isLocale, locales, type Locale } from '@/lib/i18n';
import { getMessages } from '@/lib/translations';
import { getPageImageUrl, source } from '@/lib/source';
import { getAcceptedContributionRecords } from '@/lib/site-content';
import { siteOgCover } from '@/lib/site-brand';
import { withBasePath } from '@/lib/site-paths';

import styles from '../page-hero.module.css';

type AboutRouteParams = { lang: string };

export const dynamicParams = false;

function getAboutPage(locale: Locale) {
  return source.getPage(['about'], locale);
}

function getFallbackMetadata(locale: Locale, sourcePage: ReturnType<typeof getAboutPage>): Metadata {
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

export default async function AboutPage({
  params,
}: {
  params: Promise<AboutRouteParams>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const page = getAboutPage(lang);
  if (!page && lang !== defaultLocale) {
    const sourcePage = getAboutPage(defaultLocale);
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
  const messages = getMessages(lang).aboutPage;
  const contributorRecordViews = getContributorRecordViews(
    lang,
    getAcceptedContributionRecords(),
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className={`${styles.hero} dark`}>
        <div className={styles.artwork} aria-hidden="true">
          <div className="mx-auto h-full w-full max-w-5xl px-6 sm:px-10">
            <div className={styles.artworkFrame}>
              <Image
                src={withBasePath(siteOgCover.path)}
                alt=""
                fill
                sizes="(min-width: 976px) 896px, (min-width: 640px) calc(100vw - 80px), calc(100vw - 48px)"
                className={styles.heroImage}
              />
              <div className={styles.heroShade} />
            </div>
          </div>
        </div>
        <div
          className={`${styles.heroContent} mx-auto w-full max-w-5xl px-6 pt-12 pb-10 sm:px-10 sm:pt-16`}
        >
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-medium text-fd-muted-foreground">{messages.eyebrow}</p>
            <SitePageTitle className="text-4xl font-bold tracking-tight text-fd-foreground sm:text-5xl">
              {page.data.title}
            </SitePageTitle>
            <p className="mt-5 text-lg text-fd-muted-foreground">
              {page.data.description}
            </p>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 pb-12 sm:px-10 sm:pb-16">
        <article className="max-w-4xl border-t pt-8">
          <DocsBody>
            <MDX
              components={getMDXComponents({
                a: createRelativeLink(source, page),
                Changelog: ({ limit }: { limit?: number }) => (
                  <Changelog locale={lang} limit={limit} />
                ),
                Contributors: () => (
                  <Contributors locale={lang} recordViews={contributorRecordViews} />
                ),
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
  params: Promise<AboutRouteParams>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const page = getAboutPage(lang);
  if (!page) {
    return getFallbackMetadata(lang, getAboutPage(defaultLocale));
  }

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: {
      canonical: withBasePath(page.url),
      languages: Object.fromEntries(
        locales.flatMap((locale) => {
          const translatedPage = getAboutPage(locale);
          return translatedPage
            ? [[getHtmlLanguage(locale), withBasePath(translatedPage.url)]]
            : [];
        }),
      ),
    },
    openGraph: { images: getPageImageUrl(page).url },
  };
}
