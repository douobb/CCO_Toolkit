import { z } from 'zod';

/** 不含 UI 版面資訊、可供資料目錄與設定介面共用的三語標籤。 */
export const localizedGameLabelSchema = z
  .object({
    'zh-tw': z.string().trim().min(1, '繁體中文標籤不可為空'),
    'zh-cn': z.string().trim().min(1, '簡體中文標籤不可為空'),
    en: z.string().trim().min(1, '英文標籤不可為空'),
  })
  .strict();

/** 針對初始 snapshot 的欄位確認狀態；未確認項目不得假裝是正式值。 */
export const catalogVerificationSchema = z.enum(['confirmed', 'needs-review']);
export type CatalogVerification = z.infer<typeof catalogVerificationSchema>;
