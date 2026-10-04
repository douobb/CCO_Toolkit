import type { ToolDefinition } from './metadata';

export type ToolContentPage = {
  readonly locale: string;
  readonly slugs: readonly string[];
  readonly data: unknown;
};

function getPagePath(page: ToolContentPage) {
  return page.slugs.join('/');
}

function getToolId(page: ToolContentPage) {
  if (typeof page.data !== 'object' || page.data === null) return undefined;
  return (page.data as { readonly toolId?: unknown }).toolId;
}

function getPageLocation(page: ToolContentPage) {
  return `[${page.locale}] ${getPagePath(page)}`;
}

/**
 * 檢查可執行工具的 runtime definition 與 Tool MDX 是否一一對應。
 * 區段 index 沒有 toolId 是合法狀態，只有帶 toolId 的內容頁才會被視為工具頁。
 */
export function getToolRegistryConsistencyIssues(
  definitions: readonly ToolDefinition[],
  pages: readonly ToolContentPage[],
): string[] {
  const toolPages = pages.filter((page) => page.slugs[0] === 'tools');
  const pagesByPath = new Map<string, ToolContentPage[]>();
  for (const page of toolPages) {
    const path = getPagePath(page);
    const localizedPages = pagesByPath.get(path);

    if (localizedPages) {
      localizedPages.push(page);
    } else {
      pagesByPath.set(path, [page]);
    }
  }
  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
  const definitionsByPath = new Map(
    definitions.map((definition) => [definition.path, definition]),
  );
  const issues: string[] = [];

  for (const definition of definitions) {
    const localizedPages = pagesByPath.get(definition.path);

    if (!localizedPages) {
      issues.push(`runtime definition ${definition.id} 找不到對應 Tool MDX path：${definition.path}`);
      continue;
    }

    for (const page of localizedPages) {
      if (getToolId(page) !== definition.id) {
        issues.push(
          `Tool MDX ${getPageLocation(page)} 的 toolId (${String(getToolId(page))}) 與 definition id (${definition.id}) 不一致`,
        );
      }
    }
  }

  for (const page of toolPages) {
    const toolId = getToolId(page);
    if (toolId === undefined) continue;

    if (typeof toolId !== 'string') {
      issues.push(`Tool MDX ${getPageLocation(page)} 的 toolId 必須是字串`);
      continue;
    }

    const definitionById = definitionsById.get(toolId);
    if (!definitionById) {
      issues.push(
        `Tool MDX ${getPageLocation(page)} 的 toolId ${toolId} 沒有 runtime definition`,
      );
      continue;
    }

    const pagePath = getPagePath(page);
    if (definitionById.path !== pagePath) {
      issues.push(
        `Tool MDX ${getPageLocation(page)} 的 toolId ${toolId} 對應到錯誤 path：${definitionById.path}`,
      );
    }

    if (!definitionsByPath.has(pagePath)) {
      issues.push(`Tool MDX ${getPageLocation(page)} 沒有 runtime path definition`);
    }
  }

  return issues;
}

export function assertToolRegistryConsistency(
  definitions: readonly ToolDefinition[],
  pages: readonly ToolContentPage[],
) {
  const issues = getToolRegistryConsistencyIssues(definitions, pages);
  if (issues.length > 0) {
    throw new Error(`Tool registry／MDX 一致性檢查失敗：\n- ${issues.join('\n- ')}`);
  }
}
