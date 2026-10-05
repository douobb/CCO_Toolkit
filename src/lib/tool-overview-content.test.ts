import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const contentRoot = join(process.cwd(), 'content');

describe('工具總覽與側欄內容', () => {
  for (const [suffix, heading, toolDescription, guideDescription] of [
    ['', '工具列表', '互動計算工具', '入門與進階教學'],
    ['.en', 'Tool list', 'Interactive calculators', 'Beginner and advanced guides'],
    ['.zh-cn', '工具列表', '互动计算工具', '入门与进阶教程'],
  ]) {
    it(`${suffix || '繁中'} 列出所有計算工具，且每個快速連結都有對應內容`, () => {
      const overview = readFileSync(join(contentRoot, 'tools', `index${suffix}.mdx`), 'utf8');
      const metadata = JSON.parse(readFileSync(join(contentRoot, 'tools', `meta${suffix}.json`), 'utf8'));
      const expectedPages: string[] = metadata.pages.filter(
        (page: string) => !page.startsWith('---') && page !== 'helper-overview',
      );
      const listStart = overview.indexOf(`## ${heading}\n`);
      const nextHeading = overview.indexOf('\n## ', listStart + 1);
      const list = overview.slice(listStart, nextHeading);
      const linkedPages = Array.from(list.matchAll(/\]\(\.\/([\w-]+)\)/g), (match) => match[1]);

      expect(overview).toContain(`## ${heading}\n`);
      expect(linkedPages).toEqual(expectedPages);
      expect(list).not.toContain('CCO Helper');
      for (const page of linkedPages) {
        expect(existsSync(join(contentRoot, 'tools', `${page}.mdx`))).toBe(true);
      }
    });

    it(`${suffix || '繁中'} 側欄採用簡短說明`, () => {
      const tools = JSON.parse(readFileSync(join(contentRoot, 'tools', `meta${suffix}.json`), 'utf8'));
      const guides = JSON.parse(readFileSync(join(contentRoot, 'guides', `meta${suffix}.json`), 'utf8'));
      expect(tools.description).toBe(toolDescription);
      expect(guides.description).toBe(guideDescription);
    });
  }
});
