import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { isLocale } from '@/lib/i18n';
import { docsOptions } from '@/lib/layout.shared';
import { docsSource } from '@/lib/source';

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string; section: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <DocsLayout
      tree={docsSource.getPageTree(lang)}
      {...docsOptions(lang)}
      tabMode="auto"
      sidebar={{ collapsible: true }}
    >
      {children}
    </DocsLayout>
  );
}
