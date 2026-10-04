/**
 * 將部署用的 base path 正規化成 Next.js 可接受的格式。
 *
 * basePath 必須在建置時決定；空字串代表網站部署在網域根目錄。
 */
export function normalizeBasePath(value = ''): string {
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

const configuredBasePath =
  typeof process === 'undefined' ? undefined : process.env.NEXT_PUBLIC_BASE_PATH;

export const siteBasePath = normalizeBasePath(configuredBasePath);

/**
 * 為非 Next Link 使用的站內 URL 加上部署前綴。
 * 一般 React／MDX 站內連結仍應交給 Next Link 自動處理，避免重複加前綴。
 */
export function withBasePath(path: string, basePath = siteBasePath): string {
  if (
    !path ||
    path.startsWith('#') ||
    path.startsWith('?') ||
    path.startsWith('//') ||
    /^[a-z][a-z\d+.-]*:/i.test(path)
  ) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!basePath) return normalizedPath;

  const alreadyPrefixed =
    normalizedPath === basePath ||
    normalizedPath.startsWith(`${basePath}/`) ||
    normalizedPath.startsWith(`${basePath}?`) ||
    normalizedPath.startsWith(`${basePath}#`);

  return alreadyPrefixed ? normalizedPath : `${basePath}${normalizedPath}`;
}

/**
 * 為 LLM Markdown 輸出中的根相對連結加上部署前綴。
 */
export function withBasePathInMarkdown(markdown: string, basePath = siteBasePath): string {
  return markdown.replace(/\]\((\/[^)\s]+)([^)]*)\)/g, (_match, path: string, suffix: string) => {
    return `](${withBasePath(path, basePath)}${suffix})`;
  });
}
