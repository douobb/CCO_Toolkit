import { pageSchema } from 'fumadocs-core/source/schema';
import { z } from 'zod';

import { gameDataIdSchema } from './game-data';
import { locales } from './i18n';

const nonEmptyString = (label: string) =>
  z.string().trim().min(1, `${label} 不可為空`);

const optionalNonEmptyString = (label: string) => nonEmptyString(label).optional();

const contentDateSchema = z.string().date().or(z.date());

export const contentStatusSchema = z.enum(['complete', 'incomplete']);

/** 工具在 registry 與文件 frontmatter 之間共用的穩定識別碼格式。 */
export const toolIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, '工具識別碼只能使用小寫英數字與連字號');

/**
 * 三類閱讀型內容共用的 frontmatter 欄位。
 *
 * 只有 title／description 是所有公開內容都需要的核心欄位；其他欄位依
 * 內容用途選用，讓短篇筆記、長篇教學、公告與資料說明都能共用這套 schema。
 * tags／order 提供預設值，未來新增欄位也會保留在內容資料中。
 */
export const contentPageSchema = pageSchema
  .extend({
    description: nonEmptyString('description'),
    category: optionalNonEmptyString('category'),
    tags: z.array(nonEmptyString('tag')).default([]),
    order: z.number().int().nonnegative().default(0),
    author: optionalNonEmptyString('author'),
    date: contentDateSchema.optional(),
    updated: contentDateSchema.optional(),
    locale: z.enum(locales).optional(),
    dataVersion: optionalNonEmptyString('dataVersion'),
    dataReferences: z.array(gameDataIdSchema).default([]),
    contentStatus: contentStatusSchema.default('complete'),
  })
  .passthrough();

/** Tool 文件沿用共用 metadata，另可提供穩定 id。 */
export const toolFrontmatterSchema = contentPageSchema
  .extend({
    toolId: toolIdSchema.optional(),
    section: optionalNonEmptyString('section'),
  })
  .passthrough();

/** Guide 可用 section 補充導覽分類，但不強迫每篇內容都使用。 */
export const guideFrontmatterSchema = contentPageSchema
  .extend({
    section: optionalNonEmptyString('section'),
  })
  .passthrough();

/** Blog 沿用共用閱讀型內容 metadata。 */
export const blogFrontmatterSchema = contentPageSchema;

export type GuideFrontmatter = z.infer<typeof guideFrontmatterSchema>;
export type BlogFrontmatter = z.infer<typeof blogFrontmatterSchema>;
export type ToolFrontmatter = z.infer<typeof toolFrontmatterSchema>;
