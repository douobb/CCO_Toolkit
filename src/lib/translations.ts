import type { Locale } from './i18n';
import en from '../messages/en.json';
import zhCn from '../messages/zh-cn.json';
import zhTw from '../messages/zh-tw.json';

export type Messages = typeof zhTw;

const dictionaries = {
  'zh-tw': zhTw,
  'zh-cn': zhCn,
  en,
} satisfies Record<Locale, Messages>;

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale];
}
