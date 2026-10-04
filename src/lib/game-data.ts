import { z } from 'zod';

import { dataSourceMetadataSchema, type DataSourceMetadata } from './data-source';

/** 規劃中可獨立更新的遊戲資料領域。 */
export const gameDataDomainSchema = z.enum([
  'economy',
  'progression',
  'effects',
  'activities',
  'items',
]);

export type GameDataDomain = z.infer<typeof gameDataDomainSchema>;

/** Game Data dataset ID 的穩定格式；不把 Tool ID 或 UI 名稱混進資料識別。 */
export const gameDataIdSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,
    '資料集 ID 只能使用小寫英數字與單一連字號分隔',
  );

/** schema 結構版本採固定的三段式版本。 */
export const gameDataSchemaVersionSchema = z
  .string()
  .trim()
  .regex(/^\d+\.\d+\.\d+$/, 'schemaVersion 必須使用 major.minor.patch 格式');

/** dataVersion 是可追溯的內容快照識別，不限制各資料領域採用相同命名。 */
export const gameDataVersionSchema = z
  .string()
  .trim()
  .min(1, 'dataVersion 不可為空')
  .max(120, 'dataVersion 過長')
  .regex(
    /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/,
    'dataVersion 只能使用小寫英數字、點、底線與連字號',
  );

function isValidIsoDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Game Data 目前使用 UTC calendar date，不帶時間與時區。 */
export const gameDataDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日期必須使用 YYYY-MM-DD 格式')
  .refine(isValidIsoDate, '日期不是有效的 calendar date');

const gameDataSourcesSchema = z
  .array(dataSourceMetadataSchema)
  .min(1, '至少需要一個資料來源')
  .superRefine((sources, context) => {
    const firstIndexByUrl = new Map<string, number>();

    sources.forEach((source, index) => {
      const firstIndex = firstIndexByUrl.get(source.url);
      if (firstIndex !== undefined) {
        context.addIssue({
          code: 'custom',
          path: [index, 'url'],
          message: `資料來源 URL 重複（已出現在第 ${firstIndex + 1} 筆）`,
        });
        return;
      }

      firstIndexByUrl.set(source.url, index);
    });
  });

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type GameDataEnvelope<TPayload> = {
  readonly datasetId: string;
  readonly domain: GameDataDomain;
  readonly schemaVersion: string;
  readonly dataVersion: string;
  readonly updatedAt: string;
  readonly sources: readonly DeepReadonly<DataSourceMetadata>[];
  readonly payload: DeepReadonly<TPayload>;
};

/**
 * 頁面與內容只需要的資料追溯資訊；不把 payload 複製到顯示層。
 *
 * 這個型別刻意不包含任何工具專屬欄位，讓不同資料集可以共用同一套
 * 更新日期、版本與來源呈現規則。
 */
export type GameDataMetadata = Pick<
  GameDataEnvelope<unknown>,
  'datasetId' | 'domain' | 'schemaVersion' | 'dataVersion' | 'updatedAt' | 'sources'
>;

/** 從已驗證的 dataset 投影頁面需要的 metadata，保持來源陣列的唯讀參照。 */
export function getGameDataMetadata<TPayload>(
  dataSet: GameDataEnvelope<TPayload>,
): GameDataMetadata {
  return Object.freeze({
    datasetId: dataSet.datasetId,
    domain: dataSet.domain,
    schemaVersion: dataSet.schemaVersion,
    dataVersion: dataSet.dataVersion,
    updatedAt: dataSet.updatedAt,
    sources: dataSet.sources,
  });
}

/** 建立只驗證共用 envelope 的 schema，payload 由各資料領域提供。 */
export function createGameDataEnvelopeSchema<TPayload>(
  payloadSchema: z.ZodType<TPayload>,
) {
  return z
    .object({
      datasetId: gameDataIdSchema,
      domain: gameDataDomainSchema,
      schemaVersion: gameDataSchemaVersionSchema,
      dataVersion: gameDataVersionSchema,
      updatedAt: gameDataDateSchema,
      sources: gameDataSourcesSchema,
      payload: payloadSchema,
    })
    .strict();
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }

  return Object.freeze(value) as T;
}

/** 解析並深度凍結資料，讓所有 consumers 共享唯讀的同一份 payload。 */
export function parseGameDataEnvelope<TPayload>(
  value: unknown,
  payloadSchema: z.ZodType<TPayload>,
): GameDataEnvelope<TPayload> {
  return deepFreeze(createGameDataEnvelopeSchema(payloadSchema).parse(value)) as GameDataEnvelope<TPayload>;
}
