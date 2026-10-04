import { searchRewardDataSet } from '@/data/game/search-rewards';

import type { SearchRewardEntry } from './search-reward-calculator';

export * from './search-reward-calculator';

export const defaultSearchRewards: readonly SearchRewardEntry[] = searchRewardDataSet.payload;
