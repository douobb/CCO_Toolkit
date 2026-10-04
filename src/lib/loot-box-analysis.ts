/**
 * 箱子／掉落價值分析的純計算與本機紀錄模型。
 *
 * 使用者只保存實際開箱數與原始掉落數量；價值、成本、期望與模擬結果
 * 一律依目前 Game Data 與 Shared User Inputs 即時計算，避免歷史紀錄
 * 複製當時的物價或衍生數值。
 */

import {
  getLootBoxDropDefinition,
  getLootBoxDropId,
  getLootBoxDropIdsForBox,
  lootBoxDropIds,
  type LootBoxDropId,
} from '@/data/game/loot-box-drops';
import { lootBoxIds, getLootBoxDefinition, type LootBoxId } from '@/data/game/loot-boxes';
import {
  expectedLootBoxNetAi,
  expectedLootBoxValueAi,
  lootBoxCostAi,
  valueOfLootBoxDrop,
} from './loot-box-calculator';
import type { ResolvedMarketPrices } from './market-prices';
import type { Locale } from './i18n';
import { playerDataContractLimits } from './player-data-contract';

export const lootBoxAnalysisSchemaVersion = 2 as const;
export const defaultLootBoxSimulationCount = 10_000;
export const maxLootBoxAnalysisRecords = playerDataContractLimits.maxLootBoxRecords;
export const lootBoxAnalysisRollupBatchSize = 100;
export const maxLootBoxAnalysisRollups = playerDataContractLimits.maxLootBoxRollups;
export const maxLootBoxAnalysisDropsPerEntry = playerDataContractLimits.maxDropsPerLootBoxEntry;

export interface LootBoxAnalysisDrop {
  readonly dropId: LootBoxDropId;
  readonly quantity: number;
}

export interface LootBoxAnalysisRecord {
  readonly id: string;
  readonly recordedAt: number;
  readonly boxType: LootBoxId;
  /** 實際開啟的箱子數；單筆紀錄不得超過該箱型的 batchSize。 */
  readonly openings: number;
  readonly drops: readonly LootBoxAnalysisDrop[];
}

/** 不再保留逐筆明細的舊統計批次；ID 用於跨檔案重複匯入去重。 */
export interface LootBoxAnalysisRollup {
  readonly id: string;
  readonly boxType: LootBoxId;
  readonly recordCount: number;
  readonly openings: number;
  readonly drops: readonly LootBoxAnalysisDrop[];
}

export interface LootBoxAnalysisState {
  readonly schemaVersion: typeof lootBoxAnalysisSchemaVersion;
  readonly records: readonly LootBoxAnalysisRecord[];
  readonly rollups: readonly LootBoxAnalysisRollup[];
}

export interface LootBoxAnalysisRecordInput {
  readonly id?: string;
  readonly recordedAt?: number;
  readonly boxType: LootBoxId;
  readonly openings: number;
  readonly drops: readonly LootBoxAnalysisDrop[];
}

export interface LootBoxDropAnalysis {
  readonly dropId: LootBoxDropId;
  readonly actualQuantity: number;
  readonly expectedQuantity: number;
  readonly actualValueAi: number | null;
  readonly expectedValueAi: number | null;
}

export interface LootBoxTypeAnalysis {
  readonly boxType: LootBoxId;
  readonly recordCount: number;
  readonly openings: number;
  readonly actualGrossAi: number | null;
  readonly actualNetAi: number | null;
  readonly expectedGrossAi: number | null;
  readonly expectedNetAi: number | null;
  readonly performancePercent: number | null;
  readonly drops: readonly LootBoxDropAnalysis[];
}

export interface LootBoxSimulationSummary {
  readonly boxType: LootBoxId;
  readonly openings: number;
  readonly simulations: number;
  readonly meanGrossAi: number;
  readonly standardDeviationAi: number;
  readonly actualGrossAi: number | null;
  readonly percentile: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSafePositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isLootBoxId(value: unknown): value is LootBoxId {
  return typeof value === 'string' && lootBoxIds.includes(value as LootBoxId);
}

function isLootBoxDropId(value: unknown): value is LootBoxDropId {
  return typeof value === 'string' && (lootBoxDropIds as readonly string[]).includes(value);
}

function isValidLootBoxAnalysisDrops(
  value: unknown,
  boxType: LootBoxId,
): value is readonly LootBoxAnalysisDrop[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > maxLootBoxAnalysisDropsPerEntry
  ) {
    return false;
  }

