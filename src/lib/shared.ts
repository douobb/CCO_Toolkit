export const appName = 'CCO Toolkit';
export const projectRepositoryUrl = 'https://github.com/douobb/CCO_Toolkit';
export const docsRoute = '';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

export interface GitConfig {
  user: string;
  repo: string;
  branch: string;
}

export function getGitConfig(): GitConfig | null {
  return null;
}
