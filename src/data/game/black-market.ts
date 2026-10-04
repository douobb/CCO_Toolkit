import rawBlackMarket from './black-market.json';

import {
  createGameDataEnvelopeSchema,
  parseGameDataEnvelope,
} from '@/lib/game-data';
import { ccoFoundDataSource } from '@/lib/data-source';

import {
  blackMarketPayloadSchema,
  type BlackMarketQualityId,
} from './black-market.schema';

const blackMarketDataEnvelope = {
  datasetId: 'black-market',
  domain: 'activities',
  schemaVersion: '1.1.0',
  dataVersion: 'cco-found-initial-snapshot',
  updatedAt: '2026-08-28',
  sources: [ccoFoundDataSource],
  payload: rawBlackMarket,
} as const;

export const blackMarketDataEnvelopeSchema = createGameDataEnvelopeSchema(
  blackMarketPayloadSchema,
);

export const blackMarketDataSet = parseGameDataEnvelope(
  blackMarketDataEnvelope,
  blackMarketPayloadSchema,
);

export type BlackMarketDataSet = typeof blackMarketDataSet;

export const blackMarketQualityCatalog = blackMarketDataSet.payload.qualities;

export function getBlackMarketQualityDefinition(
  id: BlackMarketQualityId,
): (typeof blackMarketQualityCatalog)[number] {
  const definition = blackMarketQualityCatalog.find((quality) => quality.id === id);
  if (!definition) throw new Error(`未知的黑市品質 ID: ${id}`);
  return definition;
}

export {
  blackMarketFormulaIds,
  blackMarketQualityIds,
} from './black-market.schema';
export type {
  BlackMarketFormulaId,
  BlackMarketPayload,
  BlackMarketQualityDefinition,
  BlackMarketQualityId,
  BlackMarketSaleFormula,
} from './black-market.schema';
