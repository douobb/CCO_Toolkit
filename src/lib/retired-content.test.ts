import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readProjectFile = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const helperDocument = readProjectFile('../../content/tools/helper-overview.mdx');

describe('retired public content', () => {
  it('removes the retired website article and its Simplified Chinese title', () => {
    expect(
      existsSync(new URL('../../content/blog/website.mdx', import.meta.url)),
    ).toBe(false);

    const blogZhCnMeta = JSON.parse(
      readProjectFile('../../content/blog/meta.zh-cn.json'),
    ) as { pageTitles?: Record<string, string> };
    expect(blogZhCnMeta.pageTitles).not.toHaveProperty('website');
  });

  it('keeps the Helper entry while publishing only its status', () => {
    const helperMeta = helperDocument.match(
      /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/,
    );
    expect(helperMeta).not.toBeNull();
    if (!helperMeta) throw new Error('Helper page frontmatter is missing');

    expect(helperMeta[1].replace(/\r\n/g, '\n')).toBe(
      [
        'title: CCO Helper 簡介',
        'description: "正在穩定性測試與開發中..."',
        'category: overview',
        'section: helper',
        'order: 10',
        'locale: zh-tw',
        'tags:',
        '  - helper',
      ].join('\n'),
    );
    expect(helperMeta[2].trim()).toBe('***正在穩定性測試與開發中...***');
    expect(helperDocument).not.toContain('Tampermonkey');
    expect(helperDocument).not.toContain('隱私與安全邊界');

    const toolsMeta = JSON.parse(
      readProjectFile('../../content/tools/meta.json'),
    ) as { pages: string[] };
    const toolsZhCnMeta = JSON.parse(
      readProjectFile('../../content/tools/meta.zh-cn.json'),
    ) as { pages: string[] };
    expect(toolsMeta.pages).toContain('helper-overview');
    expect(toolsZhCnMeta.pages).toContain('helper-overview');
  });

  it('keeps private documentation excluded by the existing ignore rule', () => {
    const ignorePatterns = readProjectFile('../../.gitignore')
      .split(/\r?\n/)
      .map((line) => line.trim());

    expect(ignorePatterns).toContain('docs/private/');
  });
});
