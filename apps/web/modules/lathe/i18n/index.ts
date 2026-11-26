import { de } from './de';
import { en } from './en';
import { ru } from './ru';
import { ua } from './ua';

/** Module i18n contribution: namespace 'lathe' merged into the platform i18n instance. */
export const latheResources = {
  en: { lathe: en },
  de: { lathe: de },
  ru: { lathe: ru },
  ua: { lathe: ua },
} as const;
