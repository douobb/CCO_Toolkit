import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  getPublicContributorGroups,
  type AcceptedContributionRecord,
  type ContributorGroups,
  type ContributorProfile,
  type ContributorRecordView,
} from '@/lib/site-content';

import {
  ContributorDialogBody,
  ContributorDetail,
  ContributorDialogSummary,
  Contributors,
  RecommendationsGrid,
} from './site-content';

const fixtureProfiles: readonly ContributorProfile[] = [
  {
    id: 'core-maintainer',
    name: 'Core Maintainer',
    role: 'maintainer',
    status: 'active',
    responsibilities: ['tool-development'],
  },
  {
    id: 'community-contributor',
    name: 'Community Contributor',
    role: 'contributor',
    status: 'active',
    responsibilities: [],
  },
];

const fixtureRecords: readonly AcceptedContributionRecord[] = [
  {
    id: 'core-record',
    contributorId: 'core-maintainer',
    category: 'tool-debugging',
    acceptedAt: '2026-09-01',
  },
  {
    id: 'community-record',
    contributorId: 'community-contributor',
    category: 'translation',
    acceptedAt: '2026-09-05',
    contentPath: 'tools/search-reward',
    summary: 'Supplement tool translation.',
  },
  {
    id: 'community-debugging-record',
    contributorId: 'community-contributor',
    category: 'tool-debugging',
    acceptedAt: '2026-09-03',
  },
];

const fixtureRecordViews: readonly ContributorRecordView[] = [
  {
    record: fixtureRecords[0],
  },
  {
    record: fixtureRecords[1],
    target: {
      contentPath: 'tools/search-reward',
      locale: 'zh-tw',
      href: '/zh-tw/tools/search-reward',
      title: '搜索收益計算器',
    },
  },
  {
    record: fixtureRecords[2],
  },
];

