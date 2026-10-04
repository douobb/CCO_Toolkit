import { metaSchema } from 'fumadocs-core/source/schema';
import type { Folder, Item, Node } from 'fumadocs-core/page-tree';
import { z } from 'zod';

/** 允許各語系 meta 只覆寫導覽名稱，不必建立內容頁翻譯。 */
export const localizedMetaSchema = metaSchema.extend({
  pageTitles: z.record(z.string(), z.string()).optional(),
});

type LocalizedMeta = {
  pageTitles?: Record<string, string>;
};

type NavigationTransformerContext = {
  locale?: string;
  storage: {
    read(path: string): { data?: unknown } | undefined;
  };
};

function pageTitleKey(node: Item): string | undefined {
  const reference = node.$ref?.replaceAll('\\', '/');
  const fileName = reference?.split('/').pop();
  if (!fileName) return undefined;

  return fileName.replace(/\.[^.]+$/, '');
}

function localizeItem(node: Item, pageTitles: Record<string, string>): Item {
  const key = pageTitleKey(node);
  const title = key ? pageTitles[key] : undefined;
  if (title) node.name = title;

  return node;
}

function localizeNode(node: Node, pageTitles: Record<string, string>): Node {
  if (node.type !== 'page') return node;

  return localizeItem(node, pageTitles);
}

/** 只在簡中 sidebar 覆寫名稱，保留原始頁面節點與 locale-aware URL。 */
export const simplifiedChinesePageTreeTransformer = {
  folder(this: NavigationTransformerContext, node: Folder, _folderPath: string, metaPath?: string): Folder {
    if (this.locale !== 'zh-cn' || !metaPath) return node;

    const metadata = this.storage.read(metaPath)?.data as LocalizedMeta | undefined;
    const pageTitles = metadata?.pageTitles;
    if (!pageTitles) return node;

    if (node.index) localizeItem(node.index, pageTitles);
    for (const child of node.children) localizeNode(child, pageTitles);

    return node;
  },
};
