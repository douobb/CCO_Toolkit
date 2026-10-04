import { describe, expect, it } from 'vitest';

import { getHtmlLanguage } from './i18n';
import { createNumberFormatter } from './number-formatting';

describe('locale-aware number formatter', () => {
  it('保留繁中既有數字格式，並依 locale 建立 formatter', () => {
    const options = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

    expect(createNumberFormatter('zh-tw')(1234.5, options)).toBe('1,234.50');
    expect(createNumberFormatter('zh-cn')(1234.5, options)).toBe('1,234.50');
    expect(createNumberFormatter('en')(1234.5, options)).toBe(
      new Intl.NumberFormat(getHtmlLanguage('en'), options).format(1234.5),
    );
  });
});
