import { Fragment, type ReactNode } from 'react';

import {
  gameDataSetCatalog,
  type GameCatalogLocale,
} from '@/lib/game-data-catalog';
import { getGameDataMetadata } from '@/lib/game-data';
import { defaultLocale } from '@/lib/i18n';

import { DataTable } from './data-table';

interface GameDataVersionTableLabels {
  readonly ariaLabel: string;
  readonly caption: string;
  readonly dataset: string;
  readonly domain: string;
  readonly schemaVersion: string;
  readonly dataVersion: string;
  readonly updatedAt: string;
  readonly source: string;
}

const labelsByLocale: Readonly<Record<GameCatalogLocale, GameDataVersionTableLabels>> = {
  'zh-tw': {
    ariaLabel: '目前 Game Data 版本',
    caption: '目前 Game Data 版本',
    dataset: '資料集',
    domain: '資料領域',
    schemaVersion: 'Schema 版本',
    dataVersion: '資料版本',
    updatedAt: '更新日期',
    source: '資料來源',
  },
  'zh-cn': {
    ariaLabel: '当前 Game Data 版本',
    caption: '当前 Game Data 版本',
    dataset: '数据集',
    domain: '数据领域',
    schemaVersion: 'Schema 版本',
    dataVersion: '数据版本',
    updatedAt: '更新日期',
    source: '数据来源',
  },
  en: {
    ariaLabel: 'Current Game Data versions',
    caption: 'Current Game Data versions',
    dataset: 'Dataset',
    domain: 'Domain',
    schemaVersion: 'Schema version',
    dataVersion: 'Data version',
    updatedAt: 'Updated',
    source: 'Source',
  },
};

export interface GameDataVersionTableProps {
  readonly locale?: GameCatalogLocale;
  readonly title?: ReactNode;
}

/** 集中呈現資料目錄的版本資訊；新增 dataset 後會自動出現在此表。 */
export function GameDataVersionTable({
  locale = defaultLocale,
  title,
}: GameDataVersionTableProps) {
  const labels = labelsByLocale[locale];
  const rows = Object.values(gameDataSetCatalog).map((dataSet) => {
    const data = getGameDataMetadata<unknown>(dataSet);
    const datasetIdParts = data.datasetId.split('-');
    const datasetId = (
      <>
        {datasetIdParts.map((part, index) => (
          <Fragment key={`${data.datasetId}-${index}`}>
            {part}
            {index < datasetIdParts.length - 1 ? (
              <>
                -<wbr />
              </>
            ) : null}
          </Fragment>
        ))}
      </>
    );

    return [
      datasetId,
      data.domain,
      data.schemaVersion,
      data.dataVersion,
      data.updatedAt,
      <div key={`${data.datasetId}-sources`} className="flex flex-wrap gap-x-3 gap-y-1">
        {data.sources.map((source) => (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-fd-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
          >
            {source.name}
          </a>
        ))}
      </div>,
    ] satisfies readonly ReactNode[];
  });

  return (
    <DataTable
      data-game-data-version-table=""
      ariaLabel={labels.ariaLabel}
      caption={title ?? labels.caption}
      rowHeader
      columns={[
        { id: 'dataset', label: labels.dataset, width: '150px' },
        { id: 'domain', label: labels.domain, width: '132px' },
        { id: 'schema-version', label: labels.schemaVersion, width: '136px' },
        { id: 'data-version', label: labels.dataVersion, width: '224px' },
        { id: 'updated-at', label: labels.updatedAt, width: '120px' },
        { id: 'source', label: labels.source, width: '194px' },
      ]}
      rows={rows}
    />
  );
}
