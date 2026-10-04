import { toLocalePath, type Locale } from '../i18n';
import { toolRegistrySchema, type ToolDefinition } from './metadata';

const registeredTools = [
  {
    id: 'search-reward',
    path: 'tools/search-reward',
    renderer: 'search-reward',
  },
  {
    id: 'mining',
    path: 'tools/mining',
    renderer: 'mining',
  },
  {
    id: 'level-conversion',
    path: 'tools/level-conversion',
    renderer: 'level-conversion',
  },
  {
    id: 'black-market',
    path: 'tools/black-market',
    renderer: 'black-market',
  },
  {
    id: 'dungeon',
    path: 'tools/dungeon',
    renderer: 'dungeon',
  },
  {
    id: 'earnings-overview',
    path: 'tools/earnings-overview',
    renderer: 'earnings-overview',
  },
  {
    id: 'backpack-planner',
    path: 'tools/backpack-planner',
    renderer: 'backpack-planner',
  },
  {
    id: 'loot-box-analysis',
    path: 'tools/loot-box-analysis',
    renderer: 'loot-box-analysis',
  },
];

/**
 * 所有可被工具路由與 renderer 對應使用的 runtime 定義。
 * 顯示 metadata 由 Tool MDX／Fumadocs source 提供，不在此重複維護。
 */
export const toolRegistry: readonly ToolDefinition[] = toolRegistrySchema.parse(registeredTools);

export function getRegisteredTools(): readonly ToolDefinition[] {
  return toolRegistry;
}

export function getToolDefinition(id: string): ToolDefinition | undefined {
  return toolRegistry.find((tool) => tool.id === id);
}

export function getToolDefinitionByPath(path: string): ToolDefinition | undefined {
  return toolRegistry.find((tool) => tool.path === path);
}

export function getToolHref(tool: Pick<ToolDefinition, 'path'>, locale: Locale): string {
  return toLocalePath(locale, tool.path);
}
