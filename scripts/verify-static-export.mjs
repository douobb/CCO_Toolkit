import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

function normalizeBasePath(value = '') {
  const raw = value.trim();

  if (!raw || raw === '/') return '';

  const normalized = `/${raw.replace(/^\/+|\/+$/g, '')}`;
  if (
    !normalized ||
    normalized === '/' ||
    normalized.includes('//') ||
    /[?#\s]/.test(normalized) ||
    /^[a-z][a-z\d+.-]*:/i.test(normalized)
  ) {
    throw new Error(`無效的 NEXT_PUBLIC_BASE_PATH：${value}`);
  }

  return normalized;
}

const projectRoot = process.cwd();
const outputRoot = path.join(projectRoot, 'out');
const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
const publicPath = (pathname) => `${basePath}${pathname}`;

async function ensureFile(relativePath) {
  try {
    await readFile(path.join(outputRoot, relativePath));
  } catch {
    throw new Error(`Static Export 缺少必要檔案：out/${relativePath}`);
  }
}

async function readOutput(relativePath) {
  await ensureFile(relativePath);
  return readFile(path.join(outputRoot, relativePath), 'utf8');
}

async function collectFiles(directory, predicate) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath, predicate)));
    } else if (entry.isFile() && predicate(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

async function collectJavaScriptFiles(directory) {
  return collectFiles(directory, (name) => name.endsWith('.js'));
}

async function collectHtmlFiles(directory) {
  return collectFiles(directory, (name) => name.endsWith('.html'));
}

function assertIncludes(value, expected, description) {
  if (!value.includes(expected)) {
    throw new Error(`${description} 缺少：${expected}`);
  }
}

function assertExcludes(value, unexpected, description) {
  if (value.includes(unexpected)) {
    throw new Error(`${description} 不應包含：${unexpected}`);
  }
}

function getArrayLiteralBody(source, property, description) {
  const marker = `${property}={[`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`${description} 缺少 ${property} 陣列`);

  const openIndex = markerIndex + marker.length - 1;
  let depth = 0;
  let quote;
  let escaped = false;

  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = undefined;
      continue;
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character;
    } else if (character === '[') {
      depth += 1;
    } else if (character === ']') {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, index);
    }
  }

  throw new Error(`${description} 的 ${property} 陣列未閉合`);
}

function readJsxTag(source, start) {
  if (source.startsWith('<>', start)) {
    return { end: start + 2, closing: false, selfClosing: false };
  }
  if (source.startsWith('</>', start)) {
    return { end: start + 3, closing: true, selfClosing: false };
  }
  if (source[start] !== '<') return undefined;

  let cursor = start + 1;
  const closing = source[cursor] === '/';
  if (closing) cursor += 1;
  if (!/[A-Za-z]/.test(source[cursor] ?? '')) return undefined;

  let quote;
  let escaped = false;
  for (; cursor < source.length; cursor += 1) {
    const character = source[cursor];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = undefined;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (character === '>') {
      return {
        end: cursor + 1,
        closing,
        selfClosing: source[cursor - 1] === '/',
      };
    }
  }

  return undefined;
}

function splitTopLevelCommaSeparated(source) {
  const parts = [];
  let depth = 0;
  let jsxDepth = 0;
  let start = 0;
  let quote;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = undefined;
      continue;
    }

    if (character === '<') {
      const tag = readJsxTag(source, index);
      if (tag) {
        if (tag.closing) jsxDepth = Math.max(0, jsxDepth - 1);
        else if (!tag.selfClosing) jsxDepth += 1;
        index = tag.end - 1;
        continue;
      }
    }

    if (jsxDepth > 0) continue;

    if (character === "'" || character === '"' || character === '`') {
      quote = character;
    } else if (character === '[' || character === '{' || character === '(') {
      depth += 1;
    } else if (character === ']' || character === '}' || character === ')') {
      depth -= 1;
    } else if (character === ',' && depth === 0) {
      parts.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }

  const lastPart = source.slice(start).trim();
  if (lastPart) parts.push(lastPart);
  return parts;
}

function assertToolOverviewSourceTable(
  source,
  description,
  expectedColumnHeaders,
  expectedColumnWidths,
  expectedRows,
  expectedMinWidth,
) {
  const columns = splitTopLevelCommaSeparated(
    getArrayLiteralBody(source, 'columns', description),
  );
  if (columns.length !== expectedColumnHeaders.length) {
    throw new Error(
      `${description} 的 DataTable 應有 ${expectedColumnHeaders.length} 欄，實際為 ${columns.length} 欄`,
    );
  }
  const columnHeaders = columns.map((column) => column.match(/\blabel:\s*'([^']+)'/)?.[1]);
  if (columnHeaders.some((header, index) => header !== expectedColumnHeaders[index])) {
    throw new Error(
      `${description} 的欄名應為 ${expectedColumnHeaders.join('、')}，實際為 ${columnHeaders.join('、')}`,
    );
  }
  const columnWidths = columns.map((column) => column.match(/\bwidth:\s*'([^']+)'/)?.[1]);
  if (columnWidths.some((width, index) => width !== expectedColumnWidths[index])) {
    throw new Error(
      `${description} 的欄寬應為 ${expectedColumnWidths.join('、')}，實際為 ${columnWidths.join('、')}`,
    );
  }
  if (!source.includes(`tableClassName="min-w-[${expectedMinWidth}] table-fixed"`)) {
    throw new Error(`${description} 的表格最小寬度應為 ${expectedMinWidth}`);
  }
  if (!source.includes('stickyFirstColumn')) {
    throw new Error(`${description} 應保留 sticky 首欄`);
  }

  const rows = splitTopLevelCommaSeparated(
    getArrayLiteralBody(source, 'rows', description),
  );
  if (rows.length !== 2 || rows.length !== expectedRows.length) {
    throw new Error(`${description} 應有主要輸入、共用設定 2 列`);
  }

  rows.forEach((row, index) => {
    const normalizedRow = row.trim();
    if (!normalizedRow.startsWith('[') || !normalizedRow.endsWith(']')) {
      throw new Error(`${description} 第 ${index + 1} 列不是欄位陣列`);
    }

    const cells = splitTopLevelCommaSeparated(normalizedRow.slice(1, -1));
    if (cells.length !== expectedColumnHeaders.length) {
      throw new Error(
        `${description} 第 ${index + 1} 列應有 ${expectedColumnHeaders.length} 格，實際為 ${cells.length} 格`,
      );
    }
    cells.forEach((cell, cellIndex) => {
      const expectedCell = `'${expectedRows[index][cellIndex]}'`;
      if (cell.trim() !== expectedCell) {
        throw new Error(
          `${description} 第 ${index + 1} 列第 ${cellIndex + 1} 格應為 ${expectedCell}，實際為 ${cell}`,
        );
      }
    });
  });
}

