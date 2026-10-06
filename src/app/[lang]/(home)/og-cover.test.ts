import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parse, type AtRule, type Rule } from 'postcss';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import AboutPage from './about/page';
import aboutStyles from './page-hero.module.css';
import { generateMetadata } from './page';
import RecommendationsPage from './recommendations/page';
import { getHomepageShareMetadata, siteAboutBanner, siteOgCover } from '@/lib/site-brand';
import { toLocalePath, type Locale } from '@/lib/i18n';
import { withBasePath } from '@/lib/site-paths';

vi.mock('@/lib/source', () => ({
  source: {
    getPage: () => ({
      url: '/zh-tw/about',
      data: {
        title: 'About',
        description: 'About description',
        body: () => null,
      },
    }),
  },
  getPageImageUrl: () => ({ url: '/about-og.jpg' }),
}));
vi.mock('@/lib/contributor-content-source', () => ({ getContributorRecordViews: () => [] }));
vi.mock('@/lib/site-content', () => ({ getAcceptedContributionRecords: () => [] }));
vi.mock('@/components/site-content', () => ({
  Changelog: () => null,
  Contributors: () => null,
  RecommendationsGrid: () => null,
}));
vi.mock('@/components/mdx', () => ({ getMDXComponents: () => ({}) }));
vi.mock('@/components/site-translation-unavailable', () => ({ SiteTranslationUnavailable: () => null }));
vi.mock('fumadocs-ui/layouts/docs/page', () => ({
  DocsBody: ({ children }: { children: import('react').ReactNode }) => children,
}));
vi.mock('fumadocs-ui/mdx', () => ({ createRelativeLink: () => () => null }));

const imagePath = fileURLToPath(new URL('../../../../public/images/brand/og-cover.jpg', import.meta.url));
const aboutBannerImagePath = fileURLToPath(
  new URL('../../../../public/images/brand/about-banner.webp', import.meta.url),
);
const aboutStylesPath = new URL('./page-hero.module.css', import.meta.url);

const shareCases = [
  [
    'zh-tw',
    {
      title: 'CCO Toolkit',
      description: 'CyberCode Online 的計算工具與遊戲教學。',
      imageAlt: '賽博城市',
      locale: 'zh_TW',
    },
  ],
  [
    'zh-cn',
    {
      title: 'CCO Toolkit',
      description: 'CyberCode Online 的计算工具与游戏教程。',
      imageAlt: '赛博城市',
      locale: 'zh_CN',
    },
  ],
  [
    'en',
    {
      title: 'CCO Toolkit',
      description: 'CyberCode Online calculators and game guides.',
      imageAlt: 'Cyberpunk city',
      locale: 'en_US',
    },
  ],
] as const satisfies ReadonlyArray<readonly [Locale, { title: string; description: string; imageAlt: string; locale: string }] >;

