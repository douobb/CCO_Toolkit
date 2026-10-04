import rawProgression from './progression.json';

import {
  createGameDataEnvelopeSchema,
  parseGameDataEnvelope,
} from '@/lib/game-data';
import { ccoFoundDataSource } from '@/lib/data-source';

import {
  progressionLevelIds,
  progressionPayloadSchema,
  type ProgressionLevelDefinition,
  type ProgressionLevelId,
  type ProgressionMethodDefinition,
} from './progression.schema';

const progressionDataEnvelope = {
  datasetId: 'progression',
  domain: 'progression',
  schemaVersion: '1.0.0',
  dataVersion: 'cco-found-initial-snapshot',
  updatedAt: '2026-08-28',
  sources: [ccoFoundDataSource],
  payload: rawProgression,
} as const;

export const progressionDataEnvelopeSchema = createGameDataEnvelopeSchema(
  progressionPayloadSchema,
);

export const progressionDataSet = parseGameDataEnvelope(
  progressionDataEnvelope,
  progressionPayloadSchema,
);

export type ProgressionDataSet = typeof progressionDataSet;

/** 供設定頁與工具 selector 共用的六種等級定義。 */
export const progressionLevelCatalog: readonly ProgressionLevelDefinition[] =
  progressionDataSet.payload.levels;

/** 供 Level calculation 使用的 immutable method catalog。 */
export const progressionMethodCatalog = Object.freeze(Object.fromEntries(
  progressionLevelIds.map((id) => [id, progressionDataSet.payload.methods[id]]),
)) as Readonly<Record<ProgressionLevelId, readonly ProgressionMethodDefinition[]>>;

export function getProgressionLevelDefinition(
  id: ProgressionLevelId,
): ProgressionLevelDefinition {
  const definition = progressionLevelCatalog.find((item) => item.id === id);
  if (!definition) throw new Error(`未知的 progression level ID: ${id}`);
  return definition;
}

export function getProgressionMethods(
  id: ProgressionLevelId,
): readonly ProgressionMethodDefinition[] {
  const methods = progressionMethodCatalog[id];
  if (!methods) throw new Error(`未知的 progression method catalog ID: ${id}`);
  return methods;
}

export {
  progressionFormulaIds,
  progressionLevelIds,
  progressionMethodIds,
  progressionResourceIds,
  progressionSkillIds,
} from './progression.schema';
export type {
  CatalogVerification,
  ProgressionFormulaId,
  ProgressionMethodDefinition,
  ProgressionMethodId,
  ProgressionResourceDefinition,
  ProgressionResourceId,
  ProgressionLevelDefinition,
  ProgressionLevelId,
  ProgressionSkillId,
} from './progression.schema';