function getRenderedTableHtmlByAriaLabel(html, ariaLabel, description) {
  const tables = html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi);
  const table = [...tables].find(([, attributes]) =>
    attributes.includes(`aria-label="${ariaLabel}"`),
  );
  if (!table) throw new Error(`${description} 找不到 aria-label=${ariaLabel} 的表格`);

  return table[0];
}

function assertRenderedTableRowsHaveColumnCount(
  html,
  ariaLabel,
  expectedColumnHeaders,
  expectedColumnWidths,
  expectedRows,
  description,
) {
  const expectedColumns = expectedColumnHeaders.length;
  const table = getRenderedTableHtmlByAriaLabel(html, ariaLabel, description);
  const columns = [...table.matchAll(/<col\b([^>]*)>/gi)];
  const columnWidths = columns.map(([, attributes]) =>
    attributes.match(/\bstyle="width:([^;"]+)/)?.[1],
  );
  if (columnWidths.length !== expectedColumns || columnWidths.some(
    (width, index) => width !== expectedColumnWidths[index],
  )) {
    throw new Error(
      `${description} 的輸出欄寬應為 ${expectedColumnWidths.join('、')}，實際為 ${columnWidths.join('、')}`,
    );
  }

  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  if (rows.length !== expectedRows.length + 1) {
    throw new Error(
      `${description} 應有 1 列表頭與 ${expectedRows.length} 列資料，實際共 ${rows.length} 列`,
    );
  }
  rows.forEach(([, content], index) => {
    const cellCount = content.match(/<(?:th|td)\b/gi)?.length ?? 0;
    if (cellCount !== expectedColumns) {
      throw new Error(
        `${description} 第 ${index + 1} 列應有 ${expectedColumns} 格，實際為 ${cellCount} 格`,
      );
    }
    const cells = [...content.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)];
    const cellTexts = cells.map(([, cell]) => cell
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim());
    if (index === 0) {
      if (cellTexts.some((cell, cellIndex) => cell !== expectedColumnHeaders[cellIndex])) {
        throw new Error(
          `${description} 表頭應為 ${expectedColumnHeaders.join('、')}，實際為 ${cellTexts.join('、')}`,
        );
      }
    } else {
      const expectedRow = expectedRows[index - 1];
      if (cellTexts.some((cell, cellIndex) => cell !== expectedRow[cellIndex])) {
        throw new Error(
          `${description} 第 ${index} 列內容應為 ${expectedRow.join('｜')}，實際為 ${cellTexts.join('｜')}`,
        );
      }
    }
  });
}

for (const [
  fileName,
  description,
  expectedColumnHeaders,
  expectedColumnWidths,
  expectedMinWidth,
  expectedRows,
] of [
  [
    'index.mdx',
    '繁中工具總覽來源',
    ['輸入類型', '用途', '位置'],
    ['7rem', '16rem', '22rem'],
    '45rem',
    [
      ['主要輸入', '調整本次試算條件', '工具頁的主要輸入區塊'],
      ['共用設定', '管理玩家、裝備與物價', '點擊「玩家與計算設定」圖示'],
    ],
  ],
  [
    'index.zh-cn.mdx',
    '簡中工具總覽來源',
    ['输入类型', '用途', '位置'],
    ['7rem', '16rem', '22rem'],
    '45rem',
    [
      ['主要输入', '调整本次试算条件', '工具页的主要输入区块'],
      ['共享设置', '管理玩家、装备与物价', '点击“玩家与计算设置”图标'],
    ],
  ],
  [
    'index.en.mdx',
    '英文工具總覽來源',
    ['Input type', 'Purpose', 'Location'],
    ['10rem', '16rem', '22rem'],
    '48rem',
    [
      ['Primary inputs', 'Adjust this calculation’s inputs', 'Main input section on the tool page'],
      ['Shared settings', 'Manage player, equipment, and prices', 'Click the “Player & calculation settings” icon'],
    ],
  ],
]) {
  const source = await readFile(path.join(projectRoot, 'content', 'tools', fileName), 'utf8');
  assertToolOverviewSourceTable(
    source,
    description,
    expectedColumnHeaders,
    expectedColumnWidths,
    expectedRows,
    expectedMinWidth,
  );
}

function assertMetadata(html, key, expected, description = '分享標籤') {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const found = tags.some((tag) => {
    const name = tag.match(/\b(?:name|property)="([^"]+)"/i)?.[1];
    const content = tag.match(/\bcontent="([^"]*)"/i)?.[1];
    return name === key && content === expected;
  });
  if (!found) throw new Error(`${description} 缺少或不正確：${key}=${expected}`);
}

function assertTitlePhaseBootstrap(html, description) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
  assertIncludes(head, 'id="site-title-phase-bootstrap"', `${description} 霓虹起點樣式`);
  const script = (head.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) ?? [])
    .find((tag) => tag.includes("document.getElementById('site-title-phase-bootstrap')"));
  if (!script) throw new Error(`${description} 缺少首屏同步霓虹初始化腳本`);
  assertIncludes(script, 'insertRule', `${description} CSSOM 初始化`);
  assertExcludes(script, '__next_s', `${description} 初始化不得依賴 Next.js 執行佇列`);
}

function assertAlternate(html, language, href, description) {
  const alternateLinks = html.match(/<link[^>]+rel="alternate"[^>]*>/g) ?? [];
  const expectedPath = href.replace(/\/$/, '');
  const matched = alternateLinks.some((link) => {
    const languageMatch = link.match(/hreflang="([^"]+)"/i);
    const hrefMatch = link.match(/href="([^"]+)"/i);
    if (languageMatch?.[1] !== language || !hrefMatch?.[1]) return false;

    const pathname = new URL(hrefMatch[1], 'http://static.local').pathname.replace(/\/$/, '');
    return pathname === expectedPath;
  });

  if (!matched) {
    throw new Error(`${description} 缺少：hreflang=${language}, href=${href}`);
  }
}

function assertAppIcon(html, description) {
  const iconLinks = html.match(/<link\b[^>]*>/gi) ?? [];
  const matched = iconLinks.some((link) => {
    const relMatch = link.match(/\brel="([^"]+)"/i);
    const typeMatch = link.match(/\btype="([^"]+)"/i);
    const hrefMatch = link.match(/\bhref="([^"]+)"/i);
    if (
      relMatch?.[1].toLowerCase() !== 'icon' ||
      typeMatch?.[1].toLowerCase() !== 'image/png' ||
      !hrefMatch?.[1]
    ) {
      return false;
    }

    try {
      return new URL(hrefMatch[1], 'http://static.local').pathname === publicPath('/icon.png');
    } catch {
      return false;
    }
  });

  if (!matched) {
    throw new Error(
      `${description} 缺少 app icon：rel=icon, type=image/png, href pathname=${publicPath('/icon.png')}`,
    );
  }
}

