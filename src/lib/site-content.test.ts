import { describe, expect, it } from 'vitest';

import {
  acceptedContributionRecords,
  assertContributorDataConsistency,
  changelogEntries,
  contributorProfiles,
  formatChangelogDate,
  getContributorDataIssues,
  getContributorRecords,
  getContributorProfiles,
  getContributorSummaries,
  getChangelogEntries,
  getChangelogGroups,
  getPublicContributorGroups,
  getContributorTargetSummaries,
  getRecommendations,
  isValidContributorContentPath,
  type AcceptedContributionRecord,
  type ContributorProfile,
} from './site-content';
import { getMessages } from './translations';

const contributorFixture: readonly ContributorProfile[] = [
  {
    id: 'alice',
    name: 'Alice',
    role: 'contributor',
    status: 'active',
    responsibilities: [],
  },
  {
    id: 'blocked-contributor',
    name: 'Blocked contributor',
    role: 'contributor',
    status: 'blocked',
    responsibilities: [],
  },
  {
    id: 'retired-public-contributor',
    name: 'Retired public contributor',
    role: 'contributor',
    status: 'retired',
    publicVisibility: 'public',
    responsibilities: [],
  },
];

const acceptedContributionFixture: readonly AcceptedContributionRecord[] = [
  {
    id: 'alice-translation-1',
    contributorId: 'alice',
    category: 'translation',
    acceptedAt: '2026-08-20',
  },
  {
    id: 'alice-tool-debugging',
    contributorId: 'alice',
    category: 'tool-debugging',
    acceptedAt: '2026-09-02',
    contentPath: 'tools/search-reward',
    summary: '修正搜索收益計算器的邊界條件。',
  },
  {
    id: 'alice-translation-2',
    contributorId: 'alice',
    category: 'translation',
    acceptedAt: '2026-09-05',
    contentPath: 'tools/search-reward',
  },
  {
    id: 'blocked-article-edit',
    contributorId: 'blocked-contributor',
    category: 'article-edit',
    acceptedAt: '2026-09-06',
    contentPath: 'guides/new-player',
  },
  {
    id: 'alice-reverted-tutorial',
    contributorId: 'alice',
    category: 'tutorial',
    acceptedAt: '2026-09-10',
    contentPath: 'tools/search-reward',
    locale: 'zh-tw',
    policyVersion: 'contribution-governance-2026-09-23-draft-1',
    status: 'reverted',
  },
];

