import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';
import {
  getGameDataMetadataById,
  type GameDataSetId,
} from '@/lib/game-data-catalog';

export interface GameDataReferenceLabels {
  title: ReactNode;
  dataset: ReactNode;
  domain: ReactNode;
  schemaVersion: ReactNode;
  dataVersion: ReactNode;
  updatedAt: ReactNode;
  source: ReactNode;
}

const defaultLabels: GameDataReferenceLabels = {
  title: '資料版本與來源',
  dataset: '資料集',
  domain: '資料領域',
  schemaVersion: 'Schema 版本',
  dataVersion: '資料版本',
  updatedAt: '更新日期',
  source: '資料來源',
};

/**
 * 顯示已發布 Game Data 的追溯資訊，不複製或暴露 payload。
 *
 * 內容作者只需指定穩定 dataset ID；版本、日期與來源會直接從已驗證
 * 的資料目錄取得，避免在 Blog／Guide／DataTable 各自維護一份 metadata。
 */
export function GameDataReference({
  datasetId,
  title,
  labels: customLabels,
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<'aside'>, 'title'> & {
  datasetId: GameDataSetId;
  title?: ReactNode;
  labels?: Partial<GameDataReferenceLabels>;
}) {
  const data = getGameDataMetadataById(datasetId);
  if (!data) throw new Error(`未知的 Game Data dataset：${datasetId}`);

  const labels = { ...defaultLabels, ...customLabels };

  return (
    <aside
      {...props}
      className={cn('not-prose my-6 rounded-xl border bg-fd-card p-5 sm:p-6', className)}
      data-game-data-reference={data.datasetId}
      data-game-data-version={data.dataVersion}
      data-game-data-updated-at={data.updatedAt}
    >
      <h3 className="text-base font-semibold text-fd-foreground">
        {title ?? labels.title}
      </h3>
      <dl className="mt-4 grid gap-3 text-sm leading-6 sm:grid-cols-2">
        <div>
          <dt className="text-fd-muted-foreground">{labels.dataset}</dt>
          <dd className="mt-1 break-words font-medium text-fd-foreground">
            {data.datasetId}
          </dd>
        </div>
        <div>
          <dt className="text-fd-muted-foreground">{labels.domain}</dt>
          <dd className="mt-1 break-words font-medium text-fd-foreground">
            {data.domain}
          </dd>
        </div>
        <div>
          <dt className="text-fd-muted-foreground">{labels.schemaVersion}</dt>
          <dd className="mt-1 break-words font-medium text-fd-foreground">
            {data.schemaVersion}
          </dd>
        </div>
        <div>
          <dt className="text-fd-muted-foreground">{labels.dataVersion}</dt>
          <dd className="mt-1 break-words font-medium text-fd-foreground">
            {data.dataVersion}
          </dd>
        </div>
        <div>
          <dt className="text-fd-muted-foreground">{labels.updatedAt}</dt>
          <dd className="mt-1 font-medium text-fd-foreground">{data.updatedAt}</dd>
        </div>
        <div>
          <dt className="text-fd-muted-foreground">{labels.source}</dt>
          <dd className="mt-1 flex flex-col gap-1 font-medium text-fd-foreground">
            {data.sources.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-words underline underline-offset-4 hover:text-fd-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
              >
                {source.name}
              </a>
            ))}
          </dd>
        </div>
      </dl>
    </aside>
  );
}
