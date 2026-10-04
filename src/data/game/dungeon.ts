import rawDungeon from './dungeon.json';

import {
  createGameDataEnvelopeSchema,
  parseGameDataEnvelope,
} from '@/lib/game-data';
import { ccoFoundDataSource } from '@/lib/data-source';

import {
  dungeonPayloadSchema,
  type DungeonInvasionTierId,
  type DungeonPrefixId,
} from './dungeon.schema';

const dungeonDataEnvelope = {
  datasetId: 'dungeon',
  domain: 'activities',
  schemaVersion: '1.0.0',
  dataVersion: 'cco-found-initial-snapshot',
  updatedAt: '2026-08-28',
  sources: [ccoFoundDataSource],
  payload: rawDungeon,
} as const;

export const dungeonDataEnvelopeSchema = createGameDataEnvelopeSchema(dungeonPayloadSchema);

export const dungeonDataSet = parseGameDataEnvelope(
  dungeonDataEnvelope,
  dungeonPayloadSchema,
);

export type DungeonDataSet = typeof dungeonDataSet;

export const dungeonPrefixCatalog = dungeonDataSet.payload.prefixes;
export const dungeonSummaryPrefixCatalog = dungeonDataSet.payload.summaryPrefixes;
export const dungeonBaseFormulaCatalog = dungeonDataSet.payload.baseFormulas;
export const dungeonRules = dungeonDataSet.payload.rules;

export function getDungeonPrefixModifier(
  id: DungeonPrefixId,
): (typeof dungeonDataSet.payload.prefixModifiers)[DungeonPrefixId] {
  return dungeonDataSet.payload.prefixModifiers[id];
}

export function getDungeonInvasionTier(level: number) {
  return dungeonDataSet.payload.enemyTypeModifiers.invasion.tiers.find(
    (tier) => level >= tier.levelRange.min && level <= tier.levelRange.max,
  );
}

export function getDungeonInvasionTierById(id: DungeonInvasionTierId) {
  return dungeonDataSet.payload.enemyTypeModifiers.invasion.tiers.find(
    (tier) => tier.id === id,
  );
}

export {
  dungeonBaseStatIds,
  dungeonEnemyKindIds,
  dungeonInvasionTierIds,
  dungeonPrefixIds,
  dungeonSummaryPrefixIds,
} from './dungeon.schema';
export type {
  DungeonBaseFormula,
  DungeonBaseStatId,
  DungeonEnemyKindId,
  DungeonEnemyModifierTable,
  DungeonEnemyTypeModifier,
  DungeonInvasionTier,
  DungeonInvasionTierId,
  DungeonPayload,
  DungeonPrefixId,
  DungeonPrefixModifier,
  DungeonRules,
  DungeonSummaryPrefixId,
} from './dungeon.schema';