const requiredFiles = [
  'icon.png',
  'index.html',
  '404.html',
  'zh-tw/index.html',
  'zh-cn/index.html',
  'en/index.html',
  'zh-tw/settings/index.html',
  'zh-cn/settings/index.html',
  'en/settings/index.html',
  'zh-tw/tools/index.html',
  'zh-cn/tools/index.html',
  'en/tools/index.html',
  'zh-tw/tools/mining/index.html',
  'zh-cn/tools/mining/index.html',
  'en/tools/mining/index.html',
  'zh-tw/tools/level-conversion/index.html',
  'zh-cn/tools/level-conversion/index.html',
  'en/tools/level-conversion/index.html',
  'zh-tw/tools/black-market/index.html',
  'zh-cn/tools/black-market/index.html',
  'en/tools/black-market/index.html',
  'zh-tw/tools/dungeon/index.html',
  'zh-cn/tools/dungeon/index.html',
  'en/tools/dungeon/index.html',
  'zh-tw/tools/search-reward/index.html',
  'zh-cn/tools/search-reward/index.html',
  'en/tools/search-reward/index.html',
  'zh-tw/guides/gang/index.html',
  'zh-cn/guides/index.html',
  'zh-cn/guides/gang/index.html',
  'en/guides/gang/index.html',
  'zh-tw/blog/index.html',
  'zh-cn/blog/index.html',
  'en/blog/index.html',
  'zh-tw/tools/helper-overview/index.html',
  'zh-cn/tools/helper-overview/index.html',
  'en/tools/helper-overview/index.html',
  'zh-tw/about/index.html',
  'zh-cn/about/index.html',
  'en/about/index.html',
  'zh-tw/about/licensing/index.html',
  'zh-cn/about/licensing/index.html',
  'en/about/licensing/index.html',
  'zh-tw/about/changelog/index.html',
  'zh-cn/about/changelog/index.html',
  'en/about/changelog/index.html',
  'zh-tw/about/contribution-board/index.html',
  'en/about/contribution-board/index.html',
  'zh-cn/about/contribution-board/index.html',
  'zh-tw/about/privacy/index.html',
  'zh-cn/about/privacy/index.html',
  'en/about/privacy/index.html',
  'zh-tw/about/contributing/index.html',
  'zh-cn/about/contributing/index.html',
  'en/about/contributing/index.html',
  'zh-tw/recommendations/index.html',
  'zh-cn/recommendations/index.html',
  'en/recommendations/index.html',
  'images/brand/about-banner.webp',
  'images/brand/ciallo-banner.webp',
  'api/search',
  'llms.txt',
  'llms-full.txt',
  'llms.mdx/docs/zh-tw/tools/content.md',
  'llms.mdx/docs/zh-tw/about/content.md',
  'llms.mdx/docs/zh-tw/about/privacy/content.md',
  'llms.mdx/docs/zh-tw/recommendations/content.md',
  'llms.mdx/docs/zh-cn/tools/content.md',
  'llms.mdx/docs/zh-cn/about/contribution-board/content.md',
  'llms.mdx/docs/zh-cn/about/privacy/content.md',
  'llms.mdx/docs/en/about/privacy/content.md',
  'og/docs/zh-tw/tools/image.png',
  'og/docs/zh-tw/about/image.png',
  'og/docs/zh-tw/about/privacy/image.png',
  'og/docs/zh-tw/recommendations/image.png',
  'og/docs/zh-cn/tools/image.png',
  'og/docs/zh-cn/about/contribution-board/image.png',
  'og/docs/zh-cn/about/privacy/image.png',
  'og/docs/en/about/privacy/image.png',
];

for (const relativePath of requiredFiles) await ensureFile(relativePath);

const exportedFiles = await collectFiles(outputRoot, () => true);
const retiredWebsiteRoutes = exportedFiles
  .map((filePath) => path.relative(outputRoot, filePath).split(path.sep).join('/'))
  .filter((relativePath) => /\/blog\/(?:website|__empty-blog__)(?:\/|\.|$)/.test(relativePath));
if (retiredWebsiteRoutes.length > 0) {
  throw new Error(`Static Export 不應包含已移除的網站說明文章：${retiredWebsiteRoutes.join(', ')}`);
}

const privateAuthoringRoutes = exportedFiles
  .map((filePath) => path.relative(outputRoot, filePath).split(path.sep).join('/'))
  .filter((relativePath) => relativePath.includes('/about/content-authoring/'));

if (privateAuthoringRoutes.length > 0) {
  throw new Error(
    `Static Export 不應包含私人內容規範頁、Markdown 或 OG 圖片：${privateAuthoringRoutes.join(', ')}`,
  );
}

