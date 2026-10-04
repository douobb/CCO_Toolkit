import rawBackpackProgression from './backpack-progression.json';

import {
  createGameDataEnvelopeSchema,
  parseGameDataEnvelope,
} from '@/lib/game-data';
import { ccoFoundDataSource } from '@/lib/data-source';

import {
  backpackProgressionPayloadSchema,
} from './backpack-progression.schema';

const backpackProgressionDataEnvelope = {
  datasetId: 'backpack-progression',
  domain: 'progression',
  schemaVersion: '1.0.0',
  dataVersion: 'cco-found-initial-snapshot',
  updatedAt: '2026-08-29',
  sources: [ccoFoundDataSource],
  payload: rawBackpackProgression,
} as const;

export const backpackProgressionDataEnvelopeSchema = createGameDataEnvelopeSchema(
  backpackProgressionPayloadSchema,
);

export const backpackProgressionDataSet = parseGameDataEnvelope(
  backpackProgressionDataEnvelope,
  backpackProgressionPayloadSchema,
);

export type BackpackProgressionDataSet = typeof backpackProgressionDataSet;

export const backpackTierCatalog = backpackProgressionDataSet.payload.tiers;
export const backpackMaterialCatalog = backpackProgressionDataSet.payload.materials;

const backpackTierById = new Map(
  backpackTierCatalog.map((tier) => [tier.id, tier]),
);
const backpackMaterialById = new Map(
  backpackMaterialCatalog.map((material) => [material.id, material]),
);

export function getBackpackTierDefinition(id: string): (typeof backpackTierCatalog)[number] {
  const definition = backpackTierById.get(id);
  if (!definition) throw new Error(`未知的背包階段 ID: ${id}`);
  return definition;
}

export function getBackpackMaterialDefinition(id: string): (typeof backpackMaterialCatalog)[number] {
  const definition = backpackMaterialById.get(id);
  if (!definition) throw new Error(`未知的背包物資 ID: ${id}`);
  return definition;
}

export {
  backpackMaterialIds,
  backpackTierIds,
} from './backpack-progression.schema';
export type {
  BackpackMaterialDefinition,
  BackpackMaterialId,
  BackpackProgressionPayload,
  BackpackRequirement,
  BackpackTierDefinition,
  BackpackTierId,
} from './backpack-progression.schema';
