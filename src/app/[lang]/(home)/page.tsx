import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { HomePageContent } from '@/components/home-page-content';
import { isLocale } from '@/lib/i18n';
import { getHomepageShareMetadata } from '@/lib/site-brand';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return getHomepageShareMetadata(lang);
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return <HomePageContent locale={lang} />;
}
