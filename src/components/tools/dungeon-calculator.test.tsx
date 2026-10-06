// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/context', () => ({
  ContextualDocsPage: ({
    contextItems = [],
    children,
  }: {
    contextItems?: readonly {
      id: string;
      kind: string;
      content: ReactNode;
      mobile?: { content?: ReactNode };
    }[];
    children: ReactNode;
  }) => {
    const items = [{ id: 'toc', kind: 'toc', content: null }, ...contextItems];
    return (
      <div data-context-ids={items.map((item) => item.id).join(' ')}>
        {items.map((item) => (
          <div key={item.id} data-context-id={item.id} data-context-kind={item.kind}>
            {item.content}
          </div>
        ))}
        {children}
      </div>
    );
  },
  ContextMobileItems: ({
    items,
    placement,
  }: {
    items?: readonly { id: string; mobile?: { content?: ReactNode } }[];
    placement?: string;
  }) => (
    <div data-context-mobile="" data-context-mobile-placement={placement ?? 'flow'}>
      {items?.map((item) => (
        <div key={item.id} data-context-mobile-id={item.id}>
          {item.mobile?.content}
        </div>
      ))}
    </div>
  ),
}));

import { SharedUserInputsProvider } from '@/components/shared-user-inputs';
import {
  createSharedUserInputsStore,
  defaultSharedUserInputs,
  loadToolState,
  saveToolState,
} from '@/lib/storage';
import { DUNGEON_DEFAULT_LEVEL } from '@/lib/dungeon-calculator';
import { getMessages } from '@/lib/translations';
import { createNumberFormatter } from '@/lib/number-formatting';

import {
  calculateDungeonTool,
  CritProbabilityList,
  DungeonCalculator,
  DungeonToolProvider,
  DungeonToolPage,
  normalizeDungeonToolState,
  parseDungeonValues,
  selectDungeonSharedValues,
} from './dungeon-calculator';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

interface MountedDungeon {
  readonly container: HTMLDivElement;
  readonly root: Root;
  readonly store: ReturnType<typeof createSharedUserInputsStore>;
}

const mountedDungeons: MountedDungeon[] = [];

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

