import type en from './locales/en';

export type Language = 'en' | 'de' | 'ru' | 'ua';

/**
 * Shape of a full locale bundle, derived from the English source of truth.
 * Every other locale must provide exactly the same keys — a missing key in
 * de/ru/ua is a compile-time error (see the typed map in core/i18n/index.ts).
 */
export type LocaleResources = typeof en;
