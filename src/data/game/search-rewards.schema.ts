import { z } from 'zod';

const nonNegativeInteger = z.number().int().nonnegative();
const probability = z.number().finite().min(0).max(1);

/** Search Reward 單筆 payload 的 domain schema；level 同時是穩定 row ID。 */
export const searchRewardEntrySchema = z
  .object({
    level: z.number().int().min(1).max(800),
    atp: nonNegativeInteger,
    atp_p: probability,
    matp: nonNegativeInteger,
    matp_p: probability,
    mt: nonNegativeInteger,
    mt_p: probability,
  })
  .strict();

/** 驗證 Search Reward payload 的欄位、有效範圍與 level 穩定 ID 唯一性。 */
export const searchRewardPayloadSchema = z
  .array(searchRewardEntrySchema)
  .min(1, 'Search Reward 至少需要一筆資料')
  .superRefine((entries, context) => {
    const firstIndexByLevel = new Map<number, number>();

    entries.forEach((entry, index) => {
      const firstIndex = firstIndexByLevel.get(entry.level);
      if (firstIndex !== undefined) {
        context.addIssue({
          code: 'custom',
          path: [index, 'level'],
          message: `Search Reward level ${entry.level} 重複（已出現在第 ${firstIndex + 1} 筆）`,
        });
        return;
      }

      firstIndexByLevel.set(entry.level, index);
    });
  });

export type SearchRewardDataEntry = z.infer<typeof searchRewardEntrySchema>;
export type SearchRewardDataPayload = z.infer<typeof searchRewardPayloadSchema>;
