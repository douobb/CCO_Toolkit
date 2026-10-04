import searchRewardsRaw from './search-rewards.json';
import {
  createGameDataEnvelopeSchema,
  parseGameDataEnvelope,
} from '@/lib/game-data';
import { ccoFoundDataSource } from '@/lib/data-source';

import { searchRewardPayloadSchema } from './search-rewards.schema';

const searchRewardDataEnvelope = {
  datasetId: 'search-rewards',
  domain: 'activities',
  schemaVersion: '1.0.0',
  dataVersion: 'cco-found-initial-snapshot',
  updatedAt: '2026-08-27',
  sources: [ccoFoundDataSource],
  payload: searchRewardsRaw,
} as const;

/** Search Reward 是 TASK-402 驗證用的第一份真實 Game Data envelope。 */
export const searchRewardDataEnvelopeSchema = createGameDataEnvelopeSchema(
  searchRewardPayloadSchema,
);

export const searchRewardDataSet = parseGameDataEnvelope(
  searchRewardDataEnvelope,
  searchRewardPayloadSchema,
);

export type SearchRewardDataSet = typeof searchRewardDataSet;