  const allowedDropIds = new Set(getLootBoxDropIdsForBox(boxType));
  const dropIds = new Set<string>();
  return value.every((drop) => {
    if (!isRecord(drop)) return false;
    if (
      !isLootBoxDropId(drop.dropId) ||
      !allowedDropIds.has(drop.dropId) ||
      !isSafePositiveInteger(drop.quantity) ||
      dropIds.has(drop.dropId)
    ) {
      return false;
    }
    dropIds.add(drop.dropId);
    return true;
  });
}

/** 驗證版本化本機紀錄；無效資料由 storage layer 清除，不提供舊格式 migration。 */
export function isLootBoxAnalysisState(value: unknown): value is LootBoxAnalysisState {
  if (!isRecord(value) || value.schemaVersion !== lootBoxAnalysisSchemaVersion) return false;
  if (!Array.isArray(value.records) || !Array.isArray(value.rollups)) return false;
  if (
    value.records.length > maxLootBoxAnalysisRecords ||
    value.rollups.length > maxLootBoxAnalysisRollups
  ) {
    return false;
  }

  const entryIds = new Set<string>();
  const validRecords = value.records.every((record) => {
    if (!isRecord(record)) return false;
    if (
      typeof record.id !== 'string' ||
      !record.id.trim() ||
      entryIds.has(record.id) ||
      !isSafeNonNegativeInteger(record.recordedAt) ||
      !isLootBoxId(record.boxType) ||
      !isSafePositiveInteger(record.openings) ||
      record.openings > getLootBoxDefinition(record.boxType).batchSize ||
      !isValidLootBoxAnalysisDrops(record.drops, record.boxType)
    ) {
      return false;
    }

    entryIds.add(record.id);
    return true;
  });
  if (!validRecords) return false;

  return value.rollups.every((rollup) => {
    if (!isRecord(rollup)) return false;
    if (
      typeof rollup.id !== 'string' ||
      !rollup.id.trim() ||
      entryIds.has(rollup.id) ||
      !isLootBoxId(rollup.boxType) ||
      !isSafePositiveInteger(rollup.recordCount) ||
      !isSafePositiveInteger(rollup.openings) ||
      !isValidLootBoxAnalysisDrops(rollup.drops, rollup.boxType)
    ) {
      return false;
    }

    entryIds.add(rollup.id);
    return true;
  });
}

export function createDefaultLootBoxAnalysisState(): LootBoxAnalysisState {
  return {
    schemaVersion: lootBoxAnalysisSchemaVersion,
    records: [],
    rollups: [],
  };
}

function createRecordId(usedIds: ReadonlySet<string> = new Set()): string {
  let attempt = 0;
  while (true) {
    const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    const suffix = attempt === 0 ? '' : `-${attempt}`;
    const id = `loot-box-${Date.now()}-${randomId}${suffix}`;
    if (!usedIds.has(id)) return id;
    attempt += 1;
  }
}

export function createLootBoxAnalysisRecord(
  input: LootBoxAnalysisRecordInput,
): LootBoxAnalysisRecord {
  return {
    id: input.id ?? createRecordId(),
    recordedAt: input.recordedAt ?? Date.now(),
    boxType: input.boxType,
    openings: input.openings,
    drops: input.drops,
  };
}

