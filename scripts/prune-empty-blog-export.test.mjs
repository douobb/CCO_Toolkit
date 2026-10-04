import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { pruneEmptyBlogExport } from './prune-empty-blog-export.mjs';

const roots = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

async function fixture(html) {
  const root = await mkdtemp(path.join(tmpdir(), 'cco-empty-blog-'));
  roots.push(root);
  const target = path.join(root, 'zh-tw/blog/__empty-blog__');
  await mkdir(target, { recursive: true });
  await writeFile(path.join(target, 'index.html'), html);
  await writeFile(path.join(root, 'zh-tw/blog/index.html'), '文章列表');
  return { root, target };
}

it('只移除佔位 404，保留 Blog 列表，重複執行仍安全', async () => {
  const { root, target } = await fixture('<meta name="robots" content="noindex">This page could not be found');
  await pruneEmptyBlogExport(root);
  await expect(readFile(path.join(target, 'index.html'))).rejects.toMatchObject({ code: 'ENOENT' });
  expect(await readFile(path.join(root, 'zh-tw/blog/index.html'), 'utf8')).toBe('文章列表');
  await pruneEmptyBlogExport(root);
});

it('若佔位路徑內有實際內容則停止清除', async () => {
  const { root, target } = await fixture('實際文章');
  await expect(pruneEmptyBlogExport(root)).rejects.toThrow('不是預期的 404');
  expect(await readFile(path.join(target, 'index.html'), 'utf8')).toBe('實際文章');
});