describe('homepage share metadata and OG cover', () => {
  it.each(shareCases)('uses the confirmed share fields for %s without changing browser metadata', async (locale, copy) => {
    const metadata = await generateMetadata({ params: Promise.resolve({ lang: locale }) });
    const imageUrl = withBasePath(siteOgCover.path);

    expect(metadata.title).toBeUndefined();
    expect(metadata.description).toBeUndefined();
    expect(metadata.metadataBase).toBeUndefined();
    expect(metadata.openGraph).toMatchObject({
      title: copy.title,
      description: copy.description,
      type: 'website',
      siteName: 'CCO Toolkit',
      url: withBasePath(toLocalePath(locale)),
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
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      title: copy.title,
      description: copy.description,
      images: [{ url: imageUrl, alt: copy.imageAlt }],
    });
  });

  it('rejects unsupported locales', async () => {
    await expect(generateMetadata({ params: Promise.resolve({ lang: 'fr' }) })).rejects.toThrow();
  });

  it('applies an explicit deployment basePath to homepage and matching social image URLs', () => {
    const metadata = getHomepageShareMetadata('en', '/preview');

    expect(metadata.openGraph).toMatchObject({
      url: withBasePath(toLocalePath('en'), '/preview'),
      images: [{ url: withBasePath(siteOgCover.path, '/preview') }],
    });
    expect(metadata.twitter).toMatchObject({
      images: [{ url: withBasePath(siteOgCover.path, '/preview'), alt: 'Cyberpunk city' }],
    });
  });

  it('serves a 1200×630 JPEG within a reasonable size', async () => {
    const [image, file] = await Promise.all([sharp(imagePath).metadata(), stat(imagePath)]);

    expect(image).toMatchObject({
      width: siteOgCover.width,
      height: siteOgCover.height,
      format: 'jpeg',
    });
    expect(file.size).toBeGreaterThan(0);
    expect(file.size).toBeLessThan(512 * 1024);
  });

  it('serves a 1200×630 WebP for the About banner within a reasonable size', async () => {
    const [image, file] = await Promise.all([
      sharp(aboutBannerImagePath).metadata(),
      stat(aboutBannerImagePath),
    ]);

    expect(siteAboutBanner).toMatchObject({
      path: '/images/brand/about-banner.webp',
      width: 1200,
      height: 630,
      type: 'image/webp',
    });
    expect(image).toMatchObject({
      width: siteAboutBanner.width,
      height: siteAboutBanner.height,
      format: 'webp',
    });
    expect(file.size).toBeGreaterThan(0);
    expect(file.size).toBeLessThan(512 * 1024);
  });

  it('matches the recommendation heading baseline within one full-width decorative hero', async () => {
    const page = await AboutPage({ params: Promise.resolve({ lang: 'zh-tw' }) });
    const markup = renderToStaticMarkup(page);
    const recommendations = await RecommendationsPage({
      params: Promise.resolve({ lang: 'zh-tw' }),
    });
    const recommendationsMarkup = renderToStaticMarkup(recommendations);
    const aboutBannerUrl = withBasePath(siteAboutBanner.path);
    const ogCoverUrl = withBasePath(siteOgCover.path);
    const heroStart = markup.indexOf(`<header class="${aboutStyles.hero} dark">`);
    const heroEnd = markup.indexOf('</header>', heroStart);
    const heroMarkup = markup.slice(heroStart, heroEnd);
    const heroTagEnd = markup.indexOf('>', heroStart);
    const heroOpeningTag = markup.slice(heroStart, heroTagEnd + 1);
    const imageIndex = markup.indexOf('<img');
    const artworkIndex = heroMarkup.indexOf(`<div class="${aboutStyles.artwork}"`);
    const artworkOuterIndex = heroMarkup.indexOf(
      'class="mx-auto h-full w-full max-w-5xl px-6 sm:px-10"',
    );
    const artworkFrameIndex = heroMarkup.indexOf(`class="${aboutStyles.artworkFrame}"`);
    const artworkImageIndex = heroMarkup.indexOf(`class="${aboutStyles.heroImage}"`);
    const artworkShadeIndex = heroMarkup.indexOf(`class="${aboutStyles.heroShade}"`);
    const artworkMarkup = heroMarkup.slice(
      artworkIndex,
      heroMarkup.indexOf(`<div class="${aboutStyles.heroContent}`, artworkIndex),
    );
    const articleIndex = markup.indexOf('<article');
    const titleIndex = markup.indexOf('<h1');
    const descriptionIndex = markup.indexOf('About description');
    const recommendationsHeaderStart = recommendationsMarkup.indexOf('<header');
    const recommendationsHeaderEnd = recommendationsMarkup.indexOf(
      '</header>',
      recommendationsHeaderStart,
    );
    const recommendationsHeader = recommendationsMarkup.slice(
      recommendationsHeaderStart,
      recommendationsHeaderEnd,
    );
    const recommendationsBannerUrl = withBasePath('/images/brand/ciallo-banner.webp');
    const aboutEyebrowClass = heroMarkup.match(/<p class="([^"]+)"/)?.[1];
    const recommendationsEyebrowClass = recommendationsHeader.match(/<p class="([^"]+)"/)?.[1];
    const aboutTitleClass = heroMarkup.match(/<h1 class="([^"]+)"/)?.[1]?.split(' ');
    const recommendationsTitleClass = recommendationsHeader.match(/<h1 class="([^"]+)"/)?.[1]?.split(' ');
    const aboutDescriptionClass = heroMarkup.match(/<p class="(mt-5[^"]*)"/)?.[1];
    const recommendationsDescriptionClass = recommendationsHeader.match(/<p class="(mt-5[^"]*)"/)?.[1];

    expect(heroStart).toBeGreaterThanOrEqual(0);
    expect(heroEnd).toBeGreaterThan(heroStart);
    expect(heroOpeningTag).toContain('dark');
    expect(heroOpeningTag).not.toMatch(/max-w|rounded|border|shadow/);
    const heroContentLayout =
      `${aboutStyles.heroContent} mx-auto w-full max-w-5xl px-6 pt-12 pb-10 sm:px-10 sm:pt-16`;
    expect(markup).toContain(heroContentLayout);
    expect(recommendationsMarkup).toContain(heroContentLayout);
    expect(markup).toContain('mx-auto w-full max-w-5xl flex-1 px-6 pb-12 sm:px-10 sm:pb-16');
    expect(markup).toContain('<article class="max-w-4xl border-t pt-8">');
    expect(recommendationsMarkup).toContain('<article class="max-w-5xl border-t pt-8">');
    expect(heroMarkup).toContain('max-w-3xl');
    expect(artworkIndex).toBeGreaterThanOrEqual(0);
    expect(artworkOuterIndex).toBeGreaterThan(artworkIndex);
    expect(artworkFrameIndex).toBeGreaterThan(artworkOuterIndex);
    expect(artworkImageIndex).toBeGreaterThan(artworkFrameIndex);
    expect(artworkShadeIndex).toBeGreaterThan(artworkImageIndex);
    expect(artworkMarkup.startsWith(
      `<div class="${aboutStyles.artwork}" aria-hidden="true"><div class="mx-auto h-full w-full max-w-5xl px-6 sm:px-10"><div class="${aboutStyles.artworkFrame}">`,
    )).toBe(true);
    expect(artworkMarkup).toContain(`class="${aboutStyles.artworkFrame}"`);
    expect(artworkMarkup).toContain(`class="${aboutStyles.heroImage}"`);
    expect(artworkMarkup).toContain(`class="${aboutStyles.heroShade}"`);
    expect(artworkMarkup.endsWith('</div></div></div>')).toBe(true);
    expect(recommendationsHeader).toContain(`class="${aboutStyles.hero} dark"`);
    expect(recommendationsHeader).toContain(
      `class="${aboutStyles.artwork}" aria-hidden="true"`,
    );
    expect(recommendationsHeader).toContain(encodeURIComponent(recommendationsBannerUrl));
    expect(recommendationsHeader).toContain('alt=""');
    expect(recommendationsHeader).toContain('object-position:75% 44%');
    expect(recommendationsHeader).toContain(`class="${aboutStyles.artworkFrame}"`);
    expect(recommendationsHeader).toContain(`class="${aboutStyles.heroShade}"`);
    expect(aboutEyebrowClass).toBe(recommendationsEyebrowClass);
    expect(aboutTitleClass?.filter((className) => className !== 'text-fd-foreground')).toEqual(
      recommendationsTitleClass,
    );
    expect(aboutDescriptionClass).toBe(recommendationsDescriptionClass);
    expect(imageIndex).toBeGreaterThan(heroStart);
    expect(imageIndex).toBeLessThan(heroEnd);
    expect(titleIndex).toBeGreaterThan(heroStart);
    expect(titleIndex).toBeLessThan(heroEnd);
    expect(descriptionIndex).toBeGreaterThan(heroStart);
    expect(descriptionIndex).toBeLessThan(heroEnd);
    expect(markup.match(/<h1\b/g)).toHaveLength(1);
    expect(markup.match(/<img\b/g)).toHaveLength(1);
    expect(articleIndex).toBeGreaterThan(heroEnd);
    expect(
      heroMarkup.includes(`src="${aboutBannerUrl}"`)
      || heroMarkup.includes(`url=${encodeURIComponent(aboutBannerUrl)}`),
    ).toBe(true);
    expect(heroMarkup).not.toContain(`url=${encodeURIComponent(ogCoverUrl)}`);
    expect(markup).toContain('alt=""');
    expect(markup).toContain('data-nimg="fill"');
    expect(markup).toContain(
      'sizes="(min-width: 976px) 896px, (min-width: 640px) calc(100vw - 80px), calc(100vw - 48px)"',
    );
    expect(markup).toContain('About description');
    expect(heroMarkup).toContain('text-fd-foreground');
    expect(heroMarkup).toContain('text-fd-muted-foreground');
    expect(heroMarkup).not.toContain('text-white');
    expect(heroMarkup).not.toContain('opacity-');
  });

  it('keeps the cover out of flow and preserves a natural, text-driven hero height', async () => {
    const stylesheet = parse(await readFile(aboutStylesPath, 'utf8'));
    const baseRules = stylesheet.nodes?.filter((node): node is Rule => node.type === 'rule') ?? [];
    const heroRule = baseRules.find((rule) => rule.selector === '.hero');
    const artworkRule = baseRules.find((rule) => rule.selector === '.artwork');
    const artworkFrameRule = baseRules.find((rule) => rule.selector === '.artworkFrame');
    const imageRule = baseRules.find((rule) => rule.selector === '.heroImage');
    const shadeRule = baseRules.find((rule) => rule.selector === '.heroShade');
    const contentRule = baseRules.find((rule) => rule.selector === '.heroContent');
    const desktopMedia = stylesheet.nodes?.find(
      (node): node is AtRule => node.type === 'atrule' && node.params === '(min-width: 640px)',
    );
    const desktopRules = desktopMedia?.nodes?.filter((node): node is Rule => node.type === 'rule') ?? [];
    const desktopImageRule = desktopRules.find((rule) => rule.selector === '.heroImage');
    const desktopContentRule = desktopRules.find((rule) => rule.selector === '.heroContent');

    const getDeclarations = (rule: Rule | undefined) => {
      const declarations: Record<string, string> = {};
      rule?.walkDecls((declaration) => {
        declarations[declaration.prop] = declaration.value;
      });
      return declarations;
    };

    expect(getDeclarations(heroRule)).toMatchObject({
      position: 'relative',
      isolation: 'isolate',
      overflow: 'hidden',
    });
    expect(getDeclarations(heroRule)).not.toHaveProperty('height');
    expect(getDeclarations(heroRule)).not.toHaveProperty('min-height');
    expect(getDeclarations(heroRule)).not.toHaveProperty('background');
    expect(getDeclarations(heroRule)).not.toHaveProperty('background-color');
    expect(getDeclarations(heroRule)).not.toHaveProperty('background-image');
    expect(getDeclarations(artworkRule)).toMatchObject({
      position: 'absolute',
      'z-index': '-1',
      inset: '0',
      'pointer-events': 'none',
    });
    expect(getDeclarations(artworkFrameRule)).toMatchObject({
      position: 'relative',
      isolation: 'isolate',
      width: '100%',
      'max-width': '56rem',
      height: '100%',
      background: '#05070d',
    });
    expect(getDeclarations(artworkFrameRule)['mask-image']).toContain(
      'linear-gradient(90deg, transparent 0%, #000 5%, #000 95%, transparent 100%)',
    );
    expect(getDeclarations(artworkFrameRule)['mask-image']).toContain(
      'linear-gradient(180deg, #000 0%, #000 78%, transparent 100%)',
    );
    expect(getDeclarations(artworkFrameRule)['mask-composite']).toBe('intersect');
    expect(getDeclarations(artworkFrameRule)['-webkit-mask-image']).toBe(
      getDeclarations(artworkFrameRule)['mask-image'],
    );
    expect(getDeclarations(artworkFrameRule)).toHaveProperty('-webkit-mask-composite', 'source-in');
    expect(getDeclarations(artworkFrameRule)).not.toHaveProperty('border-radius');
    expect(getDeclarations(artworkFrameRule)).not.toHaveProperty('box-shadow');
    expect(getDeclarations(artworkFrameRule)).not.toHaveProperty('margin');
    expect(getDeclarations(artworkFrameRule)).not.toHaveProperty('margin-left');
    expect(getDeclarations(artworkFrameRule)).not.toHaveProperty('margin-right');
    expect(getDeclarations(imageRule)).toMatchObject({
      'z-index': '0',
      'object-fit': 'cover',
      'object-position': '60% 45%',
    });
    expect(getDeclarations(desktopImageRule)).toMatchObject({ 'object-position': '65% 30%' });
    expect(getDeclarations(shadeRule)).toMatchObject({
      position: 'absolute',
      'z-index': '1',
      inset: '0',
      'pointer-events': 'none',
    });
    expect(getDeclarations(shadeRule)['background-image']).toContain('linear-gradient(90deg');
    expect(getDeclarations(shadeRule)['background-image']).toContain('rgb(4 6 12 / 0.12)');
    expect(getDeclarations(contentRule)).toMatchObject({
      position: 'relative',
      'z-index': '1',
    });
    expect(getDeclarations(contentRule)).not.toHaveProperty('padding');
    expect(getDeclarations(contentRule)).not.toHaveProperty('padding-block');
    expect(getDeclarations(contentRule)).not.toHaveProperty('padding-inline');
    expect(getDeclarations(contentRule)).not.toHaveProperty('color');
    expect(getDeclarations(contentRule)).not.toHaveProperty('mask-image');
    expect(getDeclarations(heroRule)).not.toHaveProperty('mask-image');
    expect(desktopContentRule).toBeUndefined();
    expect(getDeclarations(heroRule)).not.toHaveProperty('box-shadow');
    expect(getDeclarations(heroRule)).not.toHaveProperty('border-radius');
  });
});
