import { lstat, readFile, readdir, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Next 靜態匯出要求動態路由至少有一組參數；佔位 404 不屬於公開文章。
export async function pruneEmptyBlogExport(outputRoot) {
  const root = await realpath(outputRoot);
  for (const locale of await readdir(root)) {
    const target = path.resolve(root, locale, 'blog', '__empty-blog__');
    let stat;
    try {
      stat = await lstat(target);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') continue;
      throw error;
    }
    const resolved = await realpath(target);
    if (stat.isSymbolicLink() || !stat.isDirectory() || resolved !== target || !resolved.startsWith(`${root}${path.sep}`)) {
      throw new Error('拒絕清除不安全的 Blog 佔位路徑');
    }
    const html = await readFile(path.join(target, 'index.html'), 'utf8');
    if (!html.includes('name="robots" content="noindex"') || !html.includes('This page could not be found')) {
      throw new Error('Blog 佔位路徑不是預期的 404，保留檔案');
    }
    await rm(target, { recursive: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await pruneEmptyBlogExport(path.resolve('out'));
}
