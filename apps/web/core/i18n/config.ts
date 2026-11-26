// Server-safe i18n configuration: imported by the root layout (server
// component), so this file must stay free of 'use client' and react-i18next.

export const SUPPORTED_LANGS = ['en', 'de', 'ru', 'ua'] as const;

/** Cookie mirrors the localStorage preference so SSR can render the right language. */
export const LANG_COOKIE = 'sntiq_lang';

/** Normalize a raw tag ("de-DE", "uk", "RU") to a supported code, or null. */
export function normalizeLang(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const base = tag.trim().split('-')[0].toLowerCase();
  // Ukrainian ISO code is "uk"; our locale id is "ua"
  const code = base === 'uk' ? 'ua' : base;
  return (SUPPORTED_LANGS as readonly string[]).includes(code) ? code : null;
}

/** Server-side pick: explicit cookie wins, then Accept-Language, then English. */
export function pickLanguage(
  cookieValue: string | undefined,
  acceptLanguage: string | null,
): string {
  const fromCookie = normalizeLang(cookieValue);
  if (fromCookie) return fromCookie;

  if (acceptLanguage) {
    const ranked = acceptLanguage
      .split(',')
      .map((part) => {
        const [tag, ...params] = part.split(';');
        const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
        return { tag: tag.trim(), q: q ? parseFloat(q.slice(2)) || 0 : 1 };
      })
      .sort((a, b) => b.q - a.q);
    for (const { tag } of ranked) {
      const code = normalizeLang(tag);
      if (code) return code;
    }
  }
  return 'en';
}

/** <html lang> value (BCP 47) for a locale id. */
export function htmlLang(lang: string): string {
  return lang === 'ua' ? 'uk' : lang;
}

/**
 * Pick the German or the English URL for a route that exists under both.
 * German legal-term routes (/datenschutz, /barrierefreiheit, /danke) keep their
 * German URL when the UI is German; every other language gets the English alias
 * (/privacy, /accessibility, /credits). Pure and client-safe, so both the
 * Header/Footer (with i18n.language) and the server metadata helpers can use it.
 */
export function localizedPath(deUrl: string, enUrl: string, lang: string): string {
  return lang === 'de' ? deUrl : enUrl;
}
