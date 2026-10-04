import { describe, expect, it } from 'vitest';

import { toolDefinitionSchema, toolRegistrySchema } from './metadata';
import {
  getRegisteredTools,
  getToolHref,
  getToolDefinition,
  getToolDefinitionByPath,
  toolRegistry,
} from './registry';

describe('Tool Definition 與 registry', () => {
  it('註冊目前工具，只保留 runtime 必要資訊', () => {
    expect(getRegisteredTools()).toEqual(toolRegistry);
    expect(getToolDefinition('search-reward')).toEqual({
      id: 'search-reward',
      path: 'tools/search-reward',
      renderer: 'search-reward',
    });
    expect(getToolDefinition('mining')).toEqual({
      id: 'mining',
      path: 'tools/mining',
      renderer: 'mining',
    });
    expect(getToolDefinition('level-conversion')).toEqual({
      id: 'level-conversion',
      path: 'tools/level-conversion',
      renderer: 'level-conversion',
    });
    expect(getToolDefinition('black-market')).toEqual({
      id: 'black-market',
      path: 'tools/black-market',
      renderer: 'black-market',
    });
    expect(getToolDefinition('dungeon')).toEqual({
      id: 'dungeon',
      path: 'tools/dungeon',
      renderer: 'dungeon',
    });
    expect(getToolDefinition('earnings-overview')).toEqual({
      id: 'earnings-overview',
      path: 'tools/earnings-overview',
      renderer: 'earnings-overview',
    });
    expect(getToolDefinition('backpack-planner')).toEqual({
      id: 'backpack-planner',
      path: 'tools/backpack-planner',
      renderer: 'backpack-planner',
    });
  });

  it('依工具 path 取得 locale-aware 連結', () => {
    const tool = getToolDefinitionByPath('tools/search-reward');

    expect(tool).toBeDefined();
    if (!tool) return;

    expect(getToolHref(tool, 'zh-tw')).toBe('/zh-tw/tools/search-reward');
    expect(getToolHref(tool, 'en')).toBe('/en/tools/search-reward');

    const mining = getToolDefinitionByPath('tools/mining');
    expect(mining).toBeDefined();
    if (!mining) return;

    expect(getToolHref(mining, 'zh-tw')).toBe('/zh-tw/tools/mining');
    expect(getToolHref(mining, 'en')).toBe('/en/tools/mining');

    const levelConversion = getToolDefinitionByPath('tools/level-conversion');
    expect(levelConversion).toBeDefined();
    if (!levelConversion) return;

    expect(getToolHref(levelConversion, 'zh-tw')).toBe('/zh-tw/tools/level-conversion');
    expect(getToolHref(levelConversion, 'en')).toBe('/en/tools/level-conversion');

    const blackMarket = getToolDefinitionByPath('tools/black-market');
    expect(blackMarket).toBeDefined();
    if (!blackMarket) return;

    expect(getToolHref(blackMarket, 'zh-tw')).toBe('/zh-tw/tools/black-market');
    expect(getToolHref(blackMarket, 'en')).toBe('/en/tools/black-market');

    const dungeon = getToolDefinitionByPath('tools/dungeon');
    expect(dungeon).toBeDefined();
    if (!dungeon) return;

    expect(getToolHref(dungeon, 'zh-tw')).toBe('/zh-tw/tools/dungeon');
    expect(getToolHref(dungeon, 'en')).toBe('/en/tools/dungeon');

    const earningsOverview = getToolDefinitionByPath('tools/earnings-overview');
    expect(earningsOverview).toBeDefined();
    if (!earningsOverview) return;

    expect(getToolHref(earningsOverview, 'zh-tw')).toBe('/zh-tw/tools/earnings-overview');
    expect(getToolHref(earningsOverview, 'en')).toBe('/en/tools/earnings-overview');

    const backpackPlanner = getToolDefinitionByPath('tools/backpack-planner');
    expect(backpackPlanner).toBeDefined();
    if (!backpackPlanner) return;

    expect(getToolHref(backpackPlanner, 'zh-tw')).toBe('/zh-tw/tools/backpack-planner');
    expect(getToolHref(backpackPlanner, 'en')).toBe('/en/tools/backpack-planner');
  });

  it('拒絕把顯示 metadata 放回 runtime definition', () => {
    const result = toolDefinitionSchema.safeParse({
      id: 'simple-tool',
      path: 'tools/simple-tool',
      renderer: 'simple-tool',
      title: '不應由 registry 提供',
    });

    expect(result.success).toBe(false);
  });

  it('拒絕重複的工具 id 或 path', () => {
    const result = toolRegistrySchema.safeParse([
      {
        id: 'first-tool',
        path: 'tools/first-tool',
        renderer: 'first-tool',
      },
      {
        id: 'first-tool',
        path: 'tools/first-tool',
        renderer: 'second-tool',
      },
    ]);

    expect(result.success).toBe(false);
  });
});
