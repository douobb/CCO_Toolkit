import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { SharedUserInputsProvider } from '@/components/shared-user-inputs';
import { defaultSharedUserInputs, createSharedUserInputsStore } from '@/lib/storage';
import { getMessages } from '@/lib/translations';
import { createNumberFormatter } from '@/lib/number-formatting';

import {
  calculateDungeonTool,
  CritProbabilityList,
  DungeonCalculator,
  DungeonSettingsPanel,
  DungeonToolProvider,
  parseDungeonValues,
  selectDungeonSharedValues,
} from './dungeon-calculator';

function renderDungeon(children: ReactNode) {
  const store = createSharedUserInputsStore({ storage: null });
  const markup = renderToStaticMarkup(
    <SharedUserInputsProvider store={store}>
      <DungeonToolProvider>{children}</DungeonToolProvider>
    </SharedUserInputsProvider>,
  );
  store.dispose();
  return markup;
}

describe('Dungeon calculator presentation', () => {
  it('呈現地城輸入、共用設定帶入與摘要結果區域', () => {
    const labels = getMessages('zh-tw').tools.dungeon;
    const markup = renderDungeon(
      <DungeonCalculator labels={labels} locale="zh-tw" />,
    );

    expect(markup).toContain('data-tool="dungeon"');
    expect(markup).toContain('主要輸入');
    expect(markup).toContain('id="dungeon-enemy-level"');
    expect(markup).toContain('id="dungeon-type"');
    expect(markup).toContain('id="dungeon-max-health"');
    expect(markup).toContain('id="dungeon-shield"');
    expect(markup).toContain('id="dungeon-destructive-weapon-damage"');
    expect(markup).toContain('id="dungeon-critical-damage-percent"');
    expect(markup).toContain('value="1"');
    expect(markup).toContain('value="20"');
    expect(markup).toContain('從共用設定填入');
    expect(markup).toContain('@min-[24rem]:grid-cols-2');
    expect(markup).toContain('攻擊範圍');
    expect(markup).toContain('經驗範圍');
    expect(markup).toContain(' - ');
    expect(markup).not.toContain('攻擊下限');
    expect(markup).not.toContain('攻擊上限');
    expect(markup).not.toContain('經驗下限');
    expect(markup).not.toContain('經驗上限');
    expect(markup).not.toContain('CCO Found');
  });

  it('以響應式雙欄列式配對安全、經驗與爆擊摘要', () => {
    const labels = getMessages('zh-tw').tools.dungeon;
    const markup = renderDungeon(
      <DungeonCalculator labels={labels} locale="zh-tw" />,
    );

    const safetyTitleIndex = markup.indexOf('id="dungeon-safety-breakdown-title"');
    const experienceTitleIndex = markup.indexOf('id="dungeon-experience-breakdown-title"');
    const critTitleIndex = markup.indexOf('id="dungeon-crit-probability-title"');
    const safetyMarkup = markup.slice(markup.lastIndexOf('<section', safetyTitleIndex), experienceTitleIndex);
    const experienceMarkup = markup.slice(markup.lastIndexOf('<section', experienceTitleIndex), critTitleIndex);
    const critMarkup = markup.slice(markup.lastIndexOf('<section', critTitleIndex));

    expect(safetyMarkup).toContain('data-breakdown-layout="rows"');
    expect(safetyMarkup).toContain('@container');
    expect(safetyMarkup).toContain('@min-[40rem]:grid-cols-2');
    expect(safetyMarkup).toContain('@min-[40rem]:col-span-2');
    expect(safetyMarkup).toContain(labels.roomLevels);

    const safetyLabels = [
      labels.roomLevels,
      labels.maxSafeEnemyLevel,
      labels.maxSafeRoomLevel,
      labels.playerEffectiveHealth,
      labels.actualCriticalDamage,
    ];
    const safetyPositions = safetyLabels.map((label) => safetyMarkup.indexOf(label));
    expect(safetyPositions.every((position, index) =>
      position >= 0 && (index === 0 || position > safetyPositions[index - 1]),
    )).toBe(true);

    expect(experienceMarkup).toContain('data-breakdown-layout="rows"');
    expect(experienceMarkup).toContain('@container');
    expect(experienceMarkup).toContain('@min-[40rem]:grid-cols-2');

    const experienceLabels = [
      labels.smallAverageExperience,
      labels.bossAverageExperience,
      labels.smallAverageClicks,
      labels.bossAverageClicks,
      labels.smallExperiencePerClick,
      labels.bossExperiencePerClick,
    ];
    const experiencePositions = experienceLabels.map((label) => experienceMarkup.indexOf(label));
    expect(experiencePositions.every((position, index) =>
      position >= 0 && (index === 0 || position > experiencePositions[index - 1]),
    )).toBe(true);

  });

  it('依爆擊死亡率結果數量維持單列或套用響應式雙欄', () => {
    const labels = getMessages('zh-tw').tools.dungeon;
    const baseResult = calculateDungeonTool({
      enemyLevel: '400',
      dungeonType: 'normal',
      maxHealth: '1',
      shield: '0',
      destructiveWeaponDamage: '100',
      criticalDamagePercent: '200',
      damageReductionPercent: '0',
    }).result;

    if (!baseResult) throw new Error('測試需要有效的地城計算結果。');

    const formatNumber = createNumberFormatter('zh-tw');
    const oneMarkup = renderToStaticMarkup(
      <CritProbabilityList
        labels={labels}
        result={baseResult}
        formatNumber={formatNumber}
      />,
    );
    const zeroMarkup = renderToStaticMarkup(
      <CritProbabilityList
        labels={labels}
        result={{
          ...baseResult,
          summary: { ...baseResult.summary, critDeathProbabilities: [] },
        }}
        formatNumber={formatNumber}
      />,
    );
    const firstProbability = baseResult.summary.critDeathProbabilities[0] ?? {
      roomLevel: 0,
      probabilityPercent: 0,
    };
    const twoMarkup = renderToStaticMarkup(
      <CritProbabilityList
        labels={labels}
        result={{
          ...baseResult,
          summary: {
            ...baseResult.summary,
            critDeathProbabilities: [
              firstProbability,
              { ...firstProbability, roomLevel: firstProbability.roomLevel + 1 },
            ],
          },
        }}
        formatNumber={formatNumber}
      />,
    );

    expect(zeroMarkup).toContain(labels.none);
    expect(oneMarkup).toContain('divide-y divide-border');
    expect(oneMarkup).not.toContain('@min-[40rem]:grid-cols-2');
    expect(twoMarkup).toContain('grid gap-x-6 @min-[40rem]:grid-cols-2');
  });

  it('設定面板提供裝備與戰鬥值，且不建立逐欄位覆寫切換', () => {
    const labels = getMessages('zh-tw').tools.dungeon;
    const markup = renderDungeon(
      <DungeonSettingsPanel labels={labels} idPrefix="test-dungeon-settings" />,
    );

    expect(markup).toContain('id="test-dungeon-settings-damage-reduction-percent"');
    expect(markup).not.toContain('id="test-dungeon-settings-max-health"');
    expect(markup).not.toContain('id="test-dungeon-settings-shield"');
    expect(markup).not.toContain('id="test-dungeon-settings-destructive-weapon-damage"');
    expect(markup).not.toContain('id="test-dungeon-settings-critical-damage-percent"');
    expect(markup).not.toContain('沿用共用值');
    expect(markup).not.toContain('本工具覆寫');
  });

  it('從 shared equipment 投影語意化的地城欄位', () => {
    const snapshot = {
      ...defaultSharedUserInputs,
      equipment: {
        maxHealth: 803125,
        armor: 42577,
        destructiveWeaponDamage: 800000,
        criticalDamagePercent: 200,
        damageReductionPercent: 10,
      },
    };

    expect(selectDungeonSharedValues(snapshot)).toEqual({
      maxHealth: '803125',
      shield: '42577',
      destructiveWeaponDamage: '800000',
      criticalDamagePercent: '200',
      damageReductionPercent: '10',
    });

    expect(selectDungeonSharedValues(defaultSharedUserInputs).criticalDamagePercent).toBe('20');
    expect(selectDungeonSharedValues(defaultSharedUserInputs).destructiveWeaponDamage).toBe('1');
  });

  it('以破壞性武器傷害與爆擊傷害百分比產生地城純輸入', () => {
    const parsed = parseDungeonValues({
      enemyLevel: '400',
      dungeonType: 'invasion',
      maxHealth: '803125',
      shield: '42577',
      destructiveWeaponDamage: '800000',
      criticalDamagePercent: '200',
      damageReductionPercent: '0',
    });

    expect(parsed.errors).toEqual({});
    expect(parsed.inputs).toMatchObject({
      enemyLevel: 400,
      dungeonType: 'invasion',
      playerMaxHealth: 803125,
      playerShield: 42577,
      damageReductionPercent: 0,
      destructiveWeaponCriticalDamage: 1600000,
    });
    expect(calculateDungeonTool({
      enemyLevel: '400',
      dungeonType: 'invasion',
      maxHealth: '803125',
      shield: '42577',
      destructiveWeaponDamage: '800000',
      criticalDamagePercent: '200',
      damageReductionPercent: '0',
    }).result?.summary.maxSafeEnemyLevel).toBe(323);
  });

  it('拒絕負值、小數、超過上限與未完成爆擊傷害', () => {
    const valid = {
      enemyLevel: '400',
      dungeonType: 'normal',
      maxHealth: '1',
      shield: '0',
      destructiveWeaponDamage: '100',
      criticalDamagePercent: '200',
      damageReductionPercent: '0',
    } as const;

    expect(parseDungeonValues({ ...valid, maxHealth: '-1' }).inputs).toBeNull();
    expect(parseDungeonValues({ ...valid, shield: '1.5' }).inputs).toBeNull();
    expect(parseDungeonValues({ ...valid, criticalDamagePercent: '221' }).inputs).toBeNull();
    expect(parseDungeonValues({ ...valid, criticalDamagePercent: '19' }).inputs).toBeNull();
    expect(parseDungeonValues({ ...valid, destructiveWeaponDamage: '0' }).inputs).toBeNull();
    expect(parseDungeonValues({ ...valid, criticalDamagePercent: '0' }).inputs).toBeNull();
  });
});
