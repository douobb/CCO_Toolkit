import { describe, expect, it } from 'vitest';

import {
  calculateCritDeathProbabilities,
  calculateDungeon,
  calculateEnemy,
  calculateMaxSafeEnemyLevel,
  deriveDestructiveWeaponCriticalDamage,
  findPossibleRoomLevels,
  type DungeonCalculationInput,
} from './dungeon-calculator';

const lv400InvasionInput: DungeonCalculationInput = {
  enemyLevel: 400,
  dungeonType: 'invasion',
  playerMaxHealth: 803125,
  playerShield: 42577,
  damageReductionPercent: 0,
  destructiveWeaponCriticalDamage: 1600000,
};

describe('dungeon calculator', () => {
  it('matches the Lv.400 invasion golden values', () => {
    const result = calculateDungeon(lv400InvasionInput);

    expect(result).not.toBeNull();
    expect(result?.roomLevels).toEqual([397]);
    expect(result?.summary).toMatchObject({
      maxSafeEnemyLevel: 323,
      maxSafeRoomLevel: 317,
      smallEnemyAverageExperience: 226194,
      smallEnemyAverageClicks: 2,
      smallEnemyExperiencePerClick: 113097,
      bossAverageExperience: 7539772,
      bossAverageClicks: 32,
      bossExperiencePerClick: 235617.875,
      playerEffectiveHealth: 845702,
    });
    expect(result?.summary.critDeathProbabilities).toEqual([
      { roomLevel: 397, probabilityPercent: 100 },
    ]);

    expect(result?.enemies.small).toEqual([
      { prefix: 'angry', hp: 1800135, shield: 0, attackMin: 902926, attackMax: 1097767, experienceMin: 167132, experienceMax: 184725, btc: 618 },
      { prefix: 'tough', hp: 2232168, shield: 0, attackMin: 805641, attackMax: 979489, experienceMin: 194987, experienceMax: 215512, btc: 721 },
      { prefix: 'shielded', hp: 1440108, shield: 640128, attackMin: 760038, attackMax: 924047, experienceMin: 236770, experienceMax: 261693, btc: 876 },
      { prefix: 'agile', hp: 1800135, shield: 320064, attackMin: 760038, attackMax: 924047, experienceMin: 236770, experienceMax: 261693, btc: 876 },
      { prefix: 'mad', hp: 1800135, shield: 0, attackMin: 936367, attackMax: 1138425, experienceMin: 181060, experienceMax: 200119, btc: 670 },
      { prefix: 'crit', hp: 1800135, shield: 320064, attackMin: 760038, attackMax: 1293665, experienceMin: 236770, experienceMax: 261693, btc: 876 },
      { prefix: 'berserker', hp: 2088157, shield: 960192, attackMin: 836042, attackMax: 1016451, experienceMin: 250698, experienceMax: 277087, btc: 876 },
    ]);
    expect(result?.enemies.boss[5]).toMatchObject({
      prefix: 'crit',
      hp: 35282646,
      shield: 320064,
      attackMin: 684035,
      attackMax: 1164299,
      experienceMin: 7892325,
      experienceMax: 8723096,
      btc: 13131,
    });
  });

  it('uses the invasion modifier boundaries at levels 103 and 503', () => {
    expect(calculateEnemy(103, 'invasion', 'small', 'x').hp)
      .toBeGreaterThan(calculateEnemy(102, 'invasion', 'small', 'x').hp);
    expect(calculateEnemy(503, 'invasion', 'small', 'x').hp)
      .toBeGreaterThan(calculateEnemy(502, 'invasion', 'small', 'x').hp);
  });

  it('returns single and overlapping room candidates', () => {
    expect(findPossibleRoomLevels(400)).toEqual([397]);
    expect(findPossibleRoomLevels(399)).toEqual([394, 397]);
  });

  it('keeps Crit death probability separate for overlapping rooms', () => {
    const input: DungeonCalculationInput = {
      enemyLevel: 399,
      dungeonType: 'invasion',
      playerMaxHealth: 1165000,
      playerShield: 0,
      damageReductionPercent: 10,
      destructiveWeaponCriticalDamage: 1000000,
    };
    const result = calculateDungeon(input);
    const expected = calculateCritDeathProbabilities(
      [394, 397],
      input.dungeonType,
      input.playerMaxHealth + input.playerShield,
      input.damageReductionPercent,
    );

    expect(result?.roomLevels).toEqual([394, 397]);
    expect(result?.summary.critDeathProbabilities).toEqual(expected);
    expect(expected[0]?.probabilityPercent).not.toBe(expected[1]?.probabilityPercent);
  });

  it('treats equality with the worst effective damage as unsafe', () => {
    const level = 323;
    const crit = calculateEnemy(level, 'invasion', 'small', 'crit').attackMax;
    const mad = calculateEnemy(level, 'invasion', 'small', 'mad').attackMax;
    const worstDamage = Math.max(crit, mad);

    expect(calculateMaxSafeEnemyLevel('invasion', worstDamage, 0)).toBe(level - 1);
  });

  it('derives actual destructive-weapon critical damage without storing a derived value', () => {
    expect(deriveDestructiveWeaponCriticalDamage(800000, 200)).toBe(1600000);
    expect(deriveDestructiveWeaponCriticalDamage(0, 200)).toBeNull();
    expect(deriveDestructiveWeaponCriticalDamage(800000, 19)).toBeNull();
    expect(deriveDestructiveWeaponCriticalDamage(800000, 221)).toBeNull();
  });

  it('rejects invalid input', () => {
    expect(calculateDungeon({
      ...lv400InvasionInput,
      enemyLevel: 0,
    })).toBeNull();
    expect(calculateDungeon({
      ...lv400InvasionInput,
      damageReductionPercent: 10.5,
    })).toBeNull();
    expect(calculateDungeon({
      ...lv400InvasionInput,
      destructiveWeaponCriticalDamage: 0,
    })).toBeNull();
  });
});
