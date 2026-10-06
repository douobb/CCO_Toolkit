'use client';

import { useState, type ReactElement } from 'react';
import { usePathname } from 'fumadocs-core/framework';

import { ContextSheet } from '@/components/context';
import { SharedUserInputsManager } from '@/components/shared-user-inputs';
import { Button } from '@/components/ui';
import type { Locale } from '@/lib/i18n';
import { getMessages } from '@/lib/translations';
import {
  getToolPlayerSettingsPathContext,
  hasSharedUserInputsFilterFields,
  type SharedUserInputsFilter,
} from '@/components/shared-user-inputs/shared-user-inputs-filter';

interface SharedSettingsOverlayCopy {
  readonly description: string;
  readonly closeLabel: string;
  readonly viewOptions: string;
  readonly relatedView: string;
  readonly allView: string;
  readonly emptyRelated: string;
}

const sharedSettingsOverlayCopy = {
  'zh-tw': {
    description: '有效的共用設定會自動儲存；無效欄位不會寫入。',
    closeLabel: '關閉共用設定',
    viewOptions: '設定範圍',
    relatedView: '本工具相關',
    allView: '全部設定',
    emptyRelated: '這個工具沒有共用設定欄位。切換至「全部設定」可編輯完整共用設定。',
  },
  'zh-cn': {
    description: '有效的共用设置会自动保存；无效字段不会写入。',
    closeLabel: '关闭共用设置',
    viewOptions: '设置范围',
    relatedView: '本工具相关',
    allView: '全部设置',
    emptyRelated: '这个工具没有共用设置字段。切换至“全部设置”可编辑完整共用设置。',
  },
  en: {
    description: 'Valid shared settings save automatically. Invalid fields are not stored.',
    closeLabel: 'Close shared settings',
    viewOptions: 'Settings scope',
    relatedView: 'Related to this tool',
    allView: 'All settings',
    emptyRelated: 'This tool has no shared settings. Switch to “All settings” to edit them.',
  },
} satisfies Record<Locale, SharedSettingsOverlayCopy>;

const emptyFilter: SharedUserInputsFilter = {
  progression: [],
  equipment: [],
  prices: [],
  exchangeRates: [],
  cacheRates: [],
};

export function ToolPlayerSettingsOverlay({
  trigger,
  locale,
  idPrefix,
}: {
  readonly trigger: ReactElement;
  readonly locale: Locale;
  readonly idPrefix: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? '';
  const pathContext = getToolPlayerSettingsPathContext(pathname);
  const defaultView = pathContext?.defaultView ?? 'all';
  const [viewSelection, setViewSelection] = useState(() => ({
    pathname,
    view: defaultView,
  }));
  const view = viewSelection.pathname === pathname ? viewSelection.view : defaultView;
  const isRelatedView = view === 'related';
  const relatedFilter = pathContext?.relatedFilter ?? emptyFilter;
  const filter = isRelatedView ? relatedFilter : undefined;
  const emptyMessage = isRelatedView && !hasSharedUserInputsFilterFields(relatedFilter)
    ? sharedSettingsOverlayCopy[locale].emptyRelated
    : undefined;
  const copy = sharedSettingsOverlayCopy[locale];
  const labels = getMessages(locale).settingsPage;

  const selectView = (nextView: 'related' | 'all') => {
    setViewSelection({ pathname, view: nextView });
  };

  return (
    <ContextSheet
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      title={labels.title}
      description={copy.description}
      closeLabel={copy.closeLabel}
      closeButtonClassName="h-11 min-h-11 w-11 min-w-11 p-3"
      side="center"
    >
      <div className="mb-5 grid w-full min-w-0 grid-cols-2 gap-2" role="group" aria-label={copy.viewOptions}>
        <Button
          type="button"
          variant={isRelatedView ? 'secondary' : 'outline'}
          className="h-auto min-h-11 min-w-0 whitespace-normal px-2 py-2 text-center leading-5"
          aria-pressed={isRelatedView}
          data-testid="tool-settings-view-related"
          onClick={() => selectView('related')}
        >
          {copy.relatedView}
        </Button>
        <Button
          type="button"
          variant={view === 'all' ? 'secondary' : 'outline'}
          className="h-auto min-h-11 min-w-0 whitespace-normal px-2 py-2 text-center leading-5"
          aria-pressed={view === 'all'}
          data-testid="tool-settings-view-all"
          onClick={() => selectView('all')}
        >
          {copy.allView}
        </Button>
      </div>
      <SharedUserInputsManager
        labels={labels}
        locale={locale}
        mode="quick"
        idPrefix={idPrefix}
        filter={filter}
        emptyMessage={emptyMessage}
      />
    </ContextSheet>
  );
}
