import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const globalStyles = readFileSync(new URL('./global.css', import.meta.url), 'utf8');
const stylesheet = postcss.parse(
  readFileSync(new URL('./table-sticky.css', import.meta.url), 'utf8'),
);

const firstCellSelector =
  "table:not([data-sticky-first-column='false']) tr > :is(th, td):first-child:not([colspan]:not([colspan='1']))";
const headerCellSelector =
  "table:not([data-sticky-first-column='false']) thead tr > :is(th, td):first-child:not([colspan]:not([colspan='1']))";
const headerGroupSelector = "table:not([data-sticky-first-column='false']) > thead";
const tableSelector = "table:not([data-sticky-first-column='false'])";
const gameDataVersionTableSelector = '[data-game-data-version-table] > table';
const gameDataVersionCellSelector =
  "[data-game-data-version-table] > table:not([data-sticky-first-column='false']) tr > :is(th, td)";
const gameDataVersionFirstCellSelector =
  `${gameDataVersionCellSelector}:first-child:not([colspan]:not([colspan='1']))`;
const gameDataVersionSourceCellSelector = `${gameDataVersionCellSelector}:nth-child(6)`;
const earningsOverviewTableSelector = "table[data-earnings-overview-table='true']";
const earningsOverviewColumnSelector = (index: number) =>
  `${earningsOverviewTableSelector} > colgroup > col:nth-child(${index})`;
const earningsOverviewCellSelector =
  `${earningsOverviewTableSelector}:not([data-sticky-first-column='false']) tr > :is(th, td)`;
const earningsOverviewFirstCellSelector =
  `${earningsOverviewCellSelector}:first-child:not([colspan]:not([colspan='1']))`;

function normalizeSelector(selector: string) {
  return selector.replace(/\s+/g, ' ').replace(/\s*>\s*/g, ' > ').trim();
}

function getDeclarations(selector: string) {
  const declarations = new Map<string, string>();

  stylesheet.walkRules((rule) => {
    if (normalizeSelector(rule.selector) === normalizeSelector(selector)) {
      rule.walkDecls((declaration) => {
        declarations.set(declaration.prop, declaration.value);
      });
    }
  });

  return declarations;
}

function getMediaDeclarations(media: string, selector: string) {
  const declarations = new Map<string, string>();

  stylesheet.walkAtRules('media', (rule) => {
    if (rule.params !== media) return;
    rule.walkRules((nestedRule) => {
      if (normalizeSelector(nestedRule.selector) !== normalizeSelector(selector)) return;
      nestedRule.walkDecls((declaration) => {
        declarations.set(declaration.prop, declaration.value);
      });
    });
  });

  return declarations;
}