const contributorDetailRoutes = exportedFiles
  .map((filePath) => path.relative(outputRoot, filePath).split(path.sep).join('/'))
  .filter((relativePath) => /^(zh-tw|zh-cn|en)\/about\/contributors\//.test(relativePath));

if (contributorDetailRoutes.length > 0) {
  throw new Error(
    `Static Export 不應包含 contributor 明細路由：${contributorDetailRoutes.join(', ')}`,
  );
}

const representativePages = [
  ['zh-tw/settings/index.html', '玩家與計算設定'],
  ['zh-cn/settings/index.html', '玩家与计算设置'],
  ['en/settings/index.html', 'Player &amp; calculation settings'],
  ['zh-cn/tools/index.html', '工具总览'],
  ['zh-cn/guides/index.html', '教程总览'],
  ['zh-cn/blog/index.html', '文章'],
  ['zh-cn/about/contribution-board/index.html', '贡献看板'],
  ['zh-tw/tools/mining/index.html', '挖礦等級與收益'],
  ['zh-tw/tools/level-conversion/index.html', '等級換算'],
  ['zh-tw/tools/black-market/index.html', '黑市收益'],
  ['zh-tw/tools/dungeon/index.html', '地城評估'],
  ['zh-tw/tools/search-reward/index.html', '搜索收益計算器'],
  ['zh-tw/guides/gang/index.html', '公會功能'],
  ['zh-tw/blog/index.html', '一些廢文。'],
  ['en/blog/index.html', 'Some random ramblings.'],
  ['zh-tw/tools/helper-overview/index.html', 'CCO Helper 簡介'],
  ['en/tools/search-reward/index.html', 'This page is not available in English yet'],
  ['zh-cn/tools/search-reward/index.html', '此页面暂未提供简体中文版本'],
  ['en/guides/gang/index.html', 'This page is not available in English yet'],
  ['zh-cn/guides/gang/index.html', '此页面暂未提供简体中文版本'],
  ['en/tools/helper-overview/index.html', 'This page is not available in English yet'],
  ['zh-cn/tools/helper-overview/index.html', '此页面暂未提供简体中文版本'],
  ['en/tools/mining/index.html', 'This page is not available in English yet'],
  ['en/tools/level-conversion/index.html', 'This page is not available in English yet'],
  ['en/tools/black-market/index.html', 'This page is not available in English yet'],
  ['en/tools/dungeon/index.html', 'This page is not available in English yet'],
  ['zh-tw/about/index.html', '網站開始建立'],
  ['zh-tw/about/privacy/index.html', '隱私說明'],
  ['zh-tw/about/contributing/index.html', '投稿格式'],
  ['zh-tw/about/licensing/index.html', '授權與聲明'],
  ['zh-tw/about/changelog/index.html', '更新紀錄'],
  ['zh-cn/about/index.html', 'CCO Toolkit'],
  ['zh-cn/about/privacy/index.html', '隐私说明'],
  ['zh-cn/about/licensing/index.html', '授权与声明'],
  ['zh-cn/about/changelog/index.html', '更新记录'],
  ['zh-cn/about/contributing/index.html', '贡献指南'],
  ['zh-cn/recommendations/index.html', 'SL DATA'],
  ['zh-tw/recommendations/index.html', 'SL DATA'],
  ['en/about/index.html', 'CCO Toolkit'],
  ['en/about/privacy/index.html', 'Privacy Notice'],
  ['en/about/licensing/index.html', 'Licensing and Notices'],
  ['en/about/changelog/index.html', 'Changelog'],
  ['en/about/contribution-board/index.html', 'Contribution board'],
  ['en/about/contributing/index.html', 'Contribution Guide'],
  ['en/recommendations/index.html', 'SL DATA'],
];

for (const [relativePath, expected] of representativePages) {
  assertIncludes(await readOutput(relativePath), expected, `代表頁面 ${relativePath}`);
}

for (const [relativePath, description] of [
  ['index.html', '首頁'],
  ['zh-tw/index.html', '繁中首頁'],
  ['zh-cn/index.html', '簡中首頁'],
  ['en/index.html', '英文首頁'],
  ['zh-tw/tools/mining/index.html', '深層工具頁'],
]) {
  assertAppIcon(await readOutput(relativePath), description);
}

for (const relativePath of [
  'zh-tw/tools/mining/index.html',
  'zh-tw/guides/gang/index.html',
  'zh-tw/blog/index.html',
  'en/tools/search-reward/index.html',
  'en/blog/index.html',
]) {
  assertExcludes(
    await readOutput(relativePath),
    'related-content-heading',
    `代表頁面 ${relativePath}`,
  );
}

const rootPage = await readOutput('index.html');
const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const homepageSharePages = [
  [rootPage, '根首頁'],
  [await readOutput('zh-tw/index.html'), '繁中首頁'],
  [await readOutput('zh-cn/index.html'), '簡中首頁'],
  [await readOutput('en/index.html'), '英文首頁'],
];
for (const [page, description] of homepageSharePages) {
  assertMetadata(page, 'og:title', 'CCO Toolkit', `${description} OG title`);
  assertMetadata(page, 'twitter:title', 'CCO Toolkit', `${description} Twitter title`);
}
assertIncludes(
  rootPage,
  '<title>CCO Toolkit｜CyberCode Online 工具與教學</title>',
  '根首頁瀏覽器 SEO title 維持原文',
);
assertMetadata(rootPage, 'og:description', 'CyberCode Online 的計算工具與遊戲教學。');
assertMetadata(rootPage, 'og:image', new URL(publicPath('/images/brand/og-cover.jpg'), siteOrigin).href);
assertMetadata(rootPage, 'og:image:type', 'image/jpeg');
assertMetadata(rootPage, 'og:image:width', '1200');
assertMetadata(rootPage, 'og:image:height', '630');
assertMetadata(rootPage, 'og:image:alt', '賽博城市');
assertMetadata(rootPage, 'twitter:card', 'summary_large_image');
assertMetadata(rootPage, 'twitter:image', new URL(publicPath('/images/brand/og-cover.jpg'), siteOrigin).href);
assertMetadata(rootPage, 'twitter:image:alt', '賽博城市');
for (const readmeFile of ['README.md', 'README.en.md']) {
  const readme = await readFile(path.join(projectRoot, readmeFile), 'utf8');
  assertIncludes(readme, '![CCO Toolkit](public/images/brand/og-cover.jpg)', `${readmeFile} 分享封面應維持 JPG`);
}
assertIncludes(rootPage, `href="${publicPath('/zh-tw/tools/')}"`, '根網址直接顯示繁中首頁工具入口');
assertIncludes(rootPage, `<link rel="canonical" href="${new URL(publicPath('/zh-tw/'), siteOrigin).href}"`, '根首頁 canonical 指向繁中首頁');
assertExcludes(rootPage, '正在前往繁體中文首頁', '根網址不再顯示跳轉畫面');
assertIncludes(rootPage, 'id="nd-nav"', '根首頁完整導覽列');
assertIncludes(rootPage, 'id="main-content"', '根首頁主要內容入口');
const equipmentPage = await readOutput('zh-tw/guides/cache-and-equipment/index.html');
assertIncludes(equipmentPage, 'data-markdown-table=""', '教學 Markdown 表格可讀欄寬標記');

const toolPage = await readOutput('zh-tw/tools/index.html');
const simplifiedToolPage = await readOutput('zh-cn/tools/index.html');
const englishToolPage = await readOutput('en/tools/index.html');
for (const [page, description] of [
  [rootPage, '根入口'],
  [toolPage, '繁中工具頁'],
  [simplifiedToolPage, '簡中工具頁'],
  [englishToolPage, '英文工具頁'],
]) {
  assertTitlePhaseBootstrap(page, description);
}
const settingsPage = await readOutput('zh-tw/settings/index.html');
const simplifiedSettingsPage = await readOutput('zh-cn/settings/index.html');
const englishSettingsPage = await readOutput('en/settings/index.html');
const englishFallbackToolPage = await readOutput('en/tools/search-reward/index.html');
const simplifiedFallbackToolPage = await readOutput('zh-cn/tools/search-reward/index.html');
const blogPage = await readOutput('zh-tw/blog/index.html');
const buffsAndItemsPage = await readOutput('zh-tw/guides/buffs-and-items/index.html');
const aboutPage = await readOutput('zh-tw/about/index.html');
const privacyPage = await readOutput('zh-tw/about/privacy/index.html');
const recommendationsPage = await readOutput('zh-tw/recommendations/index.html');
const simplifiedChineseRecommendationsPage = await readOutput('zh-cn/recommendations/index.html');
const englishAboutPage = await readOutput('en/about/index.html');
const englishPrivacyPage = await readOutput('en/about/privacy/index.html');
const simplifiedChinesePrivacyPage = await readOutput('zh-cn/about/privacy/index.html');
const englishRecommendationsPage = await readOutput('en/recommendations/index.html');
const helperOverviewPage = await readOutput('zh-tw/tools/helper-overview/index.html');

const verticalSlicePages = [
  'tools/search-reward',
  'tools/mining',
  'tools/level-conversion',
  'tools/black-market',
  'tools/dungeon',
  'guides/gang',
  'tools/helper-overview',
];

assertIncludes(
  buffsAndItemsPage,
  `href="${publicPath('/zh-tw/guides/cache-and-equipment/')}"`,
  'Guide 正文站內連結',
);

function getContentTargetPath(pathname) {
  const withoutBasePath = basePath && pathname.startsWith(`${basePath}/`)
    ? pathname.slice(basePath.length)
    : pathname;
  const normalizedPath = withoutBasePath.replace(/^\/+|\/+$/g, '');

  if (!/^(zh-tw|zh-cn|en)\/(tools|guides|blog|about|recommendations|settings)\/.+/.test(normalizedPath)) {
    return undefined;
  }

  return normalizedPath;
}

async function assertStaticContentLinks() {
  const htmlFiles = await collectHtmlFiles(outputRoot);

  for (const filePath of htmlFiles) {
    const relativeFilePath = path.relative(outputRoot, filePath).split(path.sep).join('/');
    const pagePath = relativeFilePath.replace(/\/index\.html$/, '');
    const baseUrl = `https://static.local${publicPath('/' + pagePath)}/`;
    const html = await readFile(filePath, 'utf8');

    for (const [, href] of html.matchAll(/(?:^|\s)href="([^"]+)"/g)) {
      const url = new URL(href, baseUrl);
      if (url.origin !== 'https://static.local') continue;

      const targetPath = getContentTargetPath(url.pathname);
      if (!targetPath) continue;

      await ensureFile(`${targetPath}/index.html`);
    }
  }
}

