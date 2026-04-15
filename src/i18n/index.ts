import { createI18n } from 'vue-i18n';
import { formatDate } from '../utils';
import { messages } from './messages';

export type AppLocale = 'zh-Hans' | 'en';

const LOCALE_STORAGE_KEY = 'medtracker_locale';
const DEFAULT_LOCALE: AppLocale = 'zh-Hans';

function normalizeLocale(locale?: string): AppLocale {
  if (!locale) return DEFAULT_LOCALE;
  return locale.toLowerCase().startsWith('en') ? 'en' : 'zh-Hans';
}

function detectLocale(): AppLocale {
  try {
    const storedLocale = uni.getStorageSync(LOCALE_STORAGE_KEY);
    if (storedLocale) {
      return normalizeLocale(String(storedLocale));
    }
  } catch {}

  try {
    if (typeof uni.getLocale === 'function') {
      return normalizeLocale(uni.getLocale());
    }
  } catch {}

  try {
    const systemInfo = uni.getSystemInfoSync();
    return normalizeLocale(systemInfo.language);
  } catch {}

  return DEFAULT_LOCALE;
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'en',
  globalInjection: true,
  messages,
});

function currentLocaleValue(): AppLocale {
  const globalLocale = i18n.global.locale as unknown as string | { value: string };
  return normalizeLocale(typeof globalLocale === 'string' ? globalLocale : globalLocale.value);
}

export function getAppLocale(): AppLocale {
  return currentLocaleValue();
}

export function translate(key: string, named?: Record<string, unknown>): string {
  return i18n.global.t(key, named ?? {});
}

export function applyTabBarLocale(): void {
  const labels = [
    translate('tab.home'),
    translate('tab.medications'),
    translate('tab.photo'),
    translate('tab.records'),
  ];

  labels.forEach((text, index) => {
    try {
      uni.setTabBarItem({ index, text });
    } catch {}
  });
}

export function setAppLocale(locale: AppLocale): void {
  const normalizedLocale = normalizeLocale(locale);
  const globalLocale = i18n.global.locale as unknown as string | { value: string };

  if (typeof globalLocale === 'string') {
    (i18n.global.locale as unknown as string) = normalizedLocale;
  } else {
    globalLocale.value = normalizedLocale;
  }

  try {
    uni.setStorageSync(LOCALE_STORAGE_KEY, normalizedLocale);
  } catch {}

  try {
    if (typeof uni.setLocale === 'function') {
      uni.setLocale(normalizedLocale);
    }
  } catch {}

  applyTabBarLocale();
}

export function formatTodayLabel(locale: AppLocale = getAppLocale(), date = new Date()): string {
  const weekdayIndex = date.getDay();
  const weekdayKey = locale === 'en' ? 'common.weekdayShort' : 'common.weekdayLong';
  const weekdays = i18n.global.tm(weekdayKey) as string[];
  const weekday = weekdays?.[weekdayIndex] || '';

  if (locale === 'en') {
    const month = date.toLocaleString('en-US', { month: 'short' });
    return `${month} ${date.getDate()} ${weekday}`;
  }

  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`;
}

export function formatHistoryDateLabel(timestamp: number, locale: AppLocale = getAppLocale(), now = new Date()): string {
  const date = formatDate(timestamp);
  const today = formatDate(now.getTime());
  const yesterday = formatDate(now.getTime() - 86400000);
  const weekdayKey = locale === 'en' ? 'common.weekdayShort' : 'common.weekdayLong';
  const weekdays = i18n.global.tm(weekdayKey) as string[];
  const weekday = weekdays?.[new Date(timestamp).getDay()] || '';

  if (date === today) {
    return `${translate('common.today')} · ${date}`;
  }

  if (date === yesterday) {
    return `${translate('common.yesterday')} · ${date}`;
  }

  return `${date} ${weekday}`;
}