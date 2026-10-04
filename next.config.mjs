import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

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
    throw new Error(`Invalid NEXT_PUBLIC_BASE_PATH: ${value}`);
  }

  return normalized;
}

const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  ...(basePath ? { basePath } : {}),
  trailingSlash: true,
  reactStrictMode: true,
  images: {
    // Static Export 沒有 Next Image optimizer，改由靜態資產直接提供圖片。
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: 'i.imgur.com' }],
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default withMDX(config);