await assertStaticContentLinks();

const staticTextFiles = await collectFiles(
  outputRoot,
  (name) => /\.(?:css|html|js|json|svg|txt|xml)$/.test(name),
);
for (const filePath of staticTextFiles) {
  const content = await readFile(filePath, 'utf8');
  if (content.includes('cco-found-zh-cn-terminology')) {
    throw new Error(`Static Export 不應包含暫存 Game Data 版本：${path.relative(outputRoot, filePath)}`);
  }
}

function getDesktopSidebarMarkup(html, relativePath) {
  const start = html.indexOf('<aside id="nd-sidebar"');
  const end = html.indexOf('</aside>', start);
  if (start < 0 || end < 0) {
    throw new Error(`代表頁面 ${relativePath} 缺少文件側欄標記`);
  }

  return html.slice(start, end);
}

if (getDesktopSidebarMarkup(toolPage, 'zh-tw/tools/index.html').includes(publicPath('/zh-tw/blog/'))) {
  throw new Error('文件側欄不應包含 Blog 區段');
}

if (
  getDesktopSidebarMarkup(
    englishFallbackToolPage,
    'en/tools/search-reward/index.html',
  ).includes(publicPath('/en/blog/'))
) {
  throw new Error('英文文件 fallback 側欄不應包含 Blog 區段');
}

if (
  getDesktopSidebarMarkup(
    simplifiedFallbackToolPage,
    'zh-cn/tools/search-reward/index.html',
  ).includes(publicPath('/zh-cn/blog/'))
) {
  throw new Error('簡中文件 fallback 側欄不應包含 Blog 區段');
}

const docsSidebar = getDesktopSidebarMarkup(toolPage, 'zh-tw/tools/index.html');
const simplifiedDocsSidebar = getDesktopSidebarMarkup(
  simplifiedToolPage,
  'zh-cn/tools/index.html',
);
for (const title of [
  '背包升级规划',
  '黑市收益',
  '地下城评估',
  '活动收益总览',
  '等级换算',
  '箱子／掉落价值分析',
  '挖矿等级与收益',
  '搜索收益计算器',
  'CCO Helper 简介',
]) {
  assertIncludes(simplifiedDocsSidebar, title, '簡中工具側欄標題');
}
for (const title of [
  '背包升級規劃',
  '地城評估',
  '活動收益總覽',
  '等級換算',
  '箱子／掉落價值分析',
  '挖礦等級與收益',
  '搜索收益計算器',
  'CCO Helper 簡介',
]) {
  if (simplifiedDocsSidebar.includes(title)) {
    throw new Error(`簡中工具側欄不應包含繁中標題：${title}`);
  }
}
for (const section of ['about', 'recommendations']) {
  if (docsSidebar.includes(publicPath(`/zh-tw/${section}/`))) {
    throw new Error(`文件側欄不應包含全站頁面：${section}`);
  }
}

