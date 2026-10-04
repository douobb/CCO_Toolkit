import rawLootBoxes from './loot-boxes.json';

import {
  createGameDataEnvelopeSchema,
  parseGameDataEnvelope,
} from '@/lib/game-data';
import { ccoFoundDataSource } from '@/lib/data-source';

import {
  lootBoxesPayloadSchema,
  type LootBoxId,
} from './loot-boxes.schema';

const lootBoxesDataEnvelope = {
  datasetId: 'loot-boxes',
  domain: 'activities',
  schemaVersion: '1.0.0',
  dataVersion: 'cco-found-initial-snapshot',
  updatedAt: '2026-08-29',
  sources: [ccoFoundDataSource],
  payload: rawLootBoxes,
} as const;

export const lootBoxesDataEnvelopeSchema = createGameDataEnvelopeSchema(
  lootBoxesPayloadSchema,
);

export const lootBoxesDataSet = parseGameDataEnvelope(
  lootBoxesDataEnvelope,
  lootBoxesPayloadSchema,
);

export type LootBoxesDataSet = typeof lootBoxesDataSet;

export const lootBoxCatalog = lootBoxesDataSet.payload.boxes;

const lootBoxById = new Map<string, (typeof lootBoxCatalog)[number]>(
  lootBoxCatalog.map((box) => [box.id, box]),
);

export function getLootBoxDefinition(id: LootBoxId | string): (typeof lootBoxCatalog)[number] {
  const definition = lootBoxById.get(id);
  if (!definition) throw new Error(`未知的箱子 ID: ${id}`);
  return definition;
}

export { lootBoxIds, lootBoxRarityIds } from './loot-boxes.schema';
export type {
  LootBoxDefinition,
  LootBoxEntry,
  LootBoxId,
  LootBoxRarityId,
  LootBoxesPayload,
} from './loot-boxes.schema';
