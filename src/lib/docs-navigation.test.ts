import type { Folder, Item } from 'fumadocs-core/page-tree';
import { describe, expect, it } from 'vitest';
import { simplifiedChinesePageTreeTransformer } from './docs-navigation';

const nodeMarker = Symbol('fumadocs-node-marker');
type MarkedNode = { [nodeMarker]: string };

function markedPage(ref: string, name: string, marker: string): Item & MarkedNode {
  return {
    $ref: ref,
    type: 'page',
    name,
    url: `/zh-cn/${ref.replace(/^tools\//, '').replace(/\.mdx$/, '')}/`,
    [nodeMarker]: marker,
  };
}

function transformFolder(folder: Folder): Folder {
  const transform = simplifiedChinesePageTreeTransformer.folder;
  if (!transform) throw new Error('簡中導覽 transformer 缺少 folder handler');

  return transform.call(
    {
      locale: 'zh-cn',
      storage: {
        read: () => ({
          data: {
            pageTitles: {
              index: '工具总览',
              'backpack-planner': '背包升级规划',
            },
          },
        }),
      },
    },
    folder,
    'tools',
    'tools/meta.zh-cn.json',
  );
}

describe('simplified Chinese page-tree transformer', () => {
  it('mutates native nodes without replacing identity or special properties', () => {
    const index = markedPage('tools/index.mdx', 'Tools', 'index');
    const page = markedPage('tools/backpack-planner.mdx', 'Backpack planner', 'page');
    const folder = {
      $id: 'tools',
      $ref: { folder: 'tools', meta: 'tools/meta.zh-cn.json' },
      type: 'folder' as const,
      name: 'Tools',
      index,
      children: [page],
      [nodeMarker]: 'folder',
    } as Folder & MarkedNode;

    const result = transformFolder(folder) as Folder & MarkedNode;

    expect(result).toBe(folder);
    expect(result.index).toBe(index);
    expect(result.children[0]).toBe(page);
    expect(result[nodeMarker]).toBe('folder');
    expect((result.index as Item & MarkedNode)[nodeMarker]).toBe('index');
    expect((result.children[0] as Item & MarkedNode)[nodeMarker]).toBe('page');
    expect(result.index?.name).toBe('工具总览');
    expect(result.children[0].name).toBe('背包升级规划');
  });
});
