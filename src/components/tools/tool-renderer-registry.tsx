import type { TOCItemType } from 'fumadocs-core/toc';
import {
  DocsBody,
  DocsDescription,
  DocsTitle,
  MarkdownCopyButton,
} from 'fumadocs-ui/layouts/docs/page';
import type { ReactNode } from 'react';

import {
  ArticleMetadata,
  type ArticleMetadataDate,
  type ArticleMetadataLabels,
} from '@/components/article-metadata';
import type { Messages } from '@/lib/translations';
import type { Locale } from '@/lib/i18n';
import { sitePageTitleClassName } from '@/components/site-page-title';

import {
  SearchRewardCalculator,
  SearchRewardToolPage,
} from './search-reward-calculator';
import { SearchRewardChart } from './search-reward-chart';
import {
  MiningCalculator,
  MiningToolPage,
} from './mining-calculator';
import {
  LevelConversionCalculator,
  LevelConversionToolPage,
} from './level-conversion-calculator';
import {
  BlackMarketCalculator,
  BlackMarketToolPage,
} from './black-market-calculator';
import {
  DungeonCalculator,
  DungeonToolPage,
} from './dungeon-calculator';
import {
  EarningsOverviewCalculator,
  EarningsOverviewToolPage,
} from './earnings-overview';
import {
  BackpackPlannerCalculator,
  BackpackPlannerToolPage,
} from './backpack-planner';
import {
  LootBoxAnalysisCalculator,
  LootBoxAnalysisToolPage,
} from './loot-box-analysis';

export type ToolRendererPage = {
  readonly title: string;
  readonly description: string;
  readonly toc: TOCItemType[];
  readonly full?: boolean;
  readonly author?: string;
  readonly date?: ArticleMetadataDate;
  readonly updated?: ArticleMetadataDate;
};

export type ToolRendererContext = {
  readonly page: ToolRendererPage;
  readonly locale: Locale;
  readonly messages: Messages;
  readonly body: ReactNode;
  readonly markdownUrl: string;
};

export type ToolRenderer = (context: ToolRendererContext) => ReactNode;

type ToolHeaderProps = {
  readonly page: ToolRendererPage;
  readonly locale: Locale;
  readonly labels: ArticleMetadataLabels;
};

/** 八個工具 renderer 共用的標題區，確保 frontmatter metadata 與 Guide 同格式。 */
function ToolHeader({ page, locale, labels }: ToolHeaderProps) {
  return (
    <>
      <DocsTitle className={sitePageTitleClassName}>{page.title}</DocsTitle>
      <DocsDescription className="mb-0">
        {page.description}
      </DocsDescription>
      <ArticleMetadata
        author={page.author}
        date={page.date}
        updated={page.updated}
        locale={locale}
        labels={labels}
      />
    </>
  );
}

/**
 * 工具 renderer 的唯一映射；通用文件路由只負責查找與傳遞頁面上下文。
 * 每個 renderer 可以自行決定輸入、結果、說明與 Context panel 的組合。
 */
