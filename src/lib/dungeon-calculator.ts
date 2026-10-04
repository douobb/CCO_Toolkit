/**
 * 地城評估的純計算核心。
 *
 * 這個模組只接受已整理好的數值與地城 Game Data，不讀取 React、瀏覽器
 * 儲存、DOM 或 CCO Helper 狀態。玩家輸入中的武器傷害與爆擊傷害百分比，
 * 應在工具 adapter 先合併成實際爆擊傷害，再交給本模組。
 */

import {
  dungeonDataSet,
  getDungeonInvasionTier,
} from '@/data/game/dungeon';
import type {
  DungeonEnemyKindId,
  DungeonPrefixId,
} from '@/data/game/dungeon';

const dungeonPayload = dungeonDataSet.payload;

export const DUNGEON_LEVEL_MIN = dungeonPayload.levelRange.min;
export const DUNGEON_LEVEL_MAX = dungeonPayload.levelRange.max;
export const DUNGEON_DEFAULT_LEVEL = 400;
export const DUNGEON_CRITICAL_DAMAGE_MIN = 20;
export const DUNGEON_CRITICAL_DAMAGE_MAX = 220;

export type DungeonType = 'normal' | 'invasion';
export type DungeonEnemyKind = DungeonEnemyKindId;
export type DungeonPrefixInput = DungeonPrefixId | 'X';

export interface DungeonCalculationInput {
  readonly enemyLevel: number;
  readonly dungeonType: DungeonType;
  readonly playerMaxHealth: number;
  readonly playerShield: number;
  readonly damageReductionPercent: number;
  readonly destructiveWeaponCriticalDamage: number;
}

export interface DungeonEnemyStats {
  readonly prefix: DungeonPrefixId;
  readonly hp: number;
  readonly shield: number;
  readonly attackMin: number;
  readonly attackMax: number;
  readonly experienceMin: number;
  readonly experienceMax: number;
  readonly btc: number;
}

export interface DungeonEnemyTable {
  readonly small: readonly DungeonEnemyStats[];
  readonly boss: readonly DungeonEnemyStats[];
}

export interface DungeonRoomCritProbability {
  readonly roomLevel: number;
  readonly probabilityPercent: number;
}

export interface DungeonSummary {
  readonly roomLevels: readonly number[];
  readonly maxSafeEnemyLevel: number;
  readonly maxSafeRoomLevel: number;
  readonly smallEnemyAverageExperience: number;
  readonly smallEnemyAverageClicks: number;
  readonly smallEnemyExperiencePerClick: number;
  readonly bossAverageExperience: number;
  readonly bossAverageClicks: number;
  readonly bossExperiencePerClick: number;
  readonly critDeathProbabilities: readonly DungeonRoomCritProbability[];
  readonly playerEffectiveHealth: number;
}

export interface DungeonCalculation {
  readonly input: DungeonCalculationInput;
  readonly roomLevels: readonly number[];
  readonly enemies: DungeonEnemyTable;
  readonly summary: DungeonSummary;
}

const finiteNonNegative = (value: number): boolean => Number.isFinite(value) && value >= 0;
const finitePositive = (value: number): boolean => Number.isFinite(value) && value > 0;

function isDungeonType(value: string): value is DungeonType {
  return value === 'normal' || value === 'invasion';
}

export function isValidDungeonInput(input: DungeonCalculationInput): boolean {
  return Number.isSafeInteger(input.enemyLevel) &&
    input.enemyLevel >= DUNGEON_LEVEL_MIN &&
    input.enemyLevel <= DUNGEON_LEVEL_MAX &&
    isDungeonType(input.dungeonType) &&
    finiteNonNegative(input.playerMaxHealth) &&
    finiteNonNegative(input.playerShield) &&
    Number.isSafeInteger(input.damageReductionPercent) &&
    input.damageReductionPercent >= 0 &&
    input.damageReductionPercent <= 100 &&
    finitePositive(input.destructiveWeaponCriticalDamage);
}

