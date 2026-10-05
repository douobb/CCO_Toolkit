'use client';

import { useState, type ReactElement } from 'react';

import { ContextSheet } from '@/components/context';
import { SharedUserInputsManager } from '@/components/shared-user-inputs';
import type { Locale } from '@/lib/i18n';
import { getMessages } from '@/lib/translations';

interface QuickSettingsCopy {
  readonly title: string;
  readonly description: string;
  readonly closeLabel: string;
}

const quickSettingsCopy = {
  'zh-tw': {
    title: '快速設定',
    description: '有效的共用設定會自動儲存；無效欄位不會寫入。',
    closeLabel: '關閉快速設定',
  },
  'zh-cn': {
    title: '快速设置',
    description: '有效的共用设置会自动保存；无效字段不会写入。',
    closeLabel: '关闭快速设置',
  },
  en: {
    title: 'Quick settings',
    description: 'Valid shared settings save automatically. Invalid fields are not stored.',
    closeLabel: 'Close quick settings',
  },
} satisfies Record<Locale, QuickSettingsCopy>;

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
  const copy = quickSettingsCopy[locale];
  const labels = getMessages(locale).settingsPage;

  return (
    <ContextSheet
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      title={copy.title}
      description={copy.description}
      closeLabel={copy.closeLabel}
      closeButtonClassName="h-11 min-h-11 w-11 min-w-11 p-3"
      side="center"
    >
      <SharedUserInputsManager
        labels={labels}
        locale={locale}
        mode="quick"
        idPrefix={idPrefix}
      />
    </ContextSheet>
  );
}
