'use client';

import { ContextSheet, type ContextSheetProps } from './context-sheet';

export type ToolSettingsSheetProps = ContextSheetProps;

export function ToolSettingsSheet(props: ToolSettingsSheetProps) {
  return <ContextSheet {...props} side={props.side ?? 'bottom'} />;
}
