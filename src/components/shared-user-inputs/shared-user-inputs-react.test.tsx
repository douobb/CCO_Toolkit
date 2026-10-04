import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { createSharedUserInputsStore, defaultSharedUserInputs } from '@/lib/storage';
import {
  getSharedUserInputsServerSnapshot,
  SharedUserInputsProvider,
  useSharedUserInputs,
} from './shared-user-inputs-react';
import { SharedUserInputsManager } from './shared-user-inputs-manager';
import { getMessages } from '@/lib/translations';

function SnapshotProbe() {
  const snapshot = useSharedUserInputs();
  return <output>{snapshot.progression.player.level}</output>;
}

describe('Shared User Inputs React adapter', () => {
  it('uses one stable SSR snapshot even when the injected client store has newer data', () => {
    const store = createSharedUserInputsStore({ storage: null });
    store.update((current) => ({ ...current, progression: { ...current.progression, player: { level: 200 } } }));

    const markup = renderToStaticMarkup(<SharedUserInputsProvider store={store}><SnapshotProbe /></SharedUserInputsProvider>);
    expect(markup).toBe('<output>1</output>');
    expect(getSharedUserInputsServerSnapshot()).toBe(defaultSharedUserInputs);
    expect(getSharedUserInputsServerSnapshot()).toBe(getSharedUserInputsServerSnapshot());
    store.dispose();
  });

  it('exposes the same store subscription source to independent consumers', () => {
    const store = createSharedUserInputsStore({ storage: null });
    const snapshots: number[] = [];
    const first = store.subscribe(() => snapshots.push(store.getSnapshot().progression.player.level));
    const second = store.subscribe(() => snapshots.push(store.getSnapshot().progression.player.level));
    store.update((current) => ({ ...current, progression: { ...current.progression, player: { level: 300 } } }));
    expect(snapshots).toEqual([300, 300]);
    first(); second(); store.dispose();
  });

  it('renders localized fixed catalog fields without a browser-only note and keeps reset guidance', () => {
    for (const locale of ['zh-tw', 'zh-cn', 'en'] as const) {
      const hiddenRangeHints = {
        'zh-tw': ['0 以上（整數）', '0 以上（可輸入小數）', '1 以上（整數）', '20–220%（整數）'],
        'zh-cn': ['0 以上（整数）', '0 以上（可输入小数）', '1 以上（整数）', '20–220%（整数）'],
        en: ['0 or more (integers)', '0 or more (decimals allowed)', '1 or more (integers)', '20–220% (integers)'],
      } satisfies Record<typeof locale, readonly string[]>;
      const store = createSharedUserInputsStore({ storage: null });
      const labels = getMessages(locale).settingsPage;
      const markup = renderToStaticMarkup(<SharedUserInputsProvider store={store}><SharedUserInputsManager labels={labels} locale={locale} /></SharedUserInputsProvider>);
      expect(markup).not.toContain('role="note"');
      for (const key of [
        'browserOnlyTitle',
        'browserOnlyDescription',
        'progressionDescription',
        'equipmentDescription',
        'economyDescription',
        'marketPricesDescription',
      ]) {
        expect(labels).not.toHaveProperty(key);
      }
      expect(markup).toContain(labels.progressionTitle.replaceAll('&', '&amp;'));
      expect(markup).toContain(labels.equipmentTitle.replaceAll('&', '&amp;'));
      expect(markup).toContain(labels.economyTitle.replaceAll('&', '&amp;'));
      expect(markup).not.toContain('shared-effect-btc-buff-percent');
      expect(markup).toContain(labels.resetDescription);
      expect(markup).toContain(labels.restorePrices);
      expect(markup).toContain(labels.marketPriceDisplayCurrency);
      expect(markup).toContain('data-testid="shared-market-price-currency-toggle"');
      expect(markup).toContain('aria-pressed="true"');
      expect(markup).toContain('aria-pressed="false"');
      expect(markup).toContain('id="shared-level-level"');
      expect(markup).toContain('id="shared-level-printing-rank"');
      expect(markup).toContain('id="shared-level-level-range"');
      expect(markup).toContain('id="shared-level-level-unit"');
      expect(markup).toContain('id="shared-price-medical-tech-parts-unit"');
      expect(markup).toContain('id="shared-equipment-max-health"');
      expect(markup).toContain('id="shared-equipment-critical-damage-percent-unit"');
      expect(markup).toContain(labels.criticalDamagePercent);
      expect(markup).toMatch(/min="1"[^>]*id="shared-equipment-destructive-weapon-damage"/);
      expect(markup).toMatch(/min="20"[^>]*max="220"[^>]*id="shared-equipment-critical-damage-percent"/);
      expect(markup).toMatch(/type="number"[^>]*id="shared-equipment-bargain-percent"/);
      expect(markup).toContain('value="20"');
      expect(markup).toContain('max="40"');
      expect(markup).toContain('max="220"');
      expect(markup).toContain('max="1"');
      for (const hint of hiddenRangeHints[locale]) expect(markup).not.toContain(hint);
      expect(markup).toMatch(/step="1"[^>]*id="shared-equipment-max-health"/);
      expect(markup).toMatch(/step="any"[^>]*id="shared-price-tech-scrap"/);
      expect(markup).toMatch(/min="1"[^>]*step="1"[^>]*id="shared-exchange-btc-per-ai"/);
      expect(markup).not.toContain('type="checkbox"');
      expect(markup).not.toContain('shared-effect-btc-buff-percent-enabled');
      expect(markup).not.toContain(
        locale === 'zh-tw'
          ? '；資料目錄預設值為'
          : locale === 'zh-cn'
            ? '；数据目录默认值为'
            : '; catalog default:',
      );
      expect(markup).not.toContain('技能 ID');
      expect(markup).not.toContain('Item ID');
      store.dispose();
    }
  });
});
