import rawEarningsActivities from './earnings-activities.json';

import {
  createGameDataEnvelopeSchema,
  parseGameDataEnvelope,
} from '@/lib/game-data';
import { ccoFoundDataSource } from '@/lib/data-source';

import {
  earningsActivitiesPayloadSchema,
  type EarningsActivityDefinition,
  type EarningsActivityId,
} from './earnings-activities.schema';

const earningsActivitiesDataEnvelope = {
  datasetId: 'earnings-activities',
  domain: 'activities',
  schemaVersion: '1.1.0',
  dataVersion: 'cco-found-black-market-batch-size-update-2026-10-07',
  updatedAt: '2026-10-07',
  sources: [ccoFoundDataSource],
  payload: rawEarningsActivities,
} as const;

export const earningsActivitiesDataEnvelopeSchema = createGameDataEnvelopeSchema(
  earningsActivitiesPayloadSchema,
);

export const earningsActivitiesDataSet = parseGameDataEnvelope(
  earningsActivitiesDataEnvelope,
  earningsActivitiesPayloadSchema,
);

export type EarningsActivitiesDataSet = typeof earningsActivitiesDataSet;

/** 活動收益工具共用的唯讀活動 catalog。 */
export const earningsActivityCatalog = earningsActivitiesDataSet.payload.activities;

const earningsActivityById = new Map(
  earningsActivityCatalog.map((activity) => [activity.id, activity]),
);

export function getEarningsActivityDefinition(id: EarningsActivityId | string): EarningsActivityDefinition {
  const definition = earningsActivityById.get(id);
  if (!definition) throw new Error(`未知的收益活動 ID: ${id}`);
  return definition;
}

export {
  earningsActivityIds,
  earningsActivityKindIds,
} from './earnings-activities.schema';
export type {
  EarningsActivityDefinition,
  EarningsActivityId,
  EarningsActivityKind,
  EarningsActivitiesPayload,
} from './earnings-activities.schema';
