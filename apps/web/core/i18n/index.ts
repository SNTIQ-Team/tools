'use client';

import i18next, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import de from './locales/de';
import ru from './locales/ru';
import ua from './locales/ua';
import { SUPPORTED_LANGS as SUPPORTED, LANG_COOKIE, normalizeLang } from './config';
import type { Language, LocaleResources } from './types';

// Typed against the English bundle: a key missing from de/ru/ua fails the build
// instead of silently falling back at runtime.
const coreResources: Record<Language, LocaleResources> = { en, de, ru, ua };

export const SUPPORTED_LANGS: readonly string[] = SUPPORTED;

// The platform strings. Module namespaces (lathe, chamfer, taper,
// kerf) are NOT bundled here: each module registers its own from the files
// that use it (modules/<m>/i18n/register.ts), so its strings travel with the
// module's route instead of the layout script every page loads.
const resources: Record<string, Record<string, unknown>> = {};
for (const lng of SUPPORTED_LANGS) resources[lng] = { ...coreResources[lng as Language] };

/** Add a module's namespaces for every language. Instances created by
    createI18nInstance read this same object, so a namespace registered when
    the module's code loads is there before the module renders (SSR and
    hydration alike). Registering twice is harmless. */
export function registerModuleResources(bundle: Record<string, Record<string, unknown>>): void {
  for (const lng of SUPPORTED_LANGS) Object.assign(resources[lng], bundle[lng]);
}

/** Match SSR: cookie > legacy localStorage preference > system > English. */
export function detectLanguage(): string {
  if (typeof window === 'undefined') return 'en';

  try {
    const cookie = document.cookie.split(';').find((part) =>
      part.trim().startsWith(`${LANG_COOKIE}=`));
    const preferred = normalizeLang(cookie?.trim().slice(LANG_COOKIE.length + 1));
    if (preferred) return preferred;
  } catch {}

  try {
    const stored = normalizeLang(localStorage.getItem(LANG_COOKIE));
    if (stored) return stored;
  } catch {}

  if (navigator.languages) {
    for (const lang of navigator.languages) {
      const code = normalizeLang(lang);
      if (code) return code;
    }
  }
  return 'en';
}

/**
 * One instance per render tree (created in Shell). On the server the layout
 * passes the cookie/Accept-Language pick, so SSR HTML comes out already in
 * the visitor's language; the client creates its instance with the same value
 * and hydration matches — no English flash on reload.
 */
export function createI18nInstance(lng: string): I18nInstance {
  const instance = i18next.createInstance();
  instance.use(initReactI18next).init({
    resources,
    lng,
    supportedLngs: [...SUPPORTED],
    fallbackLng: 'en',
    defaultNS: 'main',
    interpolation: { escapeValue: false },
    load: 'languageOnly',
    // Synchronous init: the instance is usable in the same render pass (SSR)
    initImmediate: false,
  });

  if (typeof window !== 'undefined') {
    // Persist explicit switches; the cookie is what makes the next SSR correct.
    instance.on('languageChanged', (l) => {
      try {
        localStorage.setItem(LANG_COOKIE, l);
      } catch {}
      try {
        document.cookie = `${LANG_COOKIE}=${l};path=/;max-age=31536000;SameSite=Lax`;
      } catch {}
    });
  }
  return instance;
}
