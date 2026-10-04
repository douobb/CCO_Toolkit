import { describe, expect, it } from 'vitest';

import { isToolPagePath } from './tool-player-settings-link';

describe('工具頁玩家設定快速入口', () => {
	it('辨識工具總覽與已註冊的工具頁路徑', () => {
		expect(isToolPagePath('/zh-tw/tools')).toBe(true);
		expect(isToolPagePath('/en/tools/')).toBe(true);
		expect(isToolPagePath('/zh-tw/tools/search-reward')).toBe(true);
		expect(isToolPagePath('/en/tools/loot-box-analysis/')).toBe(true);
		expect(isToolPagePath('/zh-tw/guides/getting-started')).toBe(false);
		expect(isToolPagePath('/zh-tw/guides/tools')).toBe(false);
		expect(isToolPagePath('/zh-tw/tools/unknown')).toBe(false);
	});
});
