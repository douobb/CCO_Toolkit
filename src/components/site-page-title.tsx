import type { ComponentProps } from 'react';

export const sitePageTitleClassName = 'site-title-glow site-title-glow--page';
export const siteHomeTitleClassName = 'site-title-glow site-title-glow--home';

export type SitePageTitleProps = ComponentProps<'h1'> & {
  appearance?: 'page' | 'home';
};

export function SitePageTitle({
  appearance = 'page',
  className,
  ...props
}: SitePageTitleProps) {
  const titleClassName = appearance === 'home'
    ? siteHomeTitleClassName
    : sitePageTitleClassName;

  return (
    <h1
      {...props}
      className={[titleClassName, className].filter(Boolean).join(' ')}
    />
  );
}