async function mountInteractiveDungeon(): Promise<MountedDungeon> {
  const container = document.createElement('div');
  document.body.append(container);
  const store = createSharedUserInputsStore({ storage: null });
  const root = createRoot(container);
  const mounted = { container, root, store };
  mountedDungeons.push(mounted);

  await act(async () => {
    root.render(
      <SharedUserInputsProvider store={store}>
        <DungeonToolPage
          toc={[]}
          contextLabel="本頁內容"
          contextPanelLabel="工具頁面板"
          contextCloseLabel="關閉面板"
          header={<h1>地城評估</h1>}
        >
          <DungeonCalculator
            labels={getMessages('zh-tw').tools.dungeon}
            locale="zh-tw"
          />
        </DungeonToolPage>
      </SharedUserInputsProvider>,
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return mounted;
}

function getBreakdownValue(container: HTMLElement, label: string): string | undefined {
  const term = [...container.querySelectorAll('dt')]
    .find((candidate) => candidate.textContent === label);
  return term?.nextElementSibling?.textContent?.trim();
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('找不到 input value setter');
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

afterEach(async () => {
  for (const mounted of mountedDungeons.splice(0)) {
    await act(async () => mounted.root.unmount());
    mounted.container.remove();
    mounted.store.dispose();
  }
  window.localStorage.clear();
  document.body.replaceChildren();
});

describe('Dungeon calculator presentation', () => {
  it('呈現地城情境輸入、中央統一重設與摘要結果區域', () => {
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
    expect(markup).toContain('id="dungeon-damage-reduction-percent"');
    expect(markup.match(/>共用<\/span>/g)).toHaveLength(5);
    expect(markup).toMatch(/for="dungeon-max-health">[\s\S]*?最大血量[\s\S]*?共用/);
    expect(markup).toMatch(/id="dungeon-max-health-range"[^>]*>0 以上<\/span>/);
    expect(markup).toMatch(/id="dungeon-max-health-unit"[^>]*>HP<\/span>/);
    expect(markup).toMatch(/for="dungeon-shield">[\s\S]*?護盾[\s\S]*?共用/);
    expect(markup).toMatch(/id="dungeon-shield-unit"[^>]*>護盾<\/span>/);
    expect(markup).toMatch(/for="dungeon-destructive-weapon-damage">[\s\S]*?破壞性武器傷害[\s\S]*?共用/);
    expect(markup).toMatch(/id="dungeon-destructive-weapon-damage-range"[^>]*>大於 0<\/span>/);
    expect(markup).toMatch(/id="dungeon-destructive-weapon-damage-unit"[^>]*>傷害<\/span>/);
    expect(markup).toMatch(/for="dungeon-critical-damage-percent">[\s\S]*?爆擊傷害[\s\S]*?共用/);
    expect(markup).toMatch(/id="dungeon-critical-damage-percent-range"[^>]*>20–220<\/span>/);
    expect(markup).toMatch(/id="dungeon-critical-damage-percent-unit"[^>]*>%<\/span>/);
    expect(markup).toMatch(/for="dungeon-damage-reduction-percent">[\s\S]*?傷害減免[\s\S]*?共用/);
    expect(markup).toMatch(/id="dungeon-damage-reduction-percent-range"[^>]*>0–100<\/span>/);
    expect(markup).toMatch(/id="dungeon-damage-reduction-percent-unit"[^>]*>%<\/span>/);
    expect(markup).not.toContain('爆擊傷害百分比');
    expect(markup).not.toContain('減傷百分比');
    expect(markup).not.toContain('data-tool-fill-player=""');
    expect(markup).toContain(labels.reset);
    expect(markup).toContain('data-tool-reset=""');
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

  it('保留 TOC，但不建立沒有專屬設定的側欄入口', () => {
    const labels = getMessages('zh-tw').tools.dungeon;
    const store = createSharedUserInputsStore({ storage: null });
    const markup = renderToStaticMarkup(
      <SharedUserInputsProvider store={store}>
        <DungeonToolPage
          toc={[]}
          contextLabel="本頁內容"
          contextPanelLabel="工具頁面板"
          contextCloseLabel="關閉面板"
          header={<h1>地城評估</h1>}
        >
          <DungeonCalculator labels={labels} locale="zh-tw" />
        </DungeonToolPage>
      </SharedUserInputsProvider>,
    );
    store.dispose();

    expect(markup).toContain('data-context-kind="toc"');
    expect(markup).not.toContain('data-context-id="settings"');
    expect(markup).not.toContain('data-context-mobile-id="settings"');
    expect(markup).not.toContain('開啟本工具設定');
  });

  it('載入舊地城狀態時只遷移本地等級與地城類型', () => {
    expect(normalizeDungeonToolState({
      enemyLevel: '275',
      dungeonType: 'invasion',
      maxHealth: '123456',
      shield: '789',
      destructiveWeaponDamage: '999',
      criticalDamagePercent: '200',
      damageReductionPercent: '10',
    })).toEqual({ enemyLevel: '275', dungeonType: 'invasion' });
    expect(normalizeDungeonToolState({ enemyLevel: '275', dungeonType: 'unknown' })).toBeUndefined();
  });

  it('共用裝備更新即時重算但不覆寫情境，重設也保留共用裝備', async () => {
    const legacyValues = {
      enemyLevel: '275',
      dungeonType: 'invasion',
      maxHealth: '123456',
      shield: '789',
      destructiveWeaponDamage: '999',
      criticalDamagePercent: '200',
      damageReductionPercent: '10',
    };
    saveToolState('dungeon', legacyValues);

    const mounted = await mountInteractiveDungeon();
    const labels = getMessages('zh-tw').tools.dungeon;
    const enemyLevel = mounted.container.querySelector<HTMLInputElement>('#dungeon-enemy-level');
    const dungeonType = mounted.container.querySelector<HTMLSelectElement>('#dungeon-type');
    expect(enemyLevel?.value).toBe('275');
    expect(dungeonType?.value).toBe('invasion');

    const sharedEquipmentFields = [
      '#dungeon-max-health',
      '#dungeon-shield',
      '#dungeon-destructive-weapon-damage',
      '#dungeon-critical-damage-percent',
      '#dungeon-damage-reduction-percent',
    ];
    for (const selector of sharedEquipmentFields) {
      expect(mounted.container.querySelector(selector)).not.toBeNull();
    }
    expect(mounted.container.querySelector('[data-context-ids]')?.getAttribute('data-context-ids'))
      .not.toContain('settings');
    expect(mounted.container.querySelector('[data-context-id="toc"]')).not.toBeNull();

    const previousEffectiveHealth = getBreakdownValue(
      mounted.container,
      labels.playerEffectiveHealth,
    );
    await act(async () => {
      expect(mounted.store.update((current) => ({
        ...current,
        equipment: {
          ...current.equipment,
          maxHealth: 880000,
          armor: 45000,
          destructiveWeaponDamage: 700000,
          criticalDamagePercent: 200,
          damageReductionPercent: 35,
        },
      }))).toBe(true);
    });

    const updatedEffectiveHealth = getBreakdownValue(
      mounted.container,
      labels.playerEffectiveHealth,
    );
    expect(updatedEffectiveHealth).not.toBe(previousEffectiveHealth);
    expect(mounted.container.querySelector<HTMLInputElement>('#dungeon-max-health')?.value)
      .toBe('880000');
    expect(enemyLevel?.value).toBe('275');
    expect(dungeonType?.value).toBe('invasion');
    expect(loadToolState('dungeon')).toEqual({
      enemyLevel: '275',
      dungeonType: 'invasion',
    });

    await act(async () => {
      setInputValue(
        mounted.container.querySelector<HTMLInputElement>('#dungeon-max-health')!,
        '990000',
      );
      await Promise.resolve();
    });
    expect(mounted.store.getSnapshot().equipment.maxHealth).toBe(990000);
    expect(enemyLevel?.value).toBe('275');
    expect(dungeonType?.value).toBe('invasion');

    const armorBeforeInvalid = mounted.store.getSnapshot().equipment.armor;
    await act(async () => {
      setInputValue(
        mounted.container.querySelector<HTMLInputElement>('#dungeon-shield')!,
        '-1',
      );
      await Promise.resolve();
    });
    expect(mounted.store.getSnapshot().equipment.armor).toBe(armorBeforeInvalid);
    expect(mounted.container.querySelector<HTMLInputElement>('#dungeon-shield')?.getAttribute('aria-invalid'))
      .toBe('true');
    const effectiveHealthAfterDirectEdit = getBreakdownValue(
      mounted.container,
      labels.playerEffectiveHealth,
    );
    expect(effectiveHealthAfterDirectEdit).not.toBe(updatedEffectiveHealth);

    const sharedEquipmentBeforeReset = mounted.store.getSnapshot().equipment;
    await act(async () => {
      mounted.container.querySelector<HTMLButtonElement>('[data-tool-reset=""]')?.click();
    });

    expect(enemyLevel?.value).toBe(String(DUNGEON_DEFAULT_LEVEL));
    expect(dungeonType?.value).toBe('normal');
    expect(mounted.store.getSnapshot().equipment).toEqual(sharedEquipmentBeforeReset);
    expect(getBreakdownValue(mounted.container, labels.playerEffectiveHealth))
      .toBe(effectiveHealthAfterDirectEdit);
  });

  it('保留情境文案，不宣告側欄設定或帶入玩家操作', () => {
    const labels = getMessages('zh-tw').tools.dungeon;
    for (const key of [
      'settingsTab',
      'settingsTitle',
      'openSettings',
      'closeSettings',
      'fillPlayer',
    ]) {
      expect(labels).not.toHaveProperty(key);
    }
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

    expect(selectDungeonSharedValues(snapshot.equipment)).toEqual({
      maxHealth: '803125',
      shield: '42577',
      destructiveWeaponDamage: '800000',
      criticalDamagePercent: '200',
      damageReductionPercent: '10',
    });

    expect(selectDungeonSharedValues(defaultSharedUserInputs.equipment).criticalDamagePercent).toBe('20');
    expect(selectDungeonSharedValues(defaultSharedUserInputs.equipment).destructiveWeaponDamage).toBe('1');
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