export function upsertLootBoxAnalysisRecord(
  state: LootBoxAnalysisState,
  record: LootBoxAnalysisRecord,
): LootBoxAnalysisState {
  const existing = state.records.some((item) => item.id === record.id);
  if (existing) {
    return {
      ...state,
      records: state.records.map((item) => item.id === record.id ? record : item),
    };
  }

  const entryIds = new Set<string>([
    ...state.records.map((item) => item.id),
    ...state.rollups.map((item) => item.id),
  ]);
  const recordToInsert = entryIds.has(record.id)
    ? { ...record, id: createRecordId(entryIds) }
    : record;
  entryIds.add(recordToInsert.id);
  const nextRecords = [recordToInsert, ...state.records];
  return compactLootBoxAnalysisState({ ...state, records: nextRecords });
}

export function removeLootBoxAnalysisRecord(
  state: LootBoxAnalysisState,
  recordId: string,
): LootBoxAnalysisState {
  return {
    ...state,
    records: state.records.filter((record) => record.id !== recordId),
  };
}

function sumObservedValue(
  record: Pick<LootBoxAnalysisRecord, 'drops'>,
  prices: ResolvedMarketPrices,
): number | null {
  let total = 0;
  for (const drop of record.drops) {
    const value = valueOfLootBoxDrop(drop.dropId, drop.quantity, prices);
    if (value === null) return null;
    total += value;
  }

  return Number.isFinite(total) ? total : null;
}

export function valueOfLootBoxAnalysisRecord(
  record: LootBoxAnalysisRecord,
  prices: ResolvedMarketPrices,
): number | null {
  return sumObservedValue(record, prices);
}

function addToMap(map: Map<LootBoxDropId, number>, id: LootBoxDropId, value: number): void {
  map.set(id, (map.get(id) ?? 0) + value);
}

function selectOldestRecordIndexes(
  records: readonly LootBoxAnalysisRecord[],
): ReadonlySet<number> {
  return new Set(
    records
      .map((record, index) => ({ record, index }))
      .sort((left, right) => {
        if (left.record.recordedAt !== right.record.recordedAt) {
          return left.record.recordedAt < right.record.recordedAt ? -1 : 1;
        }
        // 新紀錄會放在陣列前端；同一時間戳時，尾端仍視為較舊紀錄。
        return right.index - left.index;
      })
      .slice(0, lootBoxAnalysisRollupBatchSize)
      .map(({ index }) => index),
  );
}

function stableHash(values: readonly string[]): string {
  let hash = 2_166_136_261;
  for (const value of values) {
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16_777_619);
    }
    hash ^= 124;
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

