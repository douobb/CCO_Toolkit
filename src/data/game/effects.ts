import rawEffects from './effects.json';

import {
  createGameDataEnvelopeSchema,
  parseGameDataEnvelope,
} from '@/lib/game-data';
import { ccoFoundDataSource } from '@/lib/data-source';

import { effectsPayloadSchema } from './effects.schema';

const effectsDataEnvelope = {
  datasetId: 'effects',
  domain: 'effects',
  schemaVersion: '1.0.0',
  dataVersion: 'cco-found-initial-snapshot',
  updatedAt: '2026-08-28',
  sources: [ccoFoundDataSource],
  payload: rawEffects,
} as const;

export const effectsDataEnvelopeSchema = createGameDataEnvelopeSchema(effectsPayloadSchema);

export const effectsDataSet = parseGameDataEnvelope(effectsDataEnvelope, effectsPayloadSchema);
export type EffectsDataSet = typeof effectsDataSet;

export const statusEffectCatalog = effectsDataSet.payload.statusEffects;
export const manualEffectInputCatalog = effectsDataSet.payload.manualInputs;

export function getStatusEffectDefinition(
  id: (typeof statusEffectCatalog)[number]['id'],
): (typeof statusEffectCatalog)[number] {
  const definition = statusEffectCatalog.find((effect) => effect.id === id);
  if (!definition) throw new Error(`未知的狀態效果 ID: ${id}`);
  return definition;
}

export function getManualEffectInputDefinition(
  id: (typeof manualEffectInputCatalog)[number]['id'],
): (typeof manualEffectInputCatalog)[number] {
  const definition = manualEffectInputCatalog.find((input) => input.id === id);
  if (!definition) throw new Error(`未知的手動效果輸入 ID: ${id}`);
  return definition;
}

export { manualEffectInputIds, statusEffectIds } from './effects.schema';
export type { ManualEffectInputId, StatusEffectId } from './effects.schema';
