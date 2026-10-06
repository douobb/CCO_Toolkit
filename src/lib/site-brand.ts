import type { Metadata } from 'next';

import { toLocalePath, type Locale } from './i18n';
import { withBasePath } from './site-paths';

export const siteOgCover = {
  path: '/images/brand/og-cover.jpg',
  width: 1200,
  height: 630,
  type: 'image/jpeg',
} as const;

export const siteAboutBanner = {
  path: '/images/brand/about-banner.webp',
  width: 1200,
  height: 630,
  type: 'image/webp',
} as const;

const homepageShareCopy = {
  'zh-tw': {
    title: 'CCO Toolkit',
    description: 'CyberCode Online 的計算工具與遊戲教學。',
    imageAlt: '賽博城市',
    locale: 'zh_TW',
  },
  'zh-cn': {
    title: 'CCO Toolkit',
    description: 'CyberCode Online 的计算工具与游戏教程。',
    imageAlt: '赛博城市',
    locale: 'zh_CN',
  },
  en: {
    title: 'CCO Toolkit',
    description: 'CyberCode Online calculators and game guides.',
    imageAlt: 'Cyberpunk city',
    locale: 'en_US',
  },
} satisfies Record<Locale, { title: string; description: string; imageAlt: string; locale: string }>;

export function getHomepageShareCopy(locale: Locale) {
  return homepageShareCopy[locale];
}

export function getHomepageShareMetadata(locale: Locale, basePath?: string): Metadata {
  const copy = getHomepageShareCopy(locale);
  const imageUrl = withBasePath(siteOgCover.path, basePath);

  return {
    openGraph: {
      title: copy.title,
      description: copy.description,
      type: 'website',
      siteName: 'CCO Toolkit',
      url: withBasePath(toLocalePath(locale), basePath),
      locale: copy.locale,
      images: [
        {
          url: imageUrl,
          width: siteOgCover.width,
          height: siteOgCover.height,
          type: siteOgCover.type,
          alt: copy.imageAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: copy.title,
      description: copy.description,
      images: [{ url: imageUrl, alt: copy.imageAlt }],
    },
  };
}
