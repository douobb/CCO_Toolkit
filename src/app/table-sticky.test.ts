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

describe('global sticky table styles', () => {
  it('gives Markdown columns readable minimum widths without changing custom tool tables', () => {
    expect(getDeclarations('table[data-markdown-table]').get('table-layout')).toBe('auto');
    expect(getDeclarations('table[data-markdown-table] tr > :is(th, td)').get('min-width')).toBe('8rem');
    expect(getDeclarations('table[data-markdown-table] tr > :is(th, td)').get('white-space')).toBe('normal');
    expect(getDeclarations('table[data-markdown-table]:has(tr > :nth-child(6)) tr > :is(th, td):last-child').get('min-width')).toBe('20rem');
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