describe('網站內容資料', () => {
  it('依日期由新到舊排序更新紀錄', () => {
    const entries = getChangelogEntries();

    expect(entries.map((entry) => entry.date)).toEqual(
      [...entries].sort((a, b) => b.date.localeCompare(a.date)).map((entry) => entry.date),
    );
    expect(entries.map((entry) => entry.date)).toEqual(['2026-10-04', '2026-08-26']);
    expect(entries[0]).toMatchObject({
      date: '2026-10-04',
      title: '網站正式部屬',
      description: 'CCO Toolkit 正式部署至 GitHub Pages。',
    });
    expect(entries[1]).toMatchObject({
      date: '2026-08-26',
      title: '網站開始建立',
      description: '建立 CCO Toolkit 的初始 Foundation，固定網站的內容、語系與部署架構。',
    });
  });

  it('依語系解析更新紀錄，未指定語系時維持繁中預設', () => {
    expect(getChangelogEntries('en')).toMatchObject([
      {
        date: '2026-10-04',
        title: 'CCO Toolkit launched',
        description: 'CCO Toolkit is now live on GitHub Pages.',
      },
      {
        date: '2026-08-26',
        title: 'CCO Toolkit development began',
        description:
          'Built the initial foundation for CCO Toolkit and established its content, localization, and deployment architecture.',
      },
    ]);
    expect(getChangelogEntries('zh-cn')).toMatchObject([
      {
        date: '2026-10-04',
        title: '网站正式上线',
        description: 'CCO Toolkit 已正式部署至 GitHub Pages。',
      },
      {
        date: '2026-08-26',
        title: '网站开始建设',
        description: '搭建 CCO Toolkit 的初始架构，确定网站的内容、语言与部署方式。',
      },
    ]);
  });

  it('依月份分組更新紀錄並保留日期格式', () => {
    const groups = getChangelogGroups('zh-tw');

    const expectedGroups = [
      { key: '2026-10', label: '2026年10月' },
      { key: '2026-08', label: '2026年8月' },
    ];

    expect(groups.map(({ key, label }) => ({ key, label }))).toEqual(expectedGroups);
    expect(groups[0].entries[0]).toMatchObject({
      date: '2026-10-04',
      title: '網站正式部屬',
      description: 'CCO Toolkit 正式部署至 GitHub Pages。',
    });
    expect(groups[1].entries[0]).toMatchObject({
      date: '2026-08-26',
      title: '網站開始建立',
    });
    expect(
      getChangelogGroups('zh-cn').map(({ key, label }) => ({ key, label })),
    ).toEqual(expectedGroups);
    expect(getChangelogGroups('zh-cn')[0].entries[0]).toMatchObject({
      title: '网站正式上线',
      description: 'CCO Toolkit 已正式部署至 GitHub Pages。',
    });
    expect(getChangelogGroups('en')[0].entries[0]).toMatchObject({
      title: 'CCO Toolkit launched',
      description: 'CCO Toolkit is now live on GitHub Pages.',
    });
    expect(formatChangelogDate(changelogEntries[0].date, 'zh-tw')).toBe('2026/10/04');
    expect(formatChangelogDate(changelogEntries[0].date, 'zh-cn')).toBe('2026/10/04');
    expect(formatChangelogDate(changelogEntries[0].date, 'en')).toBe('10/04/2026');
  });

  it('將 douobb 分類為 active owner 並記錄已確認的負責領域', () => {
    expect(getContributorProfiles()).toContainEqual(
      expect.objectContaining({
        id: 'douobb',
        name: 'douobb',
        role: 'owner',
        status: 'active',
        publicVisibility: 'public',
        responsibilities: [
          'site-architecture',
          'tool-development',
          'data-curation',
          'content-maintenance',
        ],
        ownerProfile: {
          avatarUrl: '/images/brand/site-character.webp',
        },
      }),
    );
    expect(acceptedContributionRecords).toEqual([]);
  });

  it('只由已發布 records 推導 contributor 類型、數量與最近日期', () => {
    const summaries = getContributorSummaries(
      contributorFixture,
      acceptedContributionFixture,
    );
    const alice = summaries.find((summary) => summary.profile.id === 'alice');

    expect(alice).toMatchObject({
      categories: ['translation', 'tool-debugging'],
      acceptedCount: 3,
      latestContributionDate: '2026-09-05',
    });
    expect(alice?.profile).not.toHaveProperty('categories');
    expect(alice?.profile).not.toHaveProperty('acceptedCount');
    expect(alice?.profile).not.toHaveProperty('latestContributionDate');
  });

  it('封鎖不刪除採用紀錄；舊資料沿用名單可見性，明確可見性獨立於帳號狀態', () => {
    const groups = getPublicContributorGroups(
      contributorFixture,
      acceptedContributionFixture,
    );
    const allSummaries = getContributorSummaries(
      contributorFixture,
      acceptedContributionFixture,
    );

    expect(groups.communityContributors.map(({ profile }) => profile.id)).toEqual([
      'alice',
      'retired-public-contributor',
    ]);
    expect(allSummaries.find(({ profile }) => profile.id === 'blocked-contributor')).toMatchObject({
      acceptedCount: 1,
    });
    expect(getContributorRecords('alice', acceptedContributionFixture).map(({ id }) => id))
      .not.toContain('alice-reverted-tutorial');
  });

  it('頁面目標統計不計入 reverted records', () => {
    expect(getContributorTargetSummaries(acceptedContributionFixture)).toEqual([
      { contentPath: 'tools/search-reward', count: 2 },
      { contentPath: 'guides/new-player', count: 1 },
    ]);
  });

  it('public／hidden 名單設定與 active／blocked／retired 帳號狀態分開判斷', () => {
    const groups = getPublicContributorGroups(
      [
        {
          id: 'blocked-public',
          name: 'Blocked but public',
          role: 'contributor',
          status: 'blocked',
          publicVisibility: 'public',
          responsibilities: [],
        },
        {
          id: 'active-hidden',
          name: 'Active but hidden',
          role: 'contributor',
          status: 'active',
          publicVisibility: 'hidden',
          responsibilities: [],
        },
      ],
      [],
    );

    expect(groups.communityContributors.map(({ profile }) => profile.id)).toEqual([
      'blocked-public',
    ]);
  });

  it('驗證 profile／record 唯一性、關聯 contributor、日期與內容目標', () => {
    const profiles = [contributorFixture[0], contributorFixture[0]];
    const records: readonly AcceptedContributionRecord[] = [
      {
        id: 'duplicate-record',
        contributorId: 'missing',
        category: 'translation',
        acceptedAt: '2026-02-30',
        contentPath: 'tools/missing',
      },
      {
        id: 'duplicate-record',
        contributorId: 'alice',
        category: 'translation',
        acceptedAt: '2026-09-01',
        contentPath: 'tools/missing',
      },
    ];
    const issues = getContributorDataIssues(profiles, records, [
      { locale: 'zh-tw', path: 'tools/known' },
    ]);

    expect(issues).toEqual(expect.arrayContaining([
      expect.stringContaining('profile id 不可重複'),
      expect.stringContaining('record id 不可重複'),
      expect.stringContaining('找不到 contributor profile'),
      expect.stringContaining('有效 ISO 日期'),
      expect.stringContaining('找不到可用語系內容'),
    ]));
    expect(() => assertContributorDataConsistency(profiles, records, [])).toThrow(
      '貢獻者資料一致性檢查失敗',
    );
    expect(isValidContributorContentPath('tools/search-reward')).toBe(true);
    expect(isValidContributorContentPath('/tools/search-reward')).toBe(false);
    expect(isValidContributorContentPath('about/contributing')).toBe(false);
  });

  it('公開貢獻者資料不包含 reward 欄位或獎勵總額', () => {
    expect(
      JSON.stringify({ contributorProfiles, acceptedContributionRecords }),
    ).not.toMatch(/reward|獎勵總額/i);
  });

  it('保留推薦內容的外部連結，且 SL DATA 不載入未確認授權的封面', () => {
    expect(getRecommendations()).toContainEqual(
      expect.objectContaining({
        id: 'sl-data',
        name: 'SL DATA',
        url: 'https://hackmd.io/@temmie950807/SL_DATA',
      }),
    );
    expect(getRecommendations().find((site) => site.id === 'sl-data')).not.toHaveProperty('imageUrl');
    expect(getRecommendations()).toContainEqual({
      id: 'cco-found',
      name: 'CCO Found',
      description: '關於CCO裡的機率、公式、遊戲細節進行整理',
      category: '資料網站',
      url: 'https://docs.google.com/spreadsheets/d/1wJLuZhZg_Xs1ouyjh6chntY8p3lcgNTuRU3-9JwKxQ4/edit?usp=sharing',
      note: '使用前請先複製一分到自己雲端，不要直接修改共用檔案',
    });
    expect(getRecommendations()).toContainEqual({
      id: 'official-discord',
      name: '官方 Discord',
      description: '內部包含公頻聊天紀錄與官方消息。',
      category: '社群網站',
      url: 'https://discord.com/invite/JREx8xz',
      imageUrl: '/images/recommendations/websites/discord/logo.svg',
      imageAlt: 'Discord 官方標誌',
    });
  });

  it('三語推薦映射完整包含名稱、分類、描述、備註與圖片替代文字', () => {
    const expected = {
      'zh-tw': {
        'sl-data': {
          name: 'SL DATA',
          description: '香格里拉數據中心，記錄著機密資料。',
          category: '資料網站',
        },
        'cco-found': {
          name: 'CCO Found',
          description: '關於CCO裡的機率、公式、遊戲細節進行整理',
          category: '資料網站',
          note: '使用前請先複製一分到自己雲端，不要直接修改共用檔案',
        },
        'official-discord': {
          name: '官方 Discord',
          description: '內部包含公頻聊天紀錄與官方消息。',
          category: '社群網站',
          imageAlt: 'Discord 官方標誌',
        },
      },
      'zh-cn': {
        'sl-data': {
          name: 'SL DATA',
          description: '香格里拉数据中心，记录着机密资料。',
          category: '数据网站',
        },
        'cco-found': {
          name: 'CCO Found',
          description: '整理 CCO 的概率、公式与游戏细节。',
          category: '数据网站',
          note: '使用前请先复制一份到自己的云端，不要直接修改共享文件。',
        },
        'official-discord': {
          name: '官方 Discord',
          description: '包含公共频道聊天记录和官方公告。',
          category: '社群网站',
          imageAlt: 'Discord 官方标志',
        },
      },
      en: {
        'sl-data': {
          name: 'SL DATA',
          description: 'A Shangri-La data center containing confidential records.',
          category: 'Data website',
        },
        'cco-found': {
          name: 'CCO Found',
          description: 'A collection of CCO probabilities, formulas, and game details.',
          category: 'Data website',
          note: 'Copy it to your own drive before use; do not edit the shared file directly.',
        },
        'official-discord': {
          name: 'Official Discord',
          description: 'Includes public-channel chat logs and official announcements.',
          category: 'Community website',
          imageAlt: 'Official Discord logo',
        },
      },
    } as const;

    for (const locale of ['zh-tw', 'zh-cn', 'en'] as const) {
      expect(getMessages(locale).recommendationsPage.recommendationItems).toEqual(
        expected[locale],
      );
    }
    expect(getRecommendations().find((recommendation) => recommendation.id === 'official-discord')?.url)
      .toBe('https://discord.com/invite/JREx8xz');
  });

  it('移除公會推薦資料並保留網站推薦資料', () => {
    expect(getRecommendations()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'sl-data' })]),
    );
    expect(JSON.stringify(getRecommendations())).not.toMatch(/guild|公會推薦|SUI/i);
  });
});