assertIncludes(
  englishFallbackToolPage,
  publicPath('/en/tools/search-reward/'),
  '英文工具 fallback 導覽連結',
);
assertIncludes(
  simplifiedFallbackToolPage,
  publicPath('/zh-tw/tools/search-reward/'),
  '簡中工具 fallback 繁中來源連結',
);
if (/hrefLang="zh-CN"/i.test(simplifiedFallbackToolPage)) {
  throw new Error('簡中工具 fallback 不應將 fallback 頁面宣告為 zh-CN alternate');
}
assertIncludes(
  await readOutput('en/guides/gang/index.html'),
  publicPath('/en/guides/gang/'),
  '英文教學 fallback 導覽連結',
);
assertIncludes(
  await readOutput('en/tools/helper-overview/index.html'),
  publicPath('/en/tools/helper-overview/'),
  '英文 Helper fallback 導覽連結',
);
for (const locale of ['zh-tw', 'zh-cn', 'en']) {
  const page = await readOutput(`${locale}/blog/index.html`);
  assertExcludes(page, '/blog/website', 'Blog 已移除文章連結');
  assertExcludes(page, 'CCO Toolkit 網站說明', 'Blog 已移除文章標題');
}
// 已翻譯的全站頁面必須保有各語系內容及 metadata，不得退回未翻譯提示。
for (const section of [
  'about',
  'about/privacy',
  'about/licensing',
  'about/changelog',
  'about/contribution-board',
  'about/contributing',
  'recommendations',
]) {
  for (const locale of ['zh-tw', 'zh-cn', 'en']) {
    const translatedPage = await readOutput(`${locale}/${section}/index.html`);
    assertExcludes(translatedPage, 'This page is not available in English yet', `${locale}/${section} 正文`);
    assertExcludes(translatedPage, '此页面暂未提供简体中文版本', `${locale}/${section} 正文`);
    const canonicalLink = (translatedPage.match(/<link\b[^>]*>/g) ?? [])
      .find((link) => /\brel="canonical"/.test(link));
    const canonicalUrl = canonicalLink?.match(/\bhref="([^"]+)"/)?.[1];
    if (!canonicalUrl || new URL(canonicalUrl, 'http://static.local').pathname.replace(/\/$/, '') !== publicPath(`/${locale}/${section}`)) {
      throw new Error(`${locale}/${section} canonical 必須指向目前語系頁面`);
    }
    for (const tag of translatedPage.match(/<meta\b[^>]*>/g) ?? []) {
      if (/\bname="robots"/.test(tag) && /\bnoindex\b/.test(tag)) {
        throw new Error(`${locale}/${section} 已翻譯頁面不得使用 fallback 的 noindex`);
      }
    }
    for (const [alternateLocale, htmlLanguage] of [['zh-tw', 'zh-TW'], ['zh-cn', 'zh-CN'], ['en', 'en']]) {
      assertAlternate(translatedPage, htmlLanguage, publicPath(`/${alternateLocale}/${section}`), `${locale}/${section} alternate`);
    }
  }
}
assertExcludes(
  aboutPage,
  'content-authoring',
  'About 私人內容規範連結',
);
assertIncludes(aboutPage, 'href="./privacy"', 'About 隱私說明連結');
const aboutBannerPath = publicPath('/images/brand/about-banner.webp');
const aboutBannerPosition = Math.max(
  aboutPage.indexOf(aboutBannerPath),
  aboutPage.indexOf(encodeURIComponent(aboutBannerPath)),
);
if (aboutBannerPosition < 0) {
  throw new Error(`About 頁未引用含 Pages basePath 的 WebP：${aboutBannerPath}`);
}
const aboutHeroStart = aboutPage.lastIndexOf('<header', aboutBannerPosition);
const aboutHeroEnd = aboutPage.indexOf('</header>', aboutBannerPosition);
if (aboutHeroStart < 0 || aboutHeroEnd < 0) throw new Error('About WebP 不在橫幅 header 中');
const aboutHero = aboutPage.slice(aboutHeroStart, aboutHeroEnd);
assertExcludes(
  aboutHero,
  encodeURIComponent(publicPath('/images/brand/og-cover.jpg')),
  'About 橫幅不應重用 OG 分享 JPG',
);
const privacyNoticeSources = [
  {
    locale: '繁中',
    sourcePath: path.join('content', 'about', 'privacy.mdx'),
    datePrefix: '更新日期：',
    page: privacyPage,
  },
  {
    locale: '英文',
    sourcePath: path.join('content', 'about', 'privacy.en.mdx'),
    datePrefix: 'Updated: ',
    page: englishPrivacyPage,
  },
  {
    locale: '簡中',
    sourcePath: path.join('content', 'about', 'privacy.zh-cn.mdx'),
    datePrefix: '更新日期：',
    page: simplifiedChinesePrivacyPage,
  },
];
const privacyNoticeDates = [];
for (const { locale, sourcePath, datePrefix, page } of privacyNoticeSources) {
  const source = await readFile(path.join(projectRoot, sourcePath), 'utf8');
  const dateLine = source
    .split(/\r?\n/)
    .find((line) => line.startsWith(datePrefix));
  const date = dateLine?.slice(datePrefix.length);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(
      locale + '隱私說明原始 MDX 缺少有效的 YYYY-MM-DD 更新日期',
    );
  }

  const parsedDate = new Date(date + 'T00:00:00.000Z');
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    throw new Error(locale + '隱私說明原始 MDX 的更新日期無效：' + date);
  }

  assertIncludes(page, datePrefix + date, locale + '隱私說明日期');
  privacyNoticeDates.push(date);
}
if (new Set(privacyNoticeDates).size !== 1) {
  throw new Error(
    '三語隱私說明更新日期不一致：' + privacyNoticeDates.join(', '),
  );
}
assertIncludes(privacyPage, 'localStorage', '隱私說明瀏覽器儲存');
assertIncludes(privacyPage, '沒有設定或讀取 Cookie', '隱私說明 Cookie 狀態');
assertIncludes(privacyPage, '推薦頁包含外部連結', '隱私說明推薦頁外部連結');
assertExcludes(privacyPage, 'Imgur 遠端封面', '隱私說明過時遠端圖片');
assertIncludes(englishPrivacyPage, 'localStorage', '英文隱私說明瀏覽器儲存');
const privacySubmissionAssertions = [
  {
    locale: '繁中',
    page: privacyPage,
    expected: [
      '前述 localStorage 說明不適用於私訊',
      '官方 Discord 私訊',
      '遊戲內私訊站長',
      '沒有投稿表單或站內接收端',
      '採用投稿前會另行取得適用授權的明確同意',
      '公開署名或採用紀錄前',
      '更正、隱藏或撤回',
    ],
  },
  {
    locale: '英文',
    page: englishPrivacyPage,
    expected: [
      'localStorage description above does not apply to private messages',
      'official CyberCode Online Discord',
      'message the site owner in game',
      'no contribution form or on-site receiving endpoint',
      'confirmed separately before adoption',
      'before publishing attribution or an adoption record',
      'correction, hiding, or withdrawal',
    ],
  },
  {
    locale: '簡中',
    page: simplifiedChinesePrivacyPage,
    expected: [
      '前述 localStorage 说明不适用于私信',
      '官方 Discord 私信',
      '游戏内私信站长',
      '没有投稿表单或站内收件功能',
      '采用投稿前会另行取得适用许可的明确同意',
      '公开署名或采用记录前',
      '更正、隐藏或撤回',
    ],
  },
];
for (const { locale, page, expected } of privacySubmissionAssertions) {
  for (const phrase of expected) {
    assertIncludes(page, phrase, locale + '隱私說明投稿告知');
  }
}
assertIncludes(englishRecommendationsPage, 'Official Discord', '英文推薦卡片名稱');
assertIncludes(simplifiedChineseRecommendationsPage, '官方 Discord', '簡中推薦卡片名稱');
const recommendationsBannerPath = publicPath('/images/brand/ciallo-banner.webp');
for (const [page, description] of [
  [recommendationsPage, '繁中推薦頁'],
  [simplifiedChineseRecommendationsPage, '簡中推薦頁'],
  [englishRecommendationsPage, '英文推薦頁'],
]) {
  const directBannerPosition = page.indexOf(recommendationsBannerPath);
  const encodedBannerPosition = page.indexOf(encodeURIComponent(recommendationsBannerPath));
  const bannerPosition = Math.max(directBannerPosition, encodedBannerPosition);
  if (bannerPosition < 0) {
    throw new Error(`${description} 未引用 Pages banner 資產：${recommendationsBannerPath}`);
  }
  const heroStart = page.lastIndexOf('<header', bannerPosition);
  const heroEnd = page.indexOf('</header>', heroStart);
  const hero = page.slice(heroStart, heroEnd);
  if (!hero.includes(recommendationsBannerPath)
    && !hero.includes(encodeURIComponent(recommendationsBannerPath))) {
    throw new Error(`${description} 未載入 Pages 子路徑下的推薦 banner：${recommendationsBannerPath}`);
  }
  assertIncludes(hero, 'aria-hidden="true"', `${description} 裝飾圖可及性`);
  assertIncludes(hero, 'alt=""', `${description} 裝飾圖替代文字`);
  assertIncludes(hero, 'object-position:75% 44%', `${description} banner 焦點位置`);
  assertIncludes(hero, 'max-w-5xl px-6 sm:px-10', `${description} banner 框架寬度`);
}
assertIncludes(recommendationsPage, '值得收藏的工具、資料與社群網站。', '推薦頁 description');
assertIncludes(recommendationsPage, '網站推薦', '推薦頁網站推薦標題');
assertExcludes(
  recommendationsPage,
  '這裡整理與 CyberCode Online、資料查詢或日常使用相關的網站與其他推薦內容，目前的一般推薦包含 SL DATA。',
  '推薦頁一般推薦說明',
);
assertExcludes(recommendationsPage, '公會推薦', '推薦頁公會推薦內容');
assertExcludes(recommendationsPage, 'SUI', '推薦頁 SUI 內容');
assertExcludes(recommendationsPage, '/images/recommendations/guilds/', '推薦頁公會封面資產');
assertIncludes(aboutPage, '本網站的貢獻者與更新歷程。', 'About description');
assertIncludes(helperOverviewPage, '正在穩定性測試與開發中...', 'Helper 公開狀態');
const helperRenderedText = helperOverviewPage
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, '');
if ((helperRenderedText.match(/正在穩定性測試與開發中\.\.\./g) ?? []).length !== 1) {
  throw new Error('Helper 開發狀態應僅在公開內文顯示一次');
}
if (![
  '<strong><em>正在穩定性測試與開發中...</em></strong>',
  '<em><strong>正在穩定性測試與開發中...</strong></em>',
].some((markup) => helperOverviewPage.includes(markup))) {
  throw new Error('Helper 公開狀態缺少粗斜體格式');
}
for (const heading of ['專案定位', '主要功能', '隱私與安全邊界', '相容性與限制']) {
  assertExcludes(helperOverviewPage, heading, 'Helper 已移入私人文件的章節');
}
assertIncludes(recommendationsPage, 'https://hackmd.io/@temmie950807/SL_DATA', '推薦內容外部連結');
assertIncludes(recommendationsPage, 'SL DATA：無封面，使用文件圖示', 'SL DATA 無封面佔位');
assertExcludes(recommendationsPage, 'i.imgur.com', '推薦內容未授權封面');
assertIncludes(
  recommendationsPage,
  'https://docs.google.com/spreadsheets/d/1wJLuZhZg_Xs1ouyjh6chntY8p3lcgNTuRU3-9JwKxQ4/edit?usp=sharing',
  'CCO Found 外部連結',
);
assertIncludes(recommendationsPage, '關於CCO裡的機率、公式、遊戲細節進行整理', 'CCO Found 說明');
assertIncludes(
  recommendationsPage,
  '使用前請先複製一分到自己雲端，不要直接修改共用檔案',
  'CCO Found 備註',
);
assertIncludes(recommendationsPage, '@min-[48rem]:grid-cols-3', '推薦卡片三欄容器查詢');
if (blogPage.includes('<article')) {
  assertIncludes(blogPage, '@min-[48rem]:grid-cols-3', '文章卡片三欄容器查詢');
} else {
  assertIncludes(blogPage, '目前沒有已翻譯的文章。', 'Blog 空清單狀態');
}