describe('Contributors', () => {
  it('以可存取的卡片 Dialog 呈現雙區塊、負責領域與空紀錄狀態', () => {
    const markup = renderToStaticMarkup(<Contributors locale="zh-tw" />);

    expect(markup).toContain('核心維護者');
    expect(markup).toContain('社群貢獻者');
    expect(markup).toContain('站長／主要維護者');
    expect(markup).toContain('網站架構');
    expect(markup).toContain('工具開發');
    expect(markup).toContain('資料整理');
    expect(markup).toContain('內容維護');
    expect(markup).toContain('data-responsive-card-dialog-trigger=""');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('aria-label="開啟貢獻者詳細資料:');
    expect(markup).not.toContain('<details');
    expect(markup).not.toContain('<summary');
    expect(markup).not.toContain('顯示貢獻');
    expect(markup).not.toContain('收合貢獻');
    expect(markup).not.toContain('about/contributors/');
    expect(markup).toContain('目前還沒有社群貢獻者資料。');
    expect(markup).not.toContain('已採用貢獻數');
    expect(markup).not.toMatch(/reward|獎勵總額/i);
  });

  it('以英文顯示核心／社群標籤、record stats 與 localized target fallback', () => {
    const groups = getPublicContributorGroups(fixtureProfiles, fixtureRecords);
    const markup = renderToStaticMarkup(
      <Contributors locale="en" groups={groups} recordViews={fixtureRecordViews} />,
    );

    expect(markup).toContain('Core maintainers');
    expect(markup).toContain('Community contributors');
    expect(markup).toContain('Tool development');
    expect(markup).toContain('Tool debugging');
    expect(markup).toContain('Accepted contributions');
    expect(markup).toContain('Latest contribution');
    expect(markup).toContain('09/05/2026');
    expect(markup).toContain('aria-label="Open contributor details:');
    expect(markup).not.toContain('Show contributions');
    expect(markup).not.toContain('Hide contributions');

    const coreCard = markup.slice(0, markup.indexOf('Community Contributor'));
    expect(coreCard).not.toContain('Accepted contributions');
    expect(markup).not.toContain('about/contributors/');
  });

  it('在 Dialog 詳細內容頂端顯示維護者與貢獻者摘要，再接既有明細', () => {
    const groups = getPublicContributorGroups(fixtureProfiles, fixtureRecords);
    const maintainerRecords = fixtureRecordViews.filter(
      ({ record }) => record.contributorId === 'core-maintainer',
    );
    const maintainerDialog = renderToStaticMarkup(
      <>
        <ContributorDialogSummary locale="en" entry={groups.coreMaintainers[0]} />
        <ContributorDetail
          locale="en"
          profile={groups.coreMaintainers[0].profile}
          records={maintainerRecords}
        />
      </>,
    );

    expect(maintainerDialog).toContain('data-contributor-summary="dialog"');
    expect(maintainerDialog).toContain('Responsibilities');
    expect(maintainerDialog).toContain('Tool development');
    expect(maintainerDialog.indexOf('data-contributor-detail')).toBeGreaterThan(
      maintainerDialog.indexOf('Responsibilities'),
    );

    const contributorRecords = fixtureRecordViews.filter(
      ({ record }) => record.contributorId === 'community-contributor',
    );
    const contributorDialog = renderToStaticMarkup(
      <>
        <ContributorDialogSummary locale="en" entry={groups.communityContributors[0]} />
        <ContributorDetail
          locale="en"
          profile={groups.communityContributors[0].profile}
          records={contributorRecords}
        />
      </>,
    );

    expect(contributorDialog).toContain('Contribution types');
    expect(contributorDialog).toContain('Translations');
    expect(contributorDialog).toContain('Tool debugging');
    expect(contributorDialog).toContain('Accepted contributions');
    expect(contributorDialog).toContain('>2</dd>');
    expect(contributorDialog).toContain('Latest contribution');
    expect(contributorDialog).toContain('09/05/2026');
    expect(contributorDialog.indexOf('data-contributor-detail')).toBeGreaterThan(
      contributorDialog.indexOf('Contribution types'),
    );
  });

  it('站長簡介不顯示採用紀錄，核心維護者與社群貢獻者仍顯示紀錄', () => {
    const owner = getPublicContributorGroups().coreMaintainers.find(
      ({ profile }) => profile.id === 'douobb',
    );
    expect(owner).toBeDefined();
    if (!owner) throw new Error('缺少公開站長 profile');

    const ownerDialog = renderToStaticMarkup(
      <ContributorDialogBody locale="zh-tw" entry={owner} recordViews={[]} />,
    );
    expect(ownerDialog).toContain('CCO Toolkit');
    expect(ownerDialog).toContain('site-character.webp');
    expect(ownerDialog).toContain('這個人很懶，什麼都沒留下');
    expect(ownerDialog).not.toContain('douobb.github.io');
    expect(ownerDialog).not.toContain('href="https://');
    expect(ownerDialog).not.toContain('data-contributor-detail');
    expect(ownerDialog).not.toContain('已採用貢獻紀錄');

    const groups = getPublicContributorGroups(fixtureProfiles, fixtureRecords);
    const maintainerDialog = renderToStaticMarkup(
      <ContributorDialogBody
        locale="en"
        entry={groups.coreMaintainers[0]}
        recordViews={fixtureRecordViews}
      />,
    );
    expect(maintainerDialog).toContain('data-contributor-detail');
    expect(maintainerDialog).toContain('Accepted contribution records');
    expect(maintainerDialog).toContain('Tool debugging');

    const communityDialog = renderToStaticMarkup(
      <ContributorDialogBody
        locale="en"
        entry={groups.communityContributors[0]}
        recordViews={fixtureRecordViews}
      />,
    );
    expect(communityDialog).toContain('data-contributor-detail');
    expect(communityDialog).toContain('Accepted contribution records');
    expect(communityDialog).toContain('Translations');
  });

  it('依 publicVisibility 顯示 blocked／retired 作者並排除 hidden 作者', () => {
    const groups: ContributorGroups = {
      coreMaintainers: [],
      communityContributors: [
        {
          profile: {
            id: 'blocked-public',
            name: 'Blocked public contributor',
            role: 'contributor',
            status: 'blocked',
            publicVisibility: 'public',
            responsibilities: [],
          },
          categories: [],
          acceptedCount: 0,
        },
        {
          profile: {
            id: 'retired-public',
            name: 'Retired public contributor',
            role: 'contributor',
            status: 'retired',
            publicVisibility: 'public',
            responsibilities: [],
          },
          categories: [],
          acceptedCount: 0,
        },
        {
          profile: {
            id: 'blocked-hidden',
            name: 'Blocked hidden contributor',
            role: 'contributor',
            status: 'blocked',
            publicVisibility: 'hidden',
            responsibilities: [],
          },
          categories: [],
          acceptedCount: 0,
        },
        {
          profile: {
            id: 'active-hidden',
            name: 'Active hidden contributor',
            role: 'contributor',
            status: 'active',
            publicVisibility: 'hidden',
            responsibilities: [],
          },
          categories: [],
          acceptedCount: 0,
        },
      ],
    };

    const markup = renderToStaticMarkup(
      <Contributors locale="en" groups={groups} recordViews={fixtureRecordViews} />,
    );

    expect(markup).toContain('Blocked public contributor');
    expect(markup).toContain('Retired public contributor');
    expect(markup).not.toContain('Blocked hidden contributor');
    expect(markup).not.toContain('Active hidden contributor');
    expect(markup).not.toContain('<details');
  });

  it('顯示明細的日期、分類、目標連結與摘要，且無 contentPath 時不產生連結', () => {
    const contributor = fixtureProfiles[1];
    const records = fixtureRecordViews.filter(
      ({ record }) => record.contributorId === contributor.id,
    );

    const markup = renderToStaticMarkup(
      <ContributorDetail locale="en" profile={contributor} records={records} />,
    );

    expect(markup).toContain('Accepted contribution records');
    expect(markup).toContain('href="/zh-tw/tools/search-reward"');
    expect(markup).toContain('Supplement tool translation.');
    expect(markup).toContain('Contributions by target page');
    expect(markup).toContain('1 record');

    const noTargetMarkup = renderToStaticMarkup(
      <ContributorDetail
        locale="en"
        profile={contributor}
        records={[fixtureRecordViews[2]]}
      />,
    );
    expect(noTargetMarkup).toContain('Tool debugging');
    expect(noTargetMarkup).not.toContain('href=');
  });
});

