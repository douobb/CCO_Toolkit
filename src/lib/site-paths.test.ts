import { describe, expect, it } from 'vitest';
import {
  normalizeBasePath,
  withBasePath,
  withBasePathInMarkdown,
} from './site-paths';

describe('部署路徑 helper', () => {
  it('將空值與斜線視為網域根目錄', () => {
    expect(normalizeBasePath()).toBe('');
    expect(normalizeBasePath('/')).toBe('');
    expect(normalizeBasePath(' /cco-toolkit/ ')).toBe('/cco-toolkit');
  });

  it('拒絕包含 URL 控制字元或重複斜線的 base path', () => {
    expect(() => normalizeBasePath('/cco toolkit')).toThrow();
    expect(() => normalizeBasePath('/cco-toolkit?preview=true')).toThrow();
    expect(() => normalizeBasePath('/cco//toolkit')).toThrow();
  });

  it('只為需要手動處理的站內 URL 加上前綴', () => {
    expect(withBasePath('/api/search', '/cco-toolkit')).toBe('/cco-toolkit/api/search');
    expect(withBasePath('/cco-toolkit/api/search', '/cco-toolkit')).toBe(
      '/cco-toolkit/api/search',
    );
    expect(withBasePath('https://example.com/docs', '/cco-toolkit')).toBe(
      'https://example.com/docs',
    );
    expect(withBasePath('#section', '/cco-toolkit')).toBe('#section');
  });

  it('可以修正 LLM Markdown 中的根相對連結', () => {
    const markdown = '[工具](/zh-tw/tools) [外部](https://example.com)';

    expect(withBasePathInMarkdown(markdown, '/cco-toolkit')).toBe(
      '[工具](/cco-toolkit/zh-tw/tools) [外部](https://example.com)',
    );
  });
});
