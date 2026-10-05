import { getIntlLocale, isLocale, type Locale } from './i18n';
import { contentSections } from './content-sections';

export interface ChangelogContent {
  title: string;
  description: string;
}

export interface ChangelogEntry extends ChangelogContent {
  date: string;
  localized?: Partial<Record<Exclude<Locale, 'zh-tw'>, ChangelogContent>>;
}

export interface ChangelogGroup {
  key: string;
  label: string;
  entries: ChangelogEntry[];
}

/**
 * 網站更新紀錄的單一資料來源；新增紀錄時只需補上 ISO 日期與內容。
 */
export const changelogEntries: readonly ChangelogEntry[] = [
  {
    date: '2026-10-04',
    title: '網站正式部屬',
    description: 'CCO Toolkit 正式部署至 GitHub Pages。',
    localized: {
      en: {
        title: 'CCO Toolkit launched',
        description: 'CCO Toolkit is now live on GitHub Pages.',
      },
      'zh-cn': {
        title: '网站正式上线',
        description: 'CCO Toolkit 已正式部署至 GitHub Pages。',
      },
    },
  },
  {
    date: '2026-08-26',
    title: '網站開始建立',
    description: '建立 CCO Toolkit 的初始 Foundation，固定網站的內容、語系與部署架構。',
    localized: {
      en: {
        title: 'CCO Toolkit development began',
        description:
          'Built the initial foundation for CCO Toolkit and established its content, localization, and deployment architecture.',
      },
      'zh-cn': {
        title: '网站开始建设',
        description: '搭建 CCO Toolkit 的初始架构，确定网站的内容、语言与部署方式。',
      },
    },
  },
];

