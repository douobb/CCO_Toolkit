import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Provider } from '@/components/provider';
import { defaultLocale, getHtmlLanguage } from '@/lib/i18n';
import '@/app/global.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'CCO Toolkit',
  description: '選擇 CCO Toolkit 的顯示語言。Choose your CCO Toolkit language.',
};

export default function LanguageRootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang={getHtmlLanguage(defaultLocale)}
      className="dark"
      style={{ colorScheme: 'dark' }}
    >
      <body className="min-h-screen">
        <Provider locale={defaultLocale}>{children}</Provider>
      </body>
    </html>
  );
}