/** 將破壞性武器傷害與爆擊傷害百分比合併成地城公式使用的實際爆擊傷害。 */
export function deriveDestructiveWeaponCriticalDamage(
  destructiveWeaponDamage: number,
  criticalDamagePercent: number,
): number | null {
  if (
    !Number.isSafeInteger(destructiveWeaponDamage) ||
    destructiveWeaponDamage <= 0 ||
    !Number.isSafeInteger(criticalDamagePercent) ||
    criticalDamagePercent < DUNGEON_CRITICAL_DAMAGE_MIN ||
    criticalDamagePercent > DUNGEON_CRITICAL_DAMAGE_MAX
  ) {
    return null;
  }

  const actualDamage = destructiveWeaponDamage * (criticalDamagePercent / 100);
  return finitePositive(actualDamage) ? actualDamage : null;
}

function ceil(value: number): number {
  return Math.ceil(value);
}

function modifierFactor(value: number): number {
  return value === 0 ? 1 : value;
}

function baseStat(
  level: number,
  formula: { readonly power: number; readonly base: number; readonly multiplier: number },
): number {
  return (level ** formula.power + formula.base) * formula.multiplier;
}

function getEnemyTypeModifier(
  level: number,
  dungeonType: DungeonType,
  kind: DungeonEnemyKind,
) {
  if (dungeonType === 'normal') {
    return {
      modifier: dungeonPayload.enemyTypeModifiers.normal[kind],
      experienceExtra: dungeonPayload.rules.normalExperienceExtraMultiplier,
    };
  }

  const tier = getDungeonInvasionTier(level);
  if (!tier) {
    throw new RangeError(`地城敵人等級超出資料集範圍：${level}`);
  }

  return {
    modifier: tier[kind],
    experienceExtra: dungeonPayload.rules.invasionExperienceExtraMultiplier,
  };
}

export function calculateEnemy(
  level: number,
  dungeonType: DungeonType,
  kind: DungeonEnemyKind,
  prefixInput: DungeonPrefixInput,
): DungeonEnemyStats {
  const prefix: DungeonPrefixId = prefixInput === 'X' ? 'x' : prefixInput;
  const type = getEnemyTypeModifier(level, dungeonType, kind);
  const prefixModifier = dungeonPayload.prefixModifiers[prefix];
  const hpBase = baseStat(level, dungeonPayload.baseFormulas.hp);
  const shieldBase = baseStat(level, dungeonPayload.baseFormulas.shield);
  const attackBase = baseStat(level, dungeonPayload.baseFormulas.attack);
  const experienceBase = baseStat(level, dungeonPayload.baseFormulas.experience);
  const btcBase = baseStat(level, dungeonPayload.baseFormulas.btc);
  const attackRaw = attackBase *
    (modifierFactor(type.modifier.attack) + prefixModifier.attack) *
    prefixModifier.damageMultiplier;
  const attackMaxMultiplier = dungeonPayload.rules.maximumRandomMultiplier *
    dungeonPayload.rules.attackMaximumMultiplier *
    (prefix === 'crit' ? dungeonPayload.rules.critMaximumMultiplier : 1);
  const experienceRaw = experienceBase *
    type.modifier.experience *
    prefixModifier.experience *
    type.experienceExtra;

  return {
    prefix,
    hp: ceil(hpBase * (modifierFactor(type.modifier.hp) + prefixModifier.hp)),
    shield: ceil(shieldBase * (modifierFactor(type.modifier.shield) + prefixModifier.shield)),
    attackMin: ceil(attackRaw * dungeonPayload.rules.minimumRandomMultiplier),
    attackMax: ceil(attackRaw * attackMaxMultiplier),
    experienceMin: ceil(experienceRaw * dungeonPayload.rules.minimumRandomMultiplier),
    experienceMax: ceil(experienceRaw * dungeonPayload.rules.maximumRandomMultiplier),
    btc: ceil(btcBase * type.modifier.btc * prefixModifier.btc),
  };
}

