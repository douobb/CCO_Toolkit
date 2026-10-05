import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readProjectFile = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const normalizeLineEndings = (value: string) => value.replace(/\r\n/g, '\n');
const extractHeadings = (value: string) =>
  [...value.matchAll(/^(#{1,6})\s.+$/gm)].map((match) => match[1].length);
const extractLinks = (value: string) =>
  [...value.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]);
const extractComponents = (value: string) =>
  [...value.matchAll(/<([A-Z]\w*)(?:\s+[^>]+)?\s*\/>/g)].map((match) => match[0]);
const getDescription = (value: string) =>
  value.match(/^description:\s*"?(.+?)"?\s*$/m)?.[1];

const newTranslations = [
  '../../content/about/index.en.mdx',
  '../../content/about/index.zh-cn.mdx',
  '../../content/about/contributing.en.mdx',
  '../../content/about/contributing.zh-cn.mdx',
  '../../content/about/licensing.en.mdx',
  '../../content/about/licensing.zh-cn.mdx',
  '../../content/about/changelog.en.mdx',
  '../../content/about/changelog.zh-cn.mdx',
  '../../content/recommendations/index.en.mdx',
  '../../content/recommendations/index.zh-cn.mdx',
];

describe('About and recommendations translations', () => {
  it('includes each requested English and Simplified Chinese MDX page', () => {
    for (const path of newTranslations) {
      expect(readProjectFile(path).trim().length, path).toBeGreaterThan(0);
    }
  });

  it('preserves heading depth, component usage, and relative links', () => {
    for (const slug of ['index', 'contributing', 'licensing', 'changelog']) {
      const source = readProjectFile('../../content/about/' + slug + '.mdx');

      for (const locale of ['en', 'zh-cn']) {
        const translation = readProjectFile(
          '../../content/about/' + slug + '.' + locale + '.mdx',
        );
        expect(
          extractHeadings(translation),
          slug + '.' + locale + ' heading structure',
        ).toEqual(extractHeadings(source));
        expect(
          extractComponents(translation),
          slug + '.' + locale + ' components',
        ).toEqual(extractComponents(source));
        expect(
          extractLinks(translation),
          slug + '.' + locale + ' link targets',
        ).toEqual(extractLinks(source));
      }
    }

    const recommendationSource = readProjectFile('../../content/recommendations/index.mdx');
    for (const locale of ['en', 'zh-cn']) {
      const translation = readProjectFile(
        '../../content/recommendations/index.' + locale + '.mdx',
      );
      expect(extractHeadings(translation)).toEqual(extractHeadings(recommendationSource));
      expect(extractComponents(translation)).toEqual(
        extractComponents(recommendationSource),
      );
    }
  });

  it('keeps the MIT license text verbatim in all three licensing pages', () => {
    const mitLicense = normalizeLineEndings(readProjectFile('../../LICENSE'));

    for (const path of [
      '../../content/about/licensing.mdx',
      '../../content/about/licensing.en.mdx',
      '../../content/about/licensing.zh-cn.mdx',
    ]) {
      expect(normalizeLineEndings(readProjectFile(path)), path).toContain(mitLicense);
    }
  });

  it('retains the contributor contact, file, attribution, and consent requirements', () => {
    const english = readProjectFile('../../content/about/contributing.en.mdx');
    for (const phrase of [
      'official CyberCode Online Discord',
      'Find `douobb`',
      'send files through Discord',
      'UTF-8 encoded `.md`',
      'in-game player name',
      'explicit consent',
      'CC BY-SA 4.0',
      'MIT License',
      'public attribution will be confirmed separately',
      'A submission or commit message does not itself grant a license',
      'third-party material without the necessary rights or permission will not be included',
    ]) {
      expect(english).toContain(phrase);
    }

    const simplified = readProjectFile('../../content/about/contributing.zh-cn.mdx');
    for (const phrase of [
      '官方 Discord',
      '`douobb`',
      '游戏内私信无法附加文件',
      '请使用 Discord',
      'UTF-8 编码的 `.md`',
      '游戏内玩家名称',
      '明确同意',
      'CC BY-SA 4.0',
      'MIT 许可',
      '公开署名方式会另行确认',
      '投稿或 commit 信息本身不代表授予许可',
      '未取得相应权利或许可的第三方内容不会纳入',
    ]) {
      expect(simplified).toContain(phrase);
    }
  });

  it('keeps the license scope narrow and excludes third-party rights', () => {
    const english = readProjectFile('../../content/about/licensing.en.mdx');
    for (const phrase of [
      'only original article and guide text in `content/`',
      'only to the extent that this site has the right to license it',
      'Original site code is governed separately by the MIT License',
      'CyberCode Online game data',
      'CyberCode Online trademarks, game screens, and screenshots',
      'the Discord logo',
      'third-party images, external materials, quoted text',
      'Neither the MIT License nor CC BY-SA 4.0 extends to third-party content',
      'does not represent that it has obtained official authorization',
    ]) {
      expect(english).toContain(phrase);
    }

    const simplified = readProjectFile('../../content/about/licensing.zh-cn.mdx');
    for (const phrase of [
      '仅涵盖 `content/` 中可识别为本站原创的文章与教程文本',
      '且仅限本站有权授权的部分',
      '本站原创代码另依仓库根目录 `LICENSE` 中的 MIT 许可证处理',
      'CyberCode Online 游戏数据',
      'CyberCode Online 商标、游戏画面与截图',
      'Discord 标志',
      '第三方图片、外部素材、引用文字',
      'MIT 或 CC BY-SA 4.0 均不会因此扩及第三方内容',
      '不表示已取得 CyberCode Online 或其他权利人的官方授权',
    ]) {
      expect(simplified).toContain(phrase);
    }

    for (const path of [
      '../../content/about/licensing.mdx',
      '../../content/about/licensing.en.mdx',
      '../../content/about/licensing.zh-cn.mdx',
    ]) {
      expect(extractLinks(readProjectFile(path))).toContain('./contributing.mdx');
    }
  });

  it('syncs the existing privacy and contribution-board translations', () => {
    const privacyFiles = [
      ['../../content/about/privacy.mdx', '更新日期：'],
      ['../../content/about/privacy.en.mdx', 'Updated: '],
      ['../../content/about/privacy.zh-cn.mdx', '更新日期：'],
    ] as const;
    const privacyDates = privacyFiles.map(([path, prefix]) => {
      const dateLine = readProjectFile(path)
        .split(/\r?\n/)
        .find((line) => line.startsWith(prefix));
      return dateLine?.slice(prefix.length);
    });
    expect(privacyDates[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Set(privacyDates).size).toBe(1);

    const boardDescriptions = [
      ['../../content/about/contribution-board.mdx', '目前待補全與待翻譯的內容。'],
      [
        '../../content/about/contribution-board.en.mdx',
        'Content currently awaiting completion or translation.',
      ],
      [
        '../../content/about/contribution-board.zh-cn.mdx',
        '当前待补全与待翻译的内容。',
      ],
    ] as const;
    for (const [path, expected] of boardDescriptions) {
      expect(getDescription(readProjectFile(path)), path).toBe(expected);
    }
  });
});