function createRollupId(
  boxType: LootBoxId,
  records: readonly LootBoxAnalysisRecord[],
  usedIds: ReadonlySet<string>,
): string {
  const base = `loot-box-rollup-${boxType}`;
  if (!usedIds.has(base)) return base;

  const hashedBase = `${base}-${stableHash(records.map((record) => record.id).sort())}`;
  let candidate = hashedBase;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${hashedBase}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function mergeRollups(
  first: LootBoxAnalysisRollup,
  second: LootBoxAnalysisRollup,
): LootBoxAnalysisRollup {
  const quantities = new Map<LootBoxDropId, number>();
  for (const drop of first.drops) addToMap(quantities, drop.dropId, drop.quantity);
  for (const drop of second.drops) addToMap(quantities, drop.dropId, drop.quantity);
  const drops = getLootBoxDropIdsForBox(first.boxType)
    .filter((dropId) => quantities.has(dropId))
    .map((dropId) => ({ dropId, quantity: quantities.get(dropId)! }));
  return {
    ...first,
    recordCount: first.recordCount + second.recordCount,
    openings: first.openings + second.openings,
    drops,
  };
}

function releaseRollupCapacity(rollups: LootBoxAnalysisRollup[]): boolean {
  for (let firstIndex = 0; firstIndex < rollups.length; firstIndex += 1) {
    const first = rollups[firstIndex];
    if (!first) continue;
    const secondIndex = rollups.findIndex(
      (rollup, index) => index > firstIndex && rollup.boxType === first.boxType,
    );
    if (secondIndex < 0) continue;
    const second = rollups[secondIndex];
    if (!second) continue;
    rollups[firstIndex] = mergeRollups(first, second);
    rollups.splice(secondIndex, 1);
    return true;
  }
  return false;
}

function addRecordsToRollups(
  rollups: readonly LootBoxAnalysisRollup[],
  records: readonly LootBoxAnalysisRecord[],
  usedIds: Set<string>,
): readonly LootBoxAnalysisRollup[] {
  const grouped = new Map<LootBoxId, LootBoxAnalysisRecord[]>();
  for (const record of records) {
    const current = grouped.get(record.boxType) ?? [];
    current.push(record);
    grouped.set(record.boxType, current);
  }

  const nextRollups = [...rollups];
  for (const boxType of lootBoxIds) {
    const summarizedRecords = grouped.get(boxType);
    if (!summarizedRecords) continue;

    const existingIndex = nextRollups.findIndex((rollup) => rollup.boxType === boxType);
    if (
      existingIndex < 0 &&
      nextRollups.length >= maxLootBoxAnalysisRollups
    ) {
      releaseRollupCapacity(nextRollups);
    }
    const current = existingIndex >= 0 ? nextRollups[existingIndex] : undefined;
    const quantities = new Map<LootBoxDropId, number>();
    for (const drop of current?.drops ?? []) addToMap(quantities, drop.dropId, drop.quantity);

    let recordCount = current?.recordCount ?? 0;
    let openings = current?.openings ?? 0;
    for (const record of summarizedRecords) {
      recordCount += 1;
      openings += record.openings;
      for (const drop of record.drops) addToMap(quantities, drop.dropId, drop.quantity);
    }

    const drops = getLootBoxDropIdsForBox(boxType)
      .filter((dropId) => quantities.has(dropId))
      .map((dropId) => ({ dropId, quantity: quantities.get(dropId)! }));
    const nextRollup: LootBoxAnalysisRollup = {
      id: current?.id ?? createRollupId(boxType, summarizedRecords, usedIds),
      boxType,
      recordCount,
      openings,
      drops,
    };

    if (existingIndex >= 0) {
      nextRollups[existingIndex] = nextRollup;
    } else {
      nextRollups.push(nextRollup);
      usedIds.add(nextRollup.id);
    }
  }

  return nextRollups;
}

/**
 * 將超過明細容量的最舊紀錄每 100 筆彙總；手動新增與檔案匯入共用此規則。
 * 批次匯入可能一次超過多個批次，因此會重複整理至契約上限以內。
 */
export function compactLootBoxAnalysisState(
  state: LootBoxAnalysisState,
): LootBoxAnalysisState {
  let records = [...state.records];
  let rollups = [...state.rollups];
  const usedIds = new Set<string>([
    ...records.map((record) => record.id),
    ...rollups.map((rollup) => rollup.id),
  ]);

  while (records.length > maxLootBoxAnalysisRecords) {
    const selectedIndexes = selectOldestRecordIndexes(records);
    const selected = records.filter((_record, index) => selectedIndexes.has(index));
    records = records.filter((_record, index) => !selectedIndexes.has(index));
    rollups = [...addRecordsToRollups(rollups, selected, usedIds)];
  }

  return {
    ...state,
    records,
    rollups,
  };
}

function getExpectedDropQuantities(
  boxId: LootBoxId,
  openings: number,
): Map<LootBoxDropId, number> {
  const box = getLootBoxDefinition(boxId);
  const totalWeight = box.entries.reduce((sum, entry) => sum + entry.weight, 0);
  const quantities = new Map<LootBoxDropId, number>();

  for (const entry of box.entries) {
    addToMap(
      quantities,
      getLootBoxDropId(entry),
      openings * entry.weight / totalWeight * entry.quantity,
    );
  }

  return quantities;
}

function getActualDropQuantities(
  records: readonly Pick<LootBoxAnalysisRecord, 'drops'>[],
): Map<LootBoxDropId, number> {
  const quantities = new Map<LootBoxDropId, number>();
  for (const record of records) {
    for (const drop of record.drops) addToMap(quantities, drop.dropId, drop.quantity);
  }
  return quantities;
}

function calculateDropValue(
  dropId: LootBoxDropId,
  quantity: number,
  prices: ResolvedMarketPrices,
): number | null {
  return quantity === 0 ? 0 : valueOfLootBoxDrop(dropId, quantity, prices);
}

export function calculateLootBoxTypeAnalysis(
  boxId: LootBoxId,
  records: readonly LootBoxAnalysisRecord[],
  prices: ResolvedMarketPrices,
  rollups: readonly LootBoxAnalysisRollup[] = [],
): LootBoxTypeAnalysis {
  const boxRecords = records.filter((record) => record.boxType === boxId);
  const boxRollups = rollups.filter((rollup) => rollup.boxType === boxId);
  if (boxRecords.length === 0 && boxRollups.length === 0) {
    return {
      boxType: boxId,
      recordCount: 0,
      openings: 0,
      actualGrossAi: null,
      actualNetAi: null,
      expectedGrossAi: null,
      expectedNetAi: null,
      performancePercent: null,
      drops: [],
    };
  }

  const observations = [...boxRecords, ...boxRollups];
  const openings = observations.reduce((sum, record) => sum + record.openings, 0);
  const actualGrossAi = observations.reduce<number | null>((total, record) => {
    const value = sumObservedValue(record, prices);
    if (total === null || value === null) return null;
    return total + value;
  }, 0);
  const expectedGrossPerOpening = expectedLootBoxValueAi(boxId, prices);
  const expectedNetPerOpening = expectedLootBoxNetAi(boxId, prices);
  const expectedGrossAi = expectedGrossPerOpening === null
    ? null
    : expectedGrossPerOpening * openings;
  const expectedNetAi = expectedNetPerOpening === null
    ? null
    : expectedNetPerOpening * openings;
  const cost = lootBoxCostAi(boxId, prices);
  const actualNetAi = actualGrossAi === null || cost === null
    ? null
    : actualGrossAi - cost * openings;
  const actualQuantities = getActualDropQuantities(observations);
  const expectedQuantities = getExpectedDropQuantities(boxId, openings);
  const dropIds = getLootBoxDropIdsForBox(boxId).filter((id) =>
    actualQuantities.has(id) || expectedQuantities.has(id),
  );

  const drops = dropIds.map((dropId) => {
    const actualQuantity = actualQuantities.get(dropId) ?? 0;
    const expectedQuantity = expectedQuantities.get(dropId) ?? 0;
    return {
      dropId,
      actualQuantity,
      expectedQuantity,
      actualValueAi: calculateDropValue(dropId, actualQuantity, prices),
      expectedValueAi: calculateDropValue(dropId, expectedQuantity, prices),
    };
  });

  return {
    boxType: boxId,
    recordCount:
      boxRecords.length + boxRollups.reduce((sum, rollup) => sum + rollup.recordCount, 0),
    openings,
    actualGrossAi,
    actualNetAi: Number.isFinite(actualNetAi ?? 0) ? actualNetAi : null,
    expectedGrossAi: Number.isFinite(expectedGrossAi ?? 0) ? expectedGrossAi : null,
    expectedNetAi: Number.isFinite(expectedNetAi ?? 0) ? expectedNetAi : null,
    performancePercent: actualGrossAi !== null && expectedGrossAi !== null && expectedGrossAi > 0
      ? actualGrossAi / expectedGrossAi * 100
      : null,
    drops,
  };
}

export function calculateLootBoxAnalysis(
  records: readonly LootBoxAnalysisRecord[],
  prices: ResolvedMarketPrices,
  rollups: readonly LootBoxAnalysisRollup[] = [],
): readonly LootBoxTypeAnalysis[] {
  return lootBoxIds.map((boxId) =>
    calculateLootBoxTypeAnalysis(boxId, records, prices, rollups));
}

function createSeededRandom(seed: number): () => number {
  let state = (Number.isFinite(seed) ? Math.trunc(seed) : 1) >>> 0;
  if (state === 0) state = 0x9e3779b9;

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

interface PreparedSimulation {
  readonly totalWeight: number;
  readonly cumulativeWeights: readonly number[];
  readonly values: readonly (number | null)[];
}

function prepareSimulation(
  boxId: LootBoxId,
  prices: ResolvedMarketPrices,
): PreparedSimulation | null {
  const box = getLootBoxDefinition(boxId);
  const totalWeight = box.entries.reduce((sum, entry) => sum + entry.weight, 0);
  const cumulativeWeights: number[] = [];
  const values: (number | null)[] = [];
  let cumulative = 0;

  for (const entry of box.entries) {
    cumulative += entry.weight;
    cumulativeWeights.push(cumulative);
    values.push(valueOfLootBoxDrop(getLootBoxDropId(entry), entry.quantity, prices));
  }

  if (
    !Number.isFinite(totalWeight) ||
    totalWeight <= 0 ||
    values.some((value) => value === null)
  ) {
    return null;
  }

  return { totalWeight, cumulativeWeights, values };
}

function simulateOneOpening(
  prepared: PreparedSimulation,
  random: () => number,
): number {
  const target = random() * prepared.totalWeight;
  const entryIndex = prepared.cumulativeWeights.findIndex((weight) => target < weight);
  return prepared.values[entryIndex < 0 ? prepared.values.length - 1 : entryIndex] ?? 0;
}

function validateSimulationInput(
  openings: number,
  simulations: number,
): boolean {
  return isSafePositiveInteger(openings) && isSafePositiveInteger(simulations);
}

/** 以明確 seed 產生可測試且可重現的 gross value 模擬樣本。 */
export function simulateLootBoxValues(
  boxId: LootBoxId,
  openings: number,
  simulations: number,
  prices: ResolvedMarketPrices,
  seed = 1,
): readonly number[] | null {
  if (!validateSimulationInput(openings, simulations)) return null;
  const prepared = prepareSimulation(boxId, prices);
  if (!prepared) return null;

  const random = createSeededRandom(seed);
  const values: number[] = [];
  for (let simulation = 0; simulation < simulations; simulation += 1) {
    let total = 0;
    for (let opening = 0; opening < openings; opening += 1) {
      total += simulateOneOpening(prepared, random);
    }
    values.push(total);
  }
  return values;
}

export async function simulateLootBoxValuesAsync(
  boxId: LootBoxId,
  openings: number,
  simulations: number,
  prices: ResolvedMarketPrices,
  options: {
    readonly seed?: number;
    readonly yieldEvery?: number;
    readonly shouldCancel?: () => boolean;
  } = {},
): Promise<readonly number[] | null> {
  if (!validateSimulationInput(openings, simulations)) return null;
  const prepared = prepareSimulation(boxId, prices);
  if (!prepared) return null;

  const random = createSeededRandom(options.seed ?? 1);
  const yieldEvery = isSafePositiveInteger(options.yieldEvery ?? 128)
    ? options.yieldEvery ?? 128
    : 128;
  const values: number[] = [];

  for (let simulation = 0; simulation < simulations; simulation += 1) {
    if (options.shouldCancel?.()) return null;

    let total = 0;
    for (let opening = 0; opening < openings; opening += 1) {
      total += simulateOneOpening(prepared, random);
    }
    values.push(total);

    if ((simulation + 1) % yieldEvery === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  return values;
}

export function summarizeLootBoxSimulation(
  boxId: LootBoxId,
  openings: number,
  values: readonly number[],
  actualGrossAi: number | null,
): LootBoxSimulationSummary | null {
  if (!validateSimulationInput(openings, values.length)) return null;

  const meanGrossAi = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - meanGrossAi) ** 2, 0) / values.length;
  const percentile = actualGrossAi === null
    ? null
    : values.filter((value) => value <= actualGrossAi).length / values.length * 100;

  return {
    boxType: boxId,
    openings,
    simulations: values.length,
    meanGrossAi,
    standardDeviationAi: Math.sqrt(variance),
    actualGrossAi,
    percentile,
  };
}

/** 供 UI 顯示或未來匯出使用的目前名稱；核心只保存 stable drop ID。 */
export function getLootBoxAnalysisDropLabel(dropId: LootBoxDropId, locale: Locale): string {
  return getLootBoxDropDefinition(dropId).labels[locale];
}
