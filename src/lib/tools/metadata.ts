import { z } from 'zod';

import { toolIdSchema } from '../content-schema';

const nonEmptyString = (label: string) => z.string().trim().min(1, `${label} 不可為空`);

/**
 * Runtime tool definition 只保留穩定識別與 renderer 對應。
 *
 * title、description、category 與 dataVersion 都由 Tool MDX
 * frontmatter／Fumadocs source 提供，避免顯示 metadata 出現兩份真實來源。
 */
export const toolDefinitionSchema = z
  .object({
    id: toolIdSchema,
    path: z
      .string()
      .trim()
      .min(1, '工具路徑不可為空')
      .refine((value) => value.startsWith('tools/'), '工具路徑必須以 tools/ 開頭'),
    renderer: nonEmptyString('renderer'),
  })
  .strict();

export type ToolDefinition = z.infer<typeof toolDefinitionSchema>;

/** Registry 會額外檢查 id 與 path，避免工具被重複註冊。 */
export const toolRegistrySchema = z.array(toolDefinitionSchema).superRefine((tools, context) => {
  const ids = new Map<string, number>();
  const paths = new Map<string, number>();

  tools.forEach((tool, index) => {
    const previousId = ids.get(tool.id);
    if (previousId !== undefined) {
      context.addIssue({
        code: 'custom',
        path: [index, 'id'],
        message: `工具 id 與第 ${previousId + 1} 筆重複`,
      });
    } else {
      ids.set(tool.id, index);
    }

    const previousPath = paths.get(tool.path);
    if (previousPath !== undefined) {
      context.addIssue({
        code: 'custom',
        path: [index, 'path'],
        message: `工具 path 與第 ${previousPath + 1} 筆重複`,
      });
    } else {
      paths.set(tool.path, index);
    }
  });
});