const toolRenderers: Readonly<Record<string, ToolRenderer>> = {
  'search-reward': ({
    page,
    locale,
    messages,
    body,
    markdownUrl,
  }) => {
    const labels = messages.tools.searchReward;

    return (
      <SearchRewardToolPage
        toc={page.toc}
        full={page.full}
        contextLabel={messages.context.onThisPage}
        contextPanelLabel={messages.context.panelLabel}
        contextCloseLabel={messages.context.closePanel}
        labels={labels}
        header={<ToolHeader page={page} locale={locale} labels={messages.articleMetadata} />}
        headerActions={<MarkdownCopyButton markdownUrl={markdownUrl} />}
      >
        <SearchRewardCalculator labels={labels} locale={locale} />
        {body}
        <SearchRewardChart labels={labels} locale={locale} />
      </SearchRewardToolPage>
    );
  },
  mining: ({
    page,
    locale,
    messages,
    body,
    markdownUrl,
  }) => {
    const labels = messages.tools.mining;

    return (
      <MiningToolPage
        toc={page.toc}
        full={page.full}
        contextLabel={messages.context.onThisPage}
        contextPanelLabel={messages.context.panelLabel}
        contextCloseLabel={messages.context.closePanel}
        labels={labels}
        header={<ToolHeader page={page} locale={locale} labels={messages.articleMetadata} />}
        headerActions={<MarkdownCopyButton markdownUrl={markdownUrl} />}
      >
        <MiningCalculator labels={labels} locale={locale} />
        {body}
      </MiningToolPage>
    );
  },
  'level-conversion': ({
    page,
    locale,
    messages,
    body,
    markdownUrl,
  }) => {
    const labels = messages.tools.levelConversion;

    return (
      <LevelConversionToolPage
        toc={page.toc}
        full={page.full}
        contextLabel={messages.context.onThisPage}
        contextPanelLabel={messages.context.panelLabel}
        contextCloseLabel={messages.context.closePanel}
        labels={labels}
        locale={locale}
        header={<ToolHeader page={page} locale={locale} labels={messages.articleMetadata} />}
        headerActions={<MarkdownCopyButton markdownUrl={markdownUrl} />}
      >
        <LevelConversionCalculator labels={labels} locale={locale} />
        {body}
      </LevelConversionToolPage>
    );
  },
  'black-market': ({
    page,
    locale,
    messages,
    body,
    markdownUrl,
  }) => {
    const labels = messages.tools.blackMarket;

    return (
      <BlackMarketToolPage
        toc={page.toc}
        full={page.full}
        contextLabel={messages.context.onThisPage}
        contextPanelLabel={messages.context.panelLabel}
        contextCloseLabel={messages.context.closePanel}
        labels={labels}
        locale={locale}
        header={<ToolHeader page={page} locale={locale} labels={messages.articleMetadata} />}
        headerActions={<MarkdownCopyButton markdownUrl={markdownUrl} />}
      >
        <BlackMarketCalculator labels={labels} locale={locale} />
        {body}
      </BlackMarketToolPage>
    );
  },
  dungeon: ({
    page,
    locale,
    messages,
    body,
    markdownUrl,
  }) => {
    const labels = messages.tools.dungeon;

    return (
      <DungeonToolPage
        toc={page.toc}
        full={page.full}
        contextLabel={messages.context.onThisPage}
        contextPanelLabel={messages.context.panelLabel}
        contextCloseLabel={messages.context.closePanel}
        header={<ToolHeader page={page} locale={locale} labels={messages.articleMetadata} />}
        headerActions={<MarkdownCopyButton markdownUrl={markdownUrl} />}
      >
        <DungeonCalculator labels={labels} locale={locale} />
        {body}
      </DungeonToolPage>
    );
  },
  'earnings-overview': ({
    page,
    locale,
    messages,
    body,
    markdownUrl,
  }) => {
    const labels = messages.tools.earningsOverview;

    return (
      <EarningsOverviewToolPage
        toc={page.toc}
        full={page.full}
        contextLabel={messages.context.onThisPage}
        contextPanelLabel={messages.context.panelLabel}
        contextCloseLabel={messages.context.closePanel}
        labels={labels}
        locale={locale}
        header={<ToolHeader page={page} locale={locale} labels={messages.articleMetadata} />}
        headerActions={<MarkdownCopyButton markdownUrl={markdownUrl} />}
      >
        <EarningsOverviewCalculator
          labels={labels}
          locale={locale}
          closeLabel={messages.context.closePanel}
        />
        {body}
      </EarningsOverviewToolPage>
    );
  },
  'backpack-planner': ({
    page,
    locale,
    messages,
    body,
    markdownUrl,
  }) => {
    const labels = messages.tools.backpackPlanner;

    return (
      <BackpackPlannerToolPage
        toc={page.toc}
        full={page.full}
        contextLabel={messages.context.onThisPage}
        contextPanelLabel={messages.context.panelLabel}
        contextCloseLabel={messages.context.closePanel}
        labels={labels}
        locale={locale}
        header={<ToolHeader page={page} locale={locale} labels={messages.articleMetadata} />}
        headerActions={<MarkdownCopyButton markdownUrl={markdownUrl} />}
      >
        <BackpackPlannerCalculator labels={labels} locale={locale} />
        {body}
      </BackpackPlannerToolPage>
    );
  },
  'loot-box-analysis': ({
    page,
    locale,
    messages,
    body,
    markdownUrl,
  }) => {
    const labels = messages.tools.lootBoxAnalysis;

    return (
      <LootBoxAnalysisToolPage
        toc={page.toc}
        full={page.full}
        contextLabel={messages.context.onThisPage}
        contextPanelLabel={messages.context.panelLabel}
        contextCloseLabel={messages.context.closePanel}
        labels={labels}
        header={<ToolHeader page={page} locale={locale} labels={messages.articleMetadata} />}
        headerActions={<MarkdownCopyButton markdownUrl={markdownUrl} />}
      >
        <LootBoxAnalysisCalculator labels={labels} locale={locale} />
        {body}
      </LootBoxAnalysisToolPage>
    );
  },
};

export const toolRendererKeys = Object.freeze(Object.keys(toolRenderers));

export function getToolRenderer(renderer: string): ToolRenderer | undefined {
  return toolRenderers[renderer];
}
