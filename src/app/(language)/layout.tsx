import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Provider } from '@/components/provider';
import { defaultLocale, toLocalePath } from '@/lib/i18n';
import { withBasePath } from '@/lib/site-paths';
import { getHomepageShareCopy, getHomepageShareMetadata } from '@/lib/site-brand';
import {
  SITE_TITLE_PHASE_BOOTSTRAP_SCRIPT,
  SITE_TITLE_PHASE_STYLE_ID,
} from '@/lib/site-title-phase';
import '@/app/global.css';

const homepageShareCopy = getHomepageShareCopy(defaultLocale);
const homepageSeoTitle = 'CCO Toolkit｜CyberCode Online 工具與教學';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: homepageSeoTitle,
  description: homepageShareCopy.description,
  ...getHomepageShareMetadata(defaultLocale),
  alternates: {
    canonical: withBasePath(toLocalePath(defaultLocale)),
  },
};

export default function LanguageRootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="zh-Hant"
      className="dark"
      style={{ colorScheme: 'dark' }}
    >
      <head>
        <style id={SITE_TITLE_PHASE_STYLE_ID}></style>
        <script
          dangerouslySetInnerHTML={{ __html: SITE_TITLE_PHASE_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <Provider locale={defaultLocale}>{children}</Provider>
      </body>
    </html>
  );
}