describe('Recommendation grids', () => {
  it('顯示網站推薦、可選備註與無封面佔位，並保留外部連結行為', () => {
    const markup = renderToStaticMarkup(<RecommendationsGrid locale="zh-tw" />);

    expect(markup).toContain('SL DATA');
    expect(markup).toContain('CCO Found');
    expect(markup).toContain('官方 Discord');
    expect(markup).toContain('內部包含公頻聊天紀錄與官方消息。');
    expect(markup).toContain('關於CCO裡的機率、公式、遊戲細節進行整理');
    expect(markup).toContain('使用前請先複製一分到自己雲端，不要直接修改共用檔案');
    expect(markup).toContain('CCO Found：無封面，使用文件圖示');
    expect(markup).toContain('SL DATA：無封面，使用文件圖示');
    expect(markup).not.toContain('i.imgur.com');
    expect(markup).toContain('開啟連結');
    expect(markup).toContain('href="https://hackmd.io/@temmie950807/SL_DATA"');
    expect(markup).toContain('href="https://docs.google.com/spreadsheets/d/1wJLuZhZg_Xs1ouyjh6chntY8p3lcgNTuRU3-9JwKxQ4/edit?usp=sharing"');
    expect(markup).toContain('href="https://discord.com/invite/JREx8xz"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noreferrer noopener"');
    expect(markup).toContain('@min-[30rem]:grid-cols-2');
    expect(markup).toContain('@min-[48rem]:grid-cols-3');
    expect(markup).not.toContain('data-responsive-card-dialog-trigger');
    expect(markup).not.toMatch(/guild|公會推薦|SUI/i);
  });

  it('依三種網站語系顯示官方 Discord 的翻譯文案', () => {
    expect(renderToStaticMarkup(<RecommendationsGrid locale="zh-tw" />)).toContain(
      '官方 Discord',
    );
    expect(renderToStaticMarkup(<RecommendationsGrid locale="zh-tw" />)).toContain(
      '內部包含公頻聊天紀錄與官方消息。',
    );
    expect(renderToStaticMarkup(<RecommendationsGrid locale="zh-cn" />)).toContain(
      '官方 Discord',
    );
    expect(renderToStaticMarkup(<RecommendationsGrid locale="zh-cn" />)).toContain(
      '内含公共频道聊天记录与官方消息。',
    );
    expect(renderToStaticMarkup(<RecommendationsGrid locale="en" />)).toContain(
      'Official Discord',
    );
    expect(renderToStaticMarkup(<RecommendationsGrid locale="en" />)).toContain(
      'Includes public-channel chat logs and official announcements.',
    );
  });
});
