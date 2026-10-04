'use client';

import Link from 'fumadocs-core/link';
import { usePathname } from 'fumadocs-core/framework';
import { useI18n } from 'fumadocs-ui/contexts/i18n';
import { LanguageSelect, type LanguageSelectProps } from 'fumadocs-ui/layouts/shared/slots/language-select';
import { UserRoundCog } from 'lucide-react';

import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { cn } from '@/lib/cn';
import { defaultLocale, isLocale, toLocalePath } from '@/lib/i18n';
import { getToolDefinitionByPath } from '@/lib/tools';
import { getMessages } from '@/lib/translations';

/**
 * 以 locale 後的 section 判斷工具頁，並用 registry 確認工具路徑。
 * 工具總覽沒有對應的 renderer，因此另外納入 tools 根路徑。
 */
export function isToolPagePath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  const localeIndex = segments.findIndex((segment) => isLocale(segment));
  const toolsSegmentIndex = localeIndex + 1;
  if (localeIndex < 0 || segments[toolsSegmentIndex] !== 'tools') return false;

  const toolPath = segments.slice(toolsSegmentIndex).join('/');
  if (toolPath === 'tools') return true;

  return getToolDefinitionByPath(toolPath) !== undefined;
}

function useShowToolPlayerSettingsLink(): boolean {
  const pathname = usePathname();
  return isToolPagePath(pathname ?? '');
}

function usePlayerSettingsLink(): { readonly href: string; readonly label: string } {
  const { locale } = useI18n();
  const currentLocale = locale && isLocale(locale) ? locale : defaultLocale;

  return {
    href: toLocalePath(currentLocale, 'settings'),
    label: getMessages(currentLocale).settingsPage.title,
  };
}

/** 工具頁桌面側欄中的全域玩家設定入口。 */
export function ToolPlayerSettingsLanguageSelect({
  children,
  ...languageSelectProps
}: LanguageSelectProps) {
  const shouldShowLink = useShowToolPlayerSettingsLink();
  const { href, label } = usePlayerSettingsLink();

  return (
    <>
      {shouldShowLink ? (
          <Link
            href={href}
            data-cco-player-settings-link="desktop"
            className={cn(
              buttonVariants({ variant: 'secondary' }),
              'mb-2 hidden w-full justify-start gap-1.5 bg-fd-secondary/50 p-1.5 text-start text-fd-muted-foreground md:inline-flex',
            )}
            aria-label={label}
            title={label}
          >
            <UserRoundCog className="size-4.5" aria-hidden="true" />
            <span>{label}</span>
          </Link>
      ) : null}
      <LanguageSelect {...languageSelectProps}>{children}</LanguageSelect>
    </>
  );
}

/** 工具頁行動版頂部 bar 的 icon-only 全域玩家設定入口。 */
export function ToolPlayerSettingsHeaderLink() {
  const shouldShowLink = useShowToolPlayerSettingsLink();
  const { href, label } = usePlayerSettingsLink();
  if (!shouldShowLink) return null;

  return (
    <Link
      href={href}
      data-cco-player-settings-link="mobile"
      className={cn(
        buttonVariants({ variant: 'ghost' }),
        'size-9 p-2 text-fd-muted-foreground [&_svg]:size-4.5',
      )}
      aria-label={label}
      title={label}
    >
      <UserRoundCog aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </Link>
  );
}
