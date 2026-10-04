import { getGameDataSet } from './game-data-catalog';

export type ContentDataReferencePage = {
  readonly locale: string;
  readonly slugs: readonly string[];
  readonly data: unknown;
};

function getPageDataReferences(page: ContentDataReferencePage): readonly unknown[] {
  if (typeof page.data !== 'object' || page.data === null) return [];

  const references = (page.data as { readonly dataReferences?: unknown }).dataReferences;
  return Array.isArray(references) ? references : [];
}

function getPageLocation(page: ContentDataReferencePage) {
  return `[${page.locale}] ${page.slugs.join('/')}`;
}

/** 找出內容 frontmatter 指向不存在 dataset 的資料引用。 */
export function getContentDataReferenceIssues(
  pages: readonly ContentDataReferencePage[],
): string[] {
  const issues: string[] = [];

  for (const page of pages) {
    for (const [index, reference] of getPageDataReferences(page).entries()) {
      if (typeof reference !== 'string') {
        issues.push(
          `內容 ${getPageLocation(page)} 的 dataReferences[${index}] 必須是 dataset ID 字串`,
        );
        continue;
      }

      if (!getGameDataSet(reference)) {
        issues.push(
          `內容 ${getPageLocation(page)} 引用了不存在的 Game Data dataset：${reference}`,
        );
      }
    }
  }

  return issues;
}

/** 在 source 載入時阻止失效資料引用進入可發布內容。 */
export function assertContentDataReferenceConsistency(
  pages: readonly ContentDataReferencePage[],
) {
  const issues = getContentDataReferenceIssues(pages);
  if (issues.length > 0) {
    throw new Error(`內容 Game Data 引用檢查失敗：\n- ${issues.join('\n- ')}`);
  }
}
