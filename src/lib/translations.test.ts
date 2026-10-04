import { describe, expect, it } from 'vitest';

import { getMessages } from './translations';

describe('Blog 總覽文案', () => {
  it('三語系使用簡短的隨筆說明', () => {
    expect(getMessages('zh-tw').blogPage.description).toBe('一些廢文。');
    expect(getMessages('zh-cn').blogPage.description).toBe('一些废文。');
    expect(getMessages('en').blogPage.description).toBe('Some random ramblings.');
  });
});
