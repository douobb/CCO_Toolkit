import { z } from 'zod';

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/** 可追溯遊戲資料來源的單一共用 runtime schema。 */
export const dataSourceMetadataSchema = z
  .object({
    name: z.string().trim().min(1, '資料來源名稱不可為空').max(120, '資料來源名稱過長'),
    url: z
      .string()
      .trim()
      .url('資料來源 URL 必須是有效網址')
      .refine(isHttpsUrl, '資料來源 URL 必須使用 HTTPS'),
  })
  .strict();

export type DataSourceMetadata = z.infer<typeof dataSourceMetadataSchema>;

/** 目前 Game Data 的公開維護來源；不得因此宣稱資料為官方或最新值。 */
export const ccoFoundDataSource = {
  name: 'CCO Found',
  url: 'https://docs.google.com/spreadsheets/d/1wJLuZhZg_Xs1ouyjh6chntY8p3lcgNTuRU3-9JwKxQ4',
} as const satisfies DataSourceMetadata;