function prefixesForTable(dungeonType: DungeonType): readonly DungeonPrefixId[] {
  return dungeonType === 'normal'
    ? dungeonPayload.prefixes
    : dungeonPayload.summaryPrefixes;
}

export function calculateEnemyTable(
  level: number,
  dungeonType: DungeonType,
): DungeonEnemyTable {
  const prefixes = prefixesForTable(dungeonType);
  return {
    small: prefixes.map((prefix) => calculateEnemy(level, dungeonType, 'small', prefix)),
    boss: prefixes.map((prefix) => calculateEnemy(level, dungeonType, 'boss', prefix)),
  };
}

export function findPossibleRoomLevels(enemyLevel: number): readonly number[] {
  if (!Number.isSafeInteger(enemyLevel) || enemyLevel < DUNGEON_LEVEL_MIN) return [];

  const result: number[] = [];
  for (
    let roomLevel = Math.max(0, enemyLevel - dungeonPayload.rules.safetyRoomEnemyOffset);
    roomLevel < enemyLevel;
    roomLevel += 1
  ) {
    if (!dungeonPayload.roomOffsets.includes(roomLevel % 10 as (typeof dungeonPayload.roomOffsets)[number])) {
      continue;
    }
    if (
      enemyLevel >= roomLevel + 1 &&
      enemyLevel <= roomLevel + dungeonPayload.rules.safetyRoomEnemyOffset
    ) {
      result.push(roomLevel);
    }
  }

  return result;
}

function worstEnemyDamage(level: number, dungeonType: DungeonType): number {
  const prefixes: readonly DungeonPrefixId[] = ['crit', 'mad'];
  const highLevelTier = dungeonPayload.enemyTypeModifiers.invasion.tiers.find(
    (tier) => tier.id === 'level500',
  );
  const usesBossForInvasion = highLevelTier !== undefined &&
    level >= highLevelTier.levelRange.min;
  const kind: DungeonEnemyKind = dungeonType === 'normal' || usesBossForInvasion
    ? 'boss'
    : 'small';

  return Math.max(...prefixes.map((prefix) =>
    calculateEnemy(level, dungeonType, kind, prefix).attackMax,
  ));
}

export function calculateMaxSafeEnemyLevel(
  dungeonType: DungeonType,
  playerEffectiveHealth: number,
  damageReductionPercent: number,
): number {
  let highestSafe = 0;
  const damageMultiplier = 1 - damageReductionPercent / 100;

  for (let level = DUNGEON_LEVEL_MIN; level <= DUNGEON_LEVEL_MAX; level += 1) {
    if (playerEffectiveHealth > worstEnemyDamage(level, dungeonType) * damageMultiplier) {
      highestSafe = level;
    }
  }

  return highestSafe;
}

export function calculateMaxSafeRoomLevel(maxSafeEnemyLevel: number): number {
  let candidate = maxSafeEnemyLevel - dungeonPayload.rules.safetyRoomEnemyOffset;

  while (
    candidate > 0 &&
    !dungeonPayload.roomOffsets.includes(candidate % 10 as (typeof dungeonPayload.roomOffsets)[number])
  ) {
    candidate -= 1;
  }

  return Math.max(0, candidate);
}

