import { describe, expect, it } from 'vitest';

import contractSchema from '../../contracts/player-data/player-data-v1.schema.json';
import invalidDuplicateId from '../../contracts/player-data/fixtures/invalid-duplicate-id.json';
import invalidOutOfRange from '../../contracts/player-data/fixtures/invalid-out-of-range.json';
import validComplete from '../../contracts/player-data/fixtures/valid-complete.json';
import validMinimal from '../../contracts/player-data/fixtures/valid-minimal.json';
import validUnknownSection from '../../contracts/player-data/fixtures/valid-unknown-section.json';
import validUnsupportedSectionVersion from '../../contracts/player-data/fixtures/valid-unsupported-section-version.json';
import {
  inspectPlayerDataFile,
  playerDataAttributeIds,
  playerDataContractLimits,
  playerDataFileSchema,
  playerDataFormat,
  playerDataFormatVersion,
  playerDataInventoryItemIds,
  playerDataSectionIds,
  playerDataSectionRegistry,
} from './player-data-contract';

function copy<T>(value: T): T {
  return structuredClone(value);
}

function getFixtureSectionData<T>(document: unknown, sectionId: string): T {
  const sections = (document as {
    readonly sections?: readonly { readonly id?: unknown; readonly data?: unknown }[];
  }).sections;
  const section = sections?.find((entry) => entry.id === sectionId);
  if (!section) throw new Error(`測試 fixture 缺少 ${sectionId} section`);
  return section.data as T;
}

interface InventoryFixtureData {
  readonly items: { itemId: string; quantity: number }[];
}

interface LootBoxHistoryFixtureData {
  readonly records: {
    id: string;
    recordedAt: string;
    openings: number;
    drops: { dropId: string; quantity: number }[];
  }[];
  readonly rollups: {
    id: string;
  }[];
}

function expectInvalid(value: unknown, path?: readonly (string | number)[]) {
  const result = playerDataFileSchema.safeParse(value);
  expect(result.success).toBe(false);
  if (result.success || !path) return;

  expect(
    result.error.issues.some((issue) => issue.path.join('.') === path.join('.')),
    JSON.stringify(result.error.issues.map((issue) => issue.path)),
  ).toBe(true);
}

