import { HomeLayout } from 'fumadocs-ui/layouts/home';

import { HomePageContent } from '@/components/home-page-content';
import { defaultLocale } from '@/lib/i18n';
import { baseOptions } from '@/lib/layout.shared';

export default function LanguagePage() {
  return (
    <HomeLayout {...baseOptions(defaultLocale)} id="main-content">
      <HomePageContent locale={defaultLocale} />
    </HomeLayout>
  );
}