function average(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function averageEnemyExperience(enemies: readonly DungeonEnemyStats[]): number {
  return ceil(average(enemies.map(
    (enemy) => enemy.experienceMin / dungeonPayload.rules.minimumRandomMultiplier,
  )));
}

function averageEnemyClicks(
  enemies: readonly DungeonEnemyStats[],
  destructiveWeaponCriticalDamage: number,
): number {
  if (destructiveWeaponCriticalDamage <= 0) return 0;

  const averageDefense = average(enemies.map((enemy) => enemy.hp + enemy.shield));
  return ceil(averageDefense / (
    destructiveWeaponCriticalDamage * dungeonPayload.rules.destructiveWeaponEffectiveMultiplier
  ));
}

function critProbabilityForRoom(
  roomLevel: number,
  dungeonType: DungeonType,
  playerEffectiveHealth: number,
  damageReductionPercent: number,
): number {
  const damageMultiplier = 1 - damageReductionPercent / 100;
  const probabilities = Array.from(
    { length: dungeonPayload.rules.safetyRoomEnemyOffset },
    (_, index) => index + 1,
  ).map((offset) => {
    const enemy = calculateEnemy(roomLevel + offset, dungeonType, 'small', 'crit');
    const minimum = enemy.attackMin * damageMultiplier;
    const maximum = enemy.attackMax * damageMultiplier;
    const denominator = maximum - minimum * dungeonPayload.rules.critMaximumMultiplier;

    if (denominator <= 0) return 0;

    return dungeonPayload.rules.critProbabilityFactor *
      Math.max(maximum - playerEffectiveHealth, 0) /
      denominator;
  });

  return Math.min(1, average(probabilities));
}

export function calculateCritDeathProbabilities(
  roomLevels: readonly number[],
  dungeonType: DungeonType,
  playerEffectiveHealth: number,
  damageReductionPercent: number,
): readonly DungeonRoomCritProbability[] {
  return roomLevels.map((roomLevel) => ({
    roomLevel,
    probabilityPercent: Math.min(
      100,
      critProbabilityForRoom(
        roomLevel,
        dungeonType,
        playerEffectiveHealth,
        damageReductionPercent,
      ) * 100,
    ),
  }));
}

export function calculateDungeon(
  input: DungeonCalculationInput,
): DungeonCalculation | null {
  if (!isValidDungeonInput(input)) return null;

  const roomLevels = findPossibleRoomLevels(input.enemyLevel);
  const enemies = calculateEnemyTable(input.enemyLevel, input.dungeonType);
  const playerEffectiveHealth = input.playerMaxHealth + input.playerShield;
  const maxSafeEnemyLevel = calculateMaxSafeEnemyLevel(
    input.dungeonType,
    playerEffectiveHealth,
    input.damageReductionPercent,
  );
  const maxSafeRoomLevel = calculateMaxSafeRoomLevel(maxSafeEnemyLevel);
  const smallEnemies = enemies.small.filter((enemy) => enemy.prefix !== 'x');
  const bossEnemies = enemies.boss.filter((enemy) => enemy.prefix !== 'x');
  const smallEnemyAverageExperience = averageEnemyExperience(smallEnemies);
  const bossAverageExperience = averageEnemyExperience(bossEnemies);
  const smallEnemyAverageClicks = averageEnemyClicks(
    smallEnemies,
    input.destructiveWeaponCriticalDamage,
  );
  const bossAverageClicks = averageEnemyClicks(
    bossEnemies,
    input.destructiveWeaponCriticalDamage,
  );

  return {
    input,
    roomLevels,
    enemies,
    summary: {
      roomLevels,
      maxSafeEnemyLevel,
      maxSafeRoomLevel,
      smallEnemyAverageExperience,
      smallEnemyAverageClicks,
      smallEnemyExperiencePerClick: smallEnemyAverageClicks === 0
        ? 0
        : smallEnemyAverageExperience / smallEnemyAverageClicks,
      bossAverageExperience,
      bossAverageClicks,
      bossExperiencePerClick: bossAverageClicks === 0
        ? 0
        : bossAverageExperience / bossAverageClicks,
      critDeathProbabilities: calculateCritDeathProbabilities(
        roomLevels,
        input.dungeonType,
        playerEffectiveHealth,
        input.damageReductionPercent,
      ),
      playerEffectiveHealth,
    },
  };
}