describe('玩家資料交換契約', () => {
  it('接受最小與完整合法 fixture，且不依賴顯示名稱', () => {
    const minimal = inspectPlayerDataFile(validMinimal);
    const complete = inspectPlayerDataFile(validComplete);

    expect(minimal.success).toBe(true);
    expect(complete.success).toBe(true);
    if (!minimal.success || !complete.success) return;

    expect(minimal.supportedSections.map((section) => section.id)).toEqual(['progression']);
    expect(complete.supportedSections.map((section) => section.id)).toEqual(playerDataSectionIds);
    expect(JSON.stringify(validComplete)).not.toMatch(/labels|繁體中文|English/);
    expect(JSON.stringify(validComplete)).not.toMatch(
      /prices|exchangeRates|cacheRates|buffs|simulationSeed|calculationResult/,
    );
  });

  it('以 envelope 版本及獨立 section 版本維持擴充邊界', () => {
    const unknown = inspectPlayerDataFile(validUnknownSection);
    const unsupportedVersion = inspectPlayerDataFile(validUnsupportedSectionVersion);

    expect(unknown.success).toBe(true);
    expect(unsupportedVersion.success).toBe(true);
    if (!unknown.success || !unsupportedVersion.success) return;

    expect(unknown.supportedSections).toEqual([]);
    expect(unknown.unsupportedSections).toEqual([
      { id: 'future-player-history', schemaVersion: 1, reason: 'unknown-section' },
    ]);
    expect(unsupportedVersion.unsupportedSections).toEqual([
      { id: 'inventory', schemaVersion: 2, reason: 'unsupported-version' },
    ]);

    expectInvalid({ ...validMinimal, formatVersion: 2 }, ['formatVersion']);
    expectInvalid({ ...validMinimal, format: 'toolkit-storage' }, ['format']);

    const whitespaceSectionId = copy(validUnknownSection);
    whitespaceSectionId.sections[0].id = ' future-player-history';
    expectInvalid(whitespaceSectionId, ['sections', 0, 'id']);

  });

  it('固定四個 section registry 與各自支援版本', () => {
    expect(playerDataFormat).toBe('cco-player-data');
    expect(playerDataFormatVersion).toBe(1);
    expect(playerDataSectionRegistry.map((entry) => entry.id)).toEqual(playerDataSectionIds);
    expect(playerDataSectionRegistry.every((entry) => entry.supportedVersions[0] === 1)).toBe(true);
    expect(Object.isFrozen(playerDataSectionRegistry)).toBe(true);
  });

  it('拒絕重複 section、重複 catalog ID 與未知 catalog ID', () => {
    const duplicateSection = copy(validMinimal);
    duplicateSection.sections.push(copy(duplicateSection.sections[0]));
    expectInvalid(duplicateSection, ['sections', 1, 'id']);

    expectInvalid(invalidDuplicateId, ['sections', 0, 'data', 'items', 1, 'itemId']);

    const unknownItem = copy(validComplete);
    const inventory = getFixtureSectionData<InventoryFixtureData>(unknownItem, 'inventory');
    inventory.items[0].itemId = 'future-item';
    expectInvalid(unknownItem, ['sections', 2, 'data', 'items', 0, 'itemId']);
  });

  it('拒絕不合法玩家數值、技能超過主等級與非安全整數', () => {
    expectInvalid(invalidOutOfRange, ['sections', 0, 'data', 'values', 0, 'value']);

    const skillAbovePlayer = copy(validMinimal);
    skillAbovePlayer.sections[0].data.levels.push({ id: 'mining-skill', value: 2 });
    expectInvalid(skillAbovePlayer, ['sections', 0, 'data', 'levels', 1, 'value']);

    const decimalQuantity = copy(validComplete);
    const inventory = getFixtureSectionData<InventoryFixtureData>(decimalQuantity, 'inventory');
    inventory.items[0].quantity = -1;
    expectInvalid(decimalQuantity, ['sections', 2, 'data', 'items', 0, 'quantity']);

    inventory.items[0].quantity = 1.5;
    expectInvalid(decimalQuantity, ['sections', 2, 'data', 'items', 0, 'quantity']);

    inventory.items[0].quantity = Number.MAX_SAFE_INTEGER + 1;
    expectInvalid(decimalQuantity, ['sections', 2, 'data', 'items', 0, 'quantity']);
  });

  it('檢查開箱日期、batchSize、箱型掉落與可攜式去重 ID', () => {
    const invalidDate = copy(validComplete);
    const history = getFixtureSectionData<LootBoxHistoryFixtureData>(
      invalidDate,
      'loot-box-history',
    );
    history.records[0].recordedAt = '2026-02-30T00:00:00.000Z';
    expectInvalid(invalidDate, ['sections', 3, 'data', 'records', 0, 'recordedAt']);

    const tooManyOpenings = copy(validComplete);
    const tooManyHistory = getFixtureSectionData<LootBoxHistoryFixtureData>(
      tooManyOpenings,
      'loot-box-history',
    );
    tooManyHistory.records[0].openings = 13;
    expectInvalid(tooManyOpenings, ['sections', 3, 'data', 'records', 0, 'openings']);

    const wrongDrop = copy(validComplete);
    const wrongDropHistory = getFixtureSectionData<LootBoxHistoryFixtureData>(
      wrongDrop,
      'loot-box-history',
    );
    wrongDropHistory.records[0].drops[0].dropId = 'equipment-red';
    expectInvalid(wrongDrop, ['sections', 3, 'data', 'records', 0, 'drops', 0, 'dropId']);

    const duplicatePortableId = copy(validComplete);
    const duplicateHistory = getFixtureSectionData<LootBoxHistoryFixtureData>(
      duplicatePortableId,
      'loot-box-history',
    );
    duplicateHistory.rollups[0].id = duplicateHistory.records[0].id;
    expectInvalid(duplicatePortableId, ['sections', 3, 'data', 'rollups', 0, 'id']);

    const whitespaceRecordId = copy(validComplete);
    const whitespaceHistory = getFixtureSectionData<LootBoxHistoryFixtureData>(
      whitespaceRecordId,
      'loot-box-history',
    );
    whitespaceHistory.records[0].id = ' record-with-leading-space';
    expectInvalid(whitespaceRecordId, ['sections', 3, 'data', 'records', 0, 'id']);
  });

  it('限制 section 與大型陣列容量，但保留未來 catalog 擴充空間', () => {
    const tooManySections = {
      ...validMinimal,
      sections: Array.from(
        { length: playerDataContractLimits.maxSections + 1 },
        (_, index) => ({
          id: `future-section-${index}`,
          schemaVersion: 1,
          data: {},
        }),
      ),
    };
    expectInvalid(tooManySections, ['sections']);

    const tooManyInventoryItems = {
      ...validMinimal,
      sections: [{
        id: 'inventory',
        schemaVersion: 1,
        data: {
          completeness: 'manual',
          items: Array.from(
            { length: playerDataContractLimits.maxInventoryItems + 1 },
            () => ({ itemId: 'tech-scrap', quantity: 1 }),
          ),
        },
      }],
    };
    expectInvalid(tooManyInventoryItems, ['sections', 0, 'data', 'items']);

    const tooManyRecords = {
      ...validMinimal,
      sections: [{
        id: 'loot-box-history',
        schemaVersion: 1,
        data: {
          records: Array.from(
            { length: playerDataContractLimits.maxLootBoxRecords + 1 },
            (_, index) => ({
              id: `record-${index}`,
              recordedAt: new Date(index).toISOString(),
              boxType: 'white',
              openings: 1,
              drops: [{ dropId: 'item-hash', quantity: 1 }],
            }),
          ),
          rollups: [],
        },
      }],
    };
    expectInvalid(tooManyRecords, ['sections', 0, 'data', 'records']);

    const tooManyRollups = {
      ...validMinimal,
      sections: [{
        id: 'loot-box-history',
        schemaVersion: 1,
        data: {
          records: [],
          rollups: Array.from(
            { length: playerDataContractLimits.maxLootBoxRollups + 1 },
            (_, index) => ({
              id: `rollup-${index}`,
              boxType: 'yellow',
              recordCount: 1,
              openings: 1,
              drops: [{ dropId: 'item-old-pouch', quantity: 1 }],
            }),
          ),
        },
      }],
    };
    expectInvalid(tooManyRollups, ['sections', 0, 'data', 'rollups']);

    expect(playerDataContractLimits.maxFileBytes).toBe(5 * 1024 * 1024);
  });

  it('JSON Schema 與 runtime catalog 的格式、section 及 ID 基線一致', () => {
    expect(contractSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(contractSchema.properties.format.const).toBe(playerDataFormat);
    expect(contractSchema.properties.formatVersion.const).toBe(playerDataFormatVersion);

    const sectionConditions = contractSchema.$defs.section.allOf.map(
      (condition) => condition.if.properties.id.const,
    );
    expect(sectionConditions).toEqual(playerDataSectionIds);
    expect(contractSchema.$defs.playerAttributeValue.properties.id.enum).toEqual(
      playerDataAttributeIds,
    );
    expect(contractSchema.$defs.inventoryItem.properties.itemId.enum).toEqual(
      playerDataInventoryItemIds,
    );
  });
});