const rootReferences = [...toolPage.matchAll(/(?:href|src)="(\/[^\"]*)"/g)].map(
  (match) => match[1],
);

if (basePath) {
  const invalidReferences = rootReferences.filter(
    (reference) => !reference.startsWith(`${basePath}/`) && reference !== basePath,
  );

  if (invalidReferences.length > 0) {
    throw new Error(`HTML 仍有未加 basePath 的根相對資產：${invalidReferences.join(', ')}`);
  }
}

assertIncludes(toolPage, `${publicPath('/_next/')}`, 'Next 靜態資產路徑');
assertIncludes(toolPage, `${publicPath('/zh-tw/tools/')}`, 'Navigation 連結');
assertIncludes(settingsPage, `${publicPath('/zh-tw/settings')}`, '玩家設定 Navigation 連結');
assertIncludes(simplifiedSettingsPage, `${publicPath('/zh-cn/settings')}`, '簡中玩家設定 Navigation 連結');
for (const [page, description, removedNote] of [
  [settingsPage, '管理工具共用輸入。', '只保存在目前瀏覽器'],
  [simplifiedSettingsPage, '管理工具共用输入。', '只保存在当前浏览器'],
  [englishSettingsPage, 'Manage shared tool inputs.', 'Stored only in this browser'],
]) {
  assertIncludes(page, description, '玩家設定精簡描述');
  assertExcludes(page, removedNote, '玩家設定已移除的瀏覽器儲存提示');
}
for (const [page, minWidth] of [
  [toolPage, '45rem'],
  [simplifiedToolPage, '45rem'],
  [englishToolPage, '48rem'],
]) {
  assertIncludes(page, `min-w-[${minWidth}]`, '工具輸入位置表格最小寬度');
  assertIncludes(page, 'overflow-x-auto', '工具輸入位置表格水平捲動');
}
for (const [page, ariaLabel, description, columnHeaders, columnWidths, rows] of [
  [
    toolPage,
    '工具輸入位置',
    '繁中工具總覽表格',
    ['輸入類型', '用途', '位置'],
    ['7rem', '16rem', '22rem'],
    [
      ['主要輸入', '調整本次試算條件', '工具頁的主要輸入區塊'],
      ['共用設定', '管理玩家、裝備與物價', '點擊「玩家與計算設定」圖示'],
    ],
  ],
  [
    simplifiedToolPage,
    '工具输入位置',
    '簡中工具總覽表格',
    ['输入类型', '用途', '位置'],
    ['7rem', '16rem', '22rem'],
    [
      ['主要输入', '调整本次试算条件', '工具页的主要输入区块'],
      ['共享设置', '管理玩家、装备与物价', '点击“玩家与计算设置”图标'],
    ],
  ],
  [
    englishToolPage,
    'Tool input locations',
    '英文工具總覽表格',
    ['Input type', 'Purpose', 'Location'],
    ['10rem', '16rem', '22rem'],
    [
      ['Primary inputs', 'Adjust this calculation’s inputs', 'Main input section on the tool page'],
      ['Shared settings', 'Manage player, equipment, and prices', 'Click the “Player & calculation settings” icon'],
    ],
  ],
]) {
  assertRenderedTableRowsHaveColumnCount(
    page,
    ariaLabel,
    columnHeaders,
    columnWidths,
    rows,
    description,
  );
}
assertIncludes(toolPage, '僅儲存在目前瀏覽器', '工具總覽隱私說明');
assertIncludes(toolPage, '不會送到伺服器', '工具總覽隱私說明');
assertIncludes(englishToolPage, 'stored only in the current browser', '英文工具總覽隱私說明');
assertIncludes(englishToolPage, 'not sent to a server', '英文工具總覽隱私說明');
for (const expected of [
  '標示「共用」的欄位與共用設定同步，修改會套用至其他工具。',
  '「重設本工具」只還原本工具試算欄位、模式、BUFF 預設值或表單／篩選狀態，不修改共用資料，也不清除背包庫存或開箱紀錄。',
]) {
  assertIncludes(toolPage, expected, '繁中工具總覽輸入位置與重設說明');
}
assertExcludes(
  toolPage,
  '目前 8 個工具側欄只保留目錄（TOC）；輸入集中在以下兩處：',
  '繁中工具總覽已移除重複輸入位置前言',
);
for (const expected of [
  '标记为“共享”的字段与共享设置同步，修改会应用到其他工具。',
  '“重置本工具”只还原本工具试算字段、模式、默认 BUFF 或表单／筛选状态，不修改共享数据，也不清除背包库存或开箱记录。',
]) {
  assertIncludes(simplifiedToolPage, expected, '簡中工具總覽輸入位置與重設說明');
}
assertExcludes(
  simplifiedToolPage,
  '目前 8 个工具侧栏只保留目录（TOC）；输入集中在以下两处：',
  '簡中工具總覽已移除重複輸入位置前言',
);
for (const expected of [
  'Fields marked “Shared” sync with shared settings, and changes apply to other tools.',
  '<strong>Reset this tool</strong> restores only that tool&#x27;s trial inputs, mode, default buffs, or form and filter state; it does not change shared data or clear backpack inventory or loot-box records.',
]) {
  assertIncludes(englishToolPage, expected, '英文工具總覽輸入位置與重設說明');
}
assertExcludes(
  englishToolPage,
  'The sidebars of all eight tools currently contain only the table of contents (TOC); inputs are available in these two places:',
  '英文工具總覽已移除重複輸入位置前言',
);
for (const [page, ariaLabel, description, obsoleteDescriptions] of [
  [toolPage, '工具輸入位置', '繁中工具總覽表格', ['本工具設定']],
  [simplifiedToolPage, '工具输入位置', '簡中工具總覽表格', ['本工具设置']],
  [englishToolPage, 'Tool input locations', '英文工具總覽表格', ['Tool settings']],
]) {
  const renderedTable = getRenderedTableHtmlByAriaLabel(page, ariaLabel, description);
  for (const obsoleteDescription of obsoleteDescriptions) {
    assertExcludes(renderedTable, obsoleteDescription, `${description}已移除的舊側欄輸入說明`);
  }
}
for (const [language, locale] of [['zh-TW', 'zh-tw'], ['zh-CN', 'zh-cn'], ['en', 'en']]) {
  const href = publicPath(`/${locale}/settings`);
  assertAlternate(settingsPage, language, href, '繁中設定頁 alternate metadata');
  assertAlternate(simplifiedSettingsPage, language, href, '簡中設定頁 alternate metadata');
  assertAlternate(englishSettingsPage, language, href, '英文設定頁 alternate metadata');
}
assertAlternate(simplifiedToolPage, 'zh-CN', publicPath('/zh-cn/tools'), '簡中工具總覽 alternate metadata');
assertIncludes(toolPage, `${publicPath('/en/tools/')}`, 'alternate locale 路徑');
assertIncludes(
  toolPage,
  `${publicPath('/og/docs/zh-tw/tools/image.png')}`,
  'OG image metadata 路徑',
);
assertIncludes(
  toolPage,
  `${publicPath('/llms.mdx/docs/zh-tw/tools/content.md')}`,
  'Markdown 下載路徑',
);