function getDate(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

export function getChangelogEntries(locale: Locale = 'zh-tw'): ChangelogEntry[] {
  return [...changelogEntries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(({ localized, ...entry }) => ({
      ...entry,
      ...(locale === 'zh-tw' ? undefined : localized?.[locale]),
    }));
}

export function formatChangelogDate(date: string, locale: Locale): string {
  const [year, month, day] = date.split('-');
  const formatDate = {
    'zh-tw': () => `${year}/${month}/${day}`,
    'zh-cn': () => `${year}/${month}/${day}`,
    en: () => `${month}/${day}/${year}`,
  } satisfies Record<Locale, () => string>;

  return formatDate[locale]();
}

export function getChangelogGroups(locale: Locale): ChangelogGroup[] {
  const groups = new Map<string, ChangelogGroup>();

  for (const entry of getChangelogEntries(locale)) {
    const key = entry.date.slice(0, 7);
    let group = groups.get(key);

    if (!group) {
      group = {
        key,
        label: getDate(entry.date).toLocaleDateString(getIntlLocale(locale), {
          year: 'numeric',
          month: 'long',
        }),
        entries: [],
      };
      groups.set(key, group);
    }

    group.entries.push(entry);
  }

  return [...groups.values()];
}

export type ContributorRoleKey = 'owner' | 'maintainer' | 'contributor';
export type ContributorStatusKey = 'active' | 'blocked' | 'retired';
export type ContributorPublicVisibilityKey = 'public' | 'hidden';
export type ContributionRecordStatusKey = 'published' | 'reverted';
export type ContributorResponsibilityKey =
  | 'site-architecture'
  | 'tool-development'
  | 'data-curation'
  | 'content-maintenance';
export type ContributorCategoryKey =
  | 'article-edit'
  | 'tutorial'
  | 'tool-debugging'
  | 'tool-suggestion'
  | 'translation';

export interface ContributorProfile {
  id: string;
  name: string;
  role: ContributorRoleKey;
  status: ContributorStatusKey;
  /** 舊資料省略時沿用 active 可見、其他狀態隱藏的既有行為。 */
  publicVisibility?: ContributorPublicVisibilityKey;
  responsibilities: readonly ContributorResponsibilityKey[];
  ownerProfile?: {
    avatarUrl: string;
  };
}

export interface AcceptedContributionRecord {
  id: string;
  contributorId: string;
  category: ContributorCategoryKey;
  acceptedAt: string;
  contentPath?: string;
  locale?: Locale;
  policyVersion?: string;
  /** 舊資料省略時視為已發布；reverted 紀錄保留作內部治理，不進公開統計。 */
  status?: ContributionRecordStatusKey;
  summary?: string;
}

export interface ContributorContentTarget {
  contentPath: string;
  locale: Locale;
  href: string;
  title: string;
}

export interface ContributorRecordView {
  record: AcceptedContributionRecord;
  target?: ContributorContentTarget;
}

export interface ContributorTargetSummary {
  contentPath: string;
  count: number;
}

export interface LocalizedContentPath {
  locale: string;
  path: string;
}

export interface ContributorSummary {
  profile: ContributorProfile;
  categories: readonly ContributorCategoryKey[];
  acceptedCount: number;
  latestContributionDate?: string;
}

export interface ContributorGroups {
  coreMaintainers: readonly ContributorSummary[];
  communityContributors: readonly ContributorSummary[];
}

/**
 * 公開貢獻者的 profile 單一資料來源；彙總資訊一律由採用紀錄計算。
 */
export const contributorProfiles: readonly ContributorProfile[] = [
  {
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
  },
];

/**
 * 已採用貢獻的紀錄單一資料來源；目前沒有已確認的 douobb 貢獻紀錄。
 */
export const acceptedContributionRecords: readonly AcceptedContributionRecord[] = [];

export function getContributorProfiles(): readonly ContributorProfile[] {
  return contributorProfiles;
}

export function getAcceptedContributionRecords(): readonly AcceptedContributionRecord[] {
  return acceptedContributionRecords;
}

/** 驗證貢獻紀錄使用的日期格式，僅接受不會被 JavaScript 自動進位的 ISO 日期。 */
export function isValidContributorDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** 舊呼叫端尚未提供狀態時，維持 accepted record 原本代表已採用並公開的行為。 */
export function isPublishedContributionRecord(
  record: Pick<AcceptedContributionRecord, 'status'>,
): boolean {
  return record.status === undefined || record.status === 'published';
}

/** contentPath 使用不含 locale 的路徑；貢獻語系另以 locale 欄位記錄。 */
export function isValidContributorContentPath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) return false;

  const segments = value.split('/');
  const [section] = segments;

  return (
    segments.length >= 2 &&
    contentSections.includes(section as (typeof contentSections)[number]) &&
    segments.every(
      (segment) =>
        segment.length > 0 &&
        segment !== '.' &&
        segment !== '..' &&
        !/[\\?#\s]/.test(segment),
    )
  );
}

export function getActiveContributorProfiles(
  profiles: readonly ContributorProfile[] = contributorProfiles,
): readonly ContributorProfile[] {
  return profiles.filter((profile) => profile.status === 'active');
}

/** 依日期由新到舊取得單一 contributor 的紀錄，並以 ID 穩定排序同日紀錄。 */
export function getContributorRecords(
  contributorId: string,
  records: readonly AcceptedContributionRecord[] = acceptedContributionRecords,
): AcceptedContributionRecord[] {
  return records
    .filter(
      (record) =>
        record.contributorId === contributorId && isPublishedContributionRecord(record),
    )
    .sort((left, right) => {
      const dateDifference = right.acceptedAt.localeCompare(left.acceptedAt);
      return dateDifference !== 0 ? dateDifference : left.id.localeCompare(right.id);
    });
}

/** 由 records 計算各目標頁面的貢獻筆數，不維護容易漂移的手動統計。 */
export function getContributorTargetSummaries(
  records: readonly AcceptedContributionRecord[],
): ContributorTargetSummary[] {
  const counts = new Map<string, number>();

  for (const record of records) {
    if (!isPublishedContributionRecord(record)) continue;
    if (!isValidContributorContentPath(record.contentPath)) continue;
    counts.set(record.contentPath, (counts.get(record.contentPath) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([contentPath, count]) => ({ contentPath, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.contentPath.localeCompare(right.contentPath),
    );
}

/** 找出 profile／record／內容目標的資料一致性問題；可在不載入 Fumadocs 的測試中使用。 */
export function getContributorDataIssues(
  profiles: readonly ContributorProfile[],
  records: readonly AcceptedContributionRecord[],
  availableContentPaths: readonly LocalizedContentPath[] = [],
): string[] {
  const issues: string[] = [];
  const profileIds = new Set<string>();

  for (const profile of profiles) {
    const profileId = typeof profile.id === 'string' ? profile.id : '';
    if (!profileId.trim()) {
      issues.push('contributor profile id 不可為空');
    }
    if (profileIds.has(profileId)) {
      issues.push(`contributor profile id 不可重複：${profileId}`);
    }
    profileIds.add(profileId);

    if (!['active', 'blocked', 'retired'].includes(profile.status)) {
      issues.push(`contributor profile ${profileId} 的 status 無效：${profile.status}`);
    }
    if (
      profile.publicVisibility !== undefined &&
      !['public', 'hidden'].includes(profile.publicVisibility)
    ) {
      issues.push(
        `contributor profile ${profileId} 的 publicVisibility 無效：${profile.publicVisibility}`,
      );
    }
  }

  const recordIds = new Set<string>();
  for (const record of records) {
    const recordId = typeof record.id === 'string' ? record.id : '';
    if (!recordId.trim()) {
      issues.push('accepted contribution record id 不可為空');
    }
    if (recordIds.has(recordId)) {
      issues.push(`accepted contribution record id 不可重複：${recordId}`);
    }
    recordIds.add(recordId);

    if (!profileIds.has(record.contributorId)) {
      issues.push(
        `accepted contribution record ${recordId} 找不到 contributor profile：${record.contributorId}`,
      );
    }

    if (!isValidContributorDate(record.acceptedAt)) {
      issues.push(
        `accepted contribution record ${recordId} 的 acceptedAt 必須是有效 ISO 日期：${record.acceptedAt}`,
      );
    }

    if (
      record.status !== undefined &&
      !['published', 'reverted'].includes(record.status)
    ) {
      issues.push(`accepted contribution record ${recordId} 的 status 無效：${record.status}`);
    }
    if (
      record.locale !== undefined &&
      (typeof record.locale !== 'string' || !isLocale(record.locale))
    ) {
      issues.push(`accepted contribution record ${recordId} 的 locale 無效：${record.locale}`);
    }
    if (
      record.policyVersion !== undefined &&
      (typeof record.policyVersion !== 'string' || !record.policyVersion.trim())
    ) {
      issues.push(`accepted contribution record ${recordId} 的 policyVersion 不可為空`);
    }

    if (record.contentPath === undefined) continue;

    if (!isValidContributorContentPath(record.contentPath)) {
      issues.push(
        `accepted contribution record ${recordId} 的 contentPath 格式無效：${record.contentPath}`,
      );
      continue;
    }

    if (record.status === 'reverted') continue;

    const hasAvailableLocale = availableContentPaths.some(
      (page) =>
        page.path === record.contentPath &&
        isLocale(page.locale) &&
        (record.locale === undefined || page.locale === record.locale),
    );
    if (!hasAvailableLocale) {
      issues.push(
        `accepted contribution record ${recordId} 的 contentPath 找不到可用語系內容：${record.contentPath}`,
      );
    }
  }

  return issues;
}

/** 在 build／模組載入時阻止無法公開解析的貢獻資料進入網站。 */
export function assertContributorDataConsistency(
  profiles: readonly ContributorProfile[],
  records: readonly AcceptedContributionRecord[],
  availableContentPaths: readonly LocalizedContentPath[] = [],
) {
  const issues = getContributorDataIssues(profiles, records, availableContentPaths);
  if (issues.length > 0) {
    throw new Error(`貢獻者資料一致性檢查失敗：\n- ${issues.join('\n- ')}`);
  }
}

export function summarizeContributor(
  profile: ContributorProfile,
  records: readonly AcceptedContributionRecord[],
): ContributorSummary {
  const contributorRecords = records.filter(
    (record) =>
      record.contributorId === profile.id && isPublishedContributionRecord(record),
  );
  const categories = [...new Set(contributorRecords.map((record) => record.category))];
  const latestContributionDate = contributorRecords.reduce<string | undefined>(
    (latest, record) =>
      !latest || record.acceptedAt.localeCompare(latest) > 0 ? record.acceptedAt : latest,
    undefined,
  );

  return {
    profile,
    categories,
    acceptedCount: contributorRecords.length,
    ...(latestContributionDate ? { latestContributionDate } : {}),
  };
}

export function getContributorSummaries(
  profiles: readonly ContributorProfile[] = contributorProfiles,
  records: readonly AcceptedContributionRecord[] = acceptedContributionRecords,
): readonly ContributorSummary[] {
  return profiles.map((profile) => summarizeContributor(profile, records));
}

export function getPublicContributorGroups(
  profiles: readonly ContributorProfile[] = contributorProfiles,
  records: readonly AcceptedContributionRecord[] = acceptedContributionRecords,
): ContributorGroups {
  const summaries = getContributorSummaries(profiles, records);
  const isPublic = (profile: ContributorProfile) =>
    profile.publicVisibility === undefined
      ? profile.status === 'active'
      : profile.publicVisibility === 'public';

  return {
    coreMaintainers: summaries.filter(
      ({ profile }) =>
        isPublic(profile) &&
        (profile.role === 'owner' || profile.role === 'maintainer'),
    ),
    communityContributors: summaries.filter(
      ({ profile }) => isPublic(profile) && profile.role === 'contributor',
    ),
  };
}

export function formatContributorDate(date: string, locale: Locale): string {
  return formatChangelogDate(date, locale);
}

export interface Recommendation {
  id: string;
  name: string;
  description: string;
  category: string;
  url: string;
  note?: string;
  imageUrl?: string;
  imageAlt?: string;
}

export const recommendations: readonly Recommendation[] = [
  {
    id: 'sl-data',
    name: 'SL DATA',
    description: '香格里拉數據中心，記錄著機密資料。',
    category: '資料網站',
    url: 'https://hackmd.io/@temmie950807/SL_DATA',
  },
  {
    id: 'cco-found',
    name: 'CCO Found',
    description: '關於CCO裡的機率、公式、遊戲細節進行整理',
    category: '資料網站',
    url: 'https://docs.google.com/spreadsheets/d/1wJLuZhZg_Xs1ouyjh6chntY8p3lcgNTuRU3-9JwKxQ4/edit?usp=sharing',
    note: '使用前請先複製一分到自己雲端，不要直接修改共用檔案',
  },
  {
    id: 'official-discord',
    name: '官方 Discord',
    description: '內部包含公頻聊天紀錄與官方消息。',
    category: '社群網站',
    url: 'https://discord.com/invite/JREx8xz',
    imageUrl: '/images/recommendations/websites/discord/logo.svg',
    imageAlt: 'Discord 官方標誌',
  },
];

export function getRecommendations(): readonly Recommendation[] {
  return recommendations;
}