describe('global sticky table styles', () => {
  it('gives Markdown columns readable minimum widths without changing custom tool tables', () => {
    expect(getDeclarations('table[data-markdown-table]').get('table-layout')).toBe('auto');
    expect(getDeclarations('table[data-markdown-table] tr > :is(th, td)').get('min-width')).toBe('8rem');
    expect(getDeclarations('table[data-markdown-table] tr > :is(th, td)').get('white-space')).toBe('normal');
    expect(getDeclarations('table[data-markdown-table]:has(tr > :nth-child(6)) tr > :is(th, td):last-child').get('min-width')).toBe('20rem');
  });

  it('scopes version-table widths and natural wrapping to the six-column Game Data table', () => {
    const tableDeclarations = getDeclarations(gameDataVersionTableSelector);
    const cellDeclarations = getDeclarations(gameDataVersionCellSelector);
    const firstCellDeclarations = getDeclarations(gameDataVersionFirstCellSelector);
    const sourceCellDeclarations = getDeclarations(gameDataVersionSourceCellSelector);

    expect(tableDeclarations.get('width')).toBe('100%');
    expect(tableDeclarations.get('min-width')).toBe('59.75rem');
    expect(tableDeclarations.get('table-layout')).toBe('fixed');
    expect(cellDeclarations.get('white-space')).toBe('nowrap');
    expect(cellDeclarations.get('overflow-wrap')).toBe('normal');
    expect(cellDeclarations.get('word-break')).toBe('normal');
    expect(firstCellDeclarations.get('width')).toBe('9.375rem');
    expect(firstCellDeclarations.get('min-width')).toBe('9.375rem');
    expect(firstCellDeclarations.get('max-width')).toBe('9.375rem');
    expect(firstCellDeclarations.get('white-space')).toBe('normal');
    expect(firstCellDeclarations.get('overflow-wrap')).toBe('normal');
    expect(sourceCellDeclarations.get('white-space')).toBe('normal');
    expect(gameDataVersionFirstCellSelector).toContain('[data-game-data-version-table]');
    expect(gameDataVersionFirstCellSelector).toContain(
      ":not([data-sticky-first-column='false'])",
    );
  });

  it('keeps the 150px dataset column intact under the shared mobile anywhere rule', () => {
    let mobileDeclarations = new Map<string, string>();

    stylesheet.walkAtRules('media', (rule) => {
      if (rule.params === '(max-width: 640px)') {
        rule.walkRules((nestedRule) => {
          if (
            normalizeSelector(nestedRule.selector) ===
            normalizeSelector(gameDataVersionFirstCellSelector)
          ) {
            nestedRule.walkDecls((declaration) => {
              mobileDeclarations.set(declaration.prop, declaration.value);
            });
          }
        });
      }
    });

    expect(mobileDeclarations.get('width')).toBe('9.375rem');
    expect(mobileDeclarations.get('min-width')).toBe('9.375rem');
    expect(mobileDeclarations.get('max-width')).toBe('9.375rem');
    expect(mobileDeclarations.get('white-space')).toBe('normal');
    expect(mobileDeclarations.get('overflow-wrap')).toBe('normal');
    expect(mobileDeclarations.get('word-break')).toBe('normal');
    expect(getDeclarations(firstCellSelector).get('overflow-wrap')).toBe('anywhere');
  });

  it('wraps long data versions without changing the date column or fixed widths', () => {
    const versionCell = getDeclarations(`${gameDataVersionCellSelector}:nth-child(4)`);
    expect(versionCell.get('white-space')).toBe('normal');
    expect(versionCell.get('overflow-wrap')).toBe('anywhere');
    expect(getDeclarations(gameDataVersionCellSelector).get('white-space')).toBe('nowrap');
    expect(getDeclarations(gameDataVersionTableSelector).get('table-layout')).toBe('fixed');
  });

  it('assigns a complete 640px mobile column layout only to the earnings table', () => {
    const mobileColumnWidths = Array.from({ length: 5 }, (_, index) =>
      getMediaDeclarations('(max-width: 639.98px)', earningsOverviewColumnSelector(index + 1))
        .get('width'),
    );
    const mobileFirstCell = getMediaDeclarations(
      '(max-width: 639.98px)',
      earningsOverviewFirstCellSelector,
    );
    const mobileCells = getMediaDeclarations(
      '(max-width: 639.98px)',
      earningsOverviewCellSelector,
    );
    const narrowColumnWidths = Array.from({ length: 5 }, (_, index) =>
      getMediaDeclarations('(max-width: 359.98px)', earningsOverviewColumnSelector(index + 1))
        .get('width')
        ?? getMediaDeclarations('(max-width: 639.98px)', earningsOverviewColumnSelector(index + 1))
          .get('width'),
    );
    const narrowFirstCell = getMediaDeclarations(
      '(max-width: 359.98px)',
      earningsOverviewFirstCellSelector,
    );
    const desktopFirstCell = getMediaDeclarations(
      '(min-width: 640px)',
      earningsOverviewFirstCellSelector,
    );

    expect(mobileColumnWidths).toEqual([
      '140px',
      '100px',
      '105px',
      '135px',
      '160px',
    ]);
    expect([140, 100, 105, 135, 160].reduce((total, width) => total + width, 0)).toBe(640);
    expect(mobileFirstCell.get('width')).toBe('140px');
    expect(mobileFirstCell.get('min-width')).toBe('140px');
    expect(mobileFirstCell.get('max-width')).toBe('140px');
    expect(mobileFirstCell.get('overflow-wrap')).toBe('normal');
    expect(mobileFirstCell.get('word-break')).toBe('normal');
    expect(mobileCells.get('padding-inline')).toBe('12px');
    expect(narrowColumnWidths).toEqual([
      '128px',
      '100px',
      '105px',
      '135px',
      '172px',
    ]);
    expect([128, 100, 105, 135, 172].reduce((total, width) => total + width, 0)).toBe(640);
    expect(narrowFirstCell.get('width')).toBe('128px');
    expect(narrowFirstCell.get('min-width')).toBe('128px');
    expect(narrowFirstCell.get('max-width')).toBe('128px');
    expect(desktopFirstCell.get('min-width')).toBe('unset');
    expect(desktopFirstCell.get('max-width')).toBe('unset');
    expect(desktopFirstCell.get('overflow-wrap')).toBe('normal');
    expect(desktopFirstCell.get('word-break')).toBe('normal');
    for (let index = 1; index <= 5; index += 1) {
      expect(getMediaDeclarations('(min-width: 640px)', earningsOverviewColumnSelector(index))
        .has('width')).toBe(false);
    }

    expect(getDeclarations(firstCellSelector).has('width')).toBe(false);
    expect(getDeclarations(firstCellSelector).has('padding-inline')).toBe(false);
    expect(earningsOverviewFirstCellSelector).toContain('[data-earnings-overview-table=');
  });

  it('loads from the application-wide stylesheet', () => {
    expect(globalStyles).toContain("@import './table-sticky.css';");
  });

  it('leaves scrolling to the existing overflow wrapper instead of the table', () => {
    expect(getDeclarations(tableSelector).get('overflow')).toBe('visible');
  });

  it('pins first cells, retains colspan=1, and excludes multi-column spans', () => {
    const declarations = getDeclarations(firstCellSelector);

    expect(declarations.get('position')).toBe('sticky');
    expect(declarations.get('left')).toBe('0');
    expect(declarations.get('z-index')).toBe('1');
    expect(declarations.get('background-color')).toBe('var(--background, Canvas)');
    expect(declarations.get('box-shadow')).toBe('inset -1px 0 0 var(--border, currentColor)');
    expect(firstCellSelector).toContain(":not([colspan]:not([colspan='1']))");
  });

  it('layers header cells above body cells and constrains only the first cell on phones', () => {
    const headerGroupDeclarations = getDeclarations(headerGroupSelector);

    expect(headerGroupDeclarations.get('z-index')).toBe('3');
    expect(headerGroupDeclarations.has('position')).toBe(false);
    expect(getDeclarations(headerCellSelector).get('z-index')).toBe('2');
    expect(getDeclarations(firstCellSelector).get('z-index')).toBe('1');
    expect(getDeclarations(headerCellSelector).get('background-color')).toBe(
      'var(--card, var(--background, Canvas))',
    );

    let mobileDeclarations = new Map<string, string>();
    stylesheet.walkAtRules('media', (rule) => {
      if (rule.params === '(max-width: 640px)') {
        rule.walkRules((nestedRule) => {
          if (normalizeSelector(nestedRule.selector) === normalizeSelector(firstCellSelector)) {
            nestedRule.walkDecls((declaration) => {
              mobileDeclarations.set(declaration.prop, declaration.value);
            });
          }
        });
      }
    });

    expect(mobileDeclarations.get('min-width')).toBe('min(5rem, 42vw)');
    expect(mobileDeclarations.get('max-width')).toBe('min(42vw, 12rem)');
    expect(mobileDeclarations.get('white-space')).toBe('normal');
    expect(mobileDeclarations.get('overflow-wrap')).toBe('anywhere');
  });
});