const llms = await readOutput('llms.txt');
assertIncludes(llms, `](${publicPath('/zh-tw/tools')})`, 'LLM index 連結');

const searchIndex = await readOutput('api/search');
let parsedSearchIndex;
try {
  parsedSearchIndex = JSON.parse(searchIndex);
} catch (error) {
  throw new Error(`Static Search 索引不是有效 JSON：${error.message}`);
}
if (
  parsedSearchIndex.type !== 'advanced' &&
  parsedSearchIndex.type !== 'simple' &&
  parsedSearchIndex.type !== 'i18n'
) {
  throw new Error('未知的搜尋索引格式');
}

for (const path of verticalSlicePages) {
  assertIncludes(searchIndex, `/zh-tw/${path}`, '搜尋索引內容路徑');
}

for (const locale of ['zh-cn', 'en']) {
  for (const section of ['about', 'about/privacy', 'about/licensing', 'about/changelog', 'about/contribution-board', 'about/contributing', 'recommendations']) {
    assertIncludes(searchIndex, `/${locale}/${section}`, `${locale} 全站翻譯搜尋索引`);
  }
}

for (const path of [
  'tools',
  'guides',
  'blog',
  'about/contribution-board',
  'about/privacy',
]) {
  assertIncludes(searchIndex, `/zh-cn/${path}`, '簡中搜尋索引內容路徑');
}
if (searchIndex.includes('/zh-cn/tools/mining')) {
  throw new Error('搜尋索引不應將 fallback 的簡中工具頁當成實際翻譯內容');
}

for (const title of [
  '搜索收益計算器',
  '公會功能',
  'CCO Helper 簡介',
  '關於',
  '推薦',
  '隱私說明',
  '工具总览',
  '教程总览',
  '文章总览',
  '贡献看板',
  '隐私说明',
]) {
  assertIncludes(searchIndex, title, '搜尋索引內容標題');
}
assertExcludes(searchIndex, 'content-authoring', '搜尋索引私人規範路徑');
assertExcludes(searchIndex, '內容撰寫規範', '搜尋索引私人規範標題');
const fullMarkdown = await readOutput('llms-full.txt');
for (const [label, output] of [['搜尋索引', searchIndex], ['完整 Markdown', fullMarkdown]]) {
  assertExcludes(output, '/blog/website', `${label} 已移除文章路徑`);
  assertExcludes(output, 'CCO Toolkit 網站說明', `${label} 已移除文章標題`);
  assertExcludes(
    output,
    'CCO Helper 是 CCO 的非官方 Tampermonkey',
    `${label} 私人 Helper 詳細內容`,
  );
  assertExcludes(output, 'retired-website-article', `${label} 私人文章備份`);
  assertExcludes(output, 'cco-helper-overview', `${label} 私人 Helper 備份`);
}
assertExcludes(await readOutput('llms-full.txt'), '內容撰寫規範', '完整 Markdown 私人規範內容');

const javascriptFiles = await collectJavaScriptFiles(path.join(outputRoot, '_next'));
const searchClientSource = await Promise.all(
  javascriptFiles.map((filePath) => readFile(filePath, 'utf8')),
);
const searchClientHasPath = searchClientSource.some((source) => {
  if (!source.includes('/api/search')) return false;
  return !basePath || source.includes(basePath);
});
if (!searchClientHasPath) {
  throw new Error(`搜尋 client 未嵌入正確的索引設定：${publicPath('/api/search')}`);
}

console.log(`Static Export 驗證通過（basePath：${basePath || '根目錄'}）。`);
