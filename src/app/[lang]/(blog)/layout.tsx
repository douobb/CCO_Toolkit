import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { isLocale } from '@/lib/i18n';
import { baseOptions } from '@/lib/layout.shared';

export default async function BlogLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <HomeLayout {...baseOptions(lang)} id="main-content">
      {children}
    </HomeLayout>
  );
}
