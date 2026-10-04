import { describe, expect, it } from 'vitest';

import rawEarningsActivities from './earnings-activities.json';
import {
  earningsActivitiesDataEnvelopeSchema,
  earningsActivitiesDataSet,
  earningsActivityCatalog,
} from './earnings-activities';
import { earningsActivitiesPayloadSchema } from './earnings-activities.schema';

describe('earnings-activities Game Data', () => {
  it('通過 payload 與 envelope schema，保留完整的 16 種活動', () => {
    expect(earningsActivitiesPayloadSchema.safeParse(rawEarningsActivities).success).toBe(true);
    expect(earningsActivitiesDataEnvelopeSchema.safeParse(earningsActivitiesDataSet).success).toBe(true);
    expect(earningsActivityCatalog).toHaveLength(16);
    expect(new Set(earningsActivityCatalog.map((activity) => activity.id)).size).toBe(16);
    expect(earningsActivityCatalog.find((activity) => activity.id === 'search')?.batchSize).toBe(12);
  });

  it('依活動 kind 驗證專屬欄位', () => {
    const raw = structuredClone(rawEarningsActivities) as {
      activities: Array<Record<string, unknown>>;
    };
    const activity = raw.activities.find((entry) => entry.id === 'crush-medical');
    expect(activity).toBeDefined();
    if (activity) delete activity.inputItemId;
    expect(earningsActivitiesPayloadSchema.safeParse(raw).success).toBe(false);
  });

  it('拒絕重複活動 ID，且不把玩家數量或減時假設寫入 dataset', () => {
    const raw = structuredClone(rawEarningsActivities) as {
      activities: Array<Record<string, unknown>>;
    };
    raw.activities.push({ ...raw.activities[0] });
    const result = earningsActivitiesPayloadSchema.safeParse(raw);
    expect(result.success).toBe(false);
    expect(JSON.stringify(rawEarningsActivities)).not.toContain('referenceTimeReductionPercent');
    expect(JSON.stringify(rawEarningsActivities)).not.toContain('ownedQuantity');
  });

  it('解析後的 envelope 與 payload 維持唯讀', () => {
    expect(Object.isFrozen(earningsActivitiesDataSet)).toBe(true);
    expect(Object.isFrozen(earningsActivitiesDataSet.payload)).toBe(true);
    expect(Object.isFrozen(earningsActivitiesDataSet.payload.activities[0])).toBe(true);
  });
});
