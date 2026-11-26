import { cookies, headers } from 'next/headers';
import { LANG_COOKIE, pickLanguage } from './config';
import type { Language } from './types';

export async function resolveServerLang(): Promise<Language> {
  const [preferences, request] = await Promise.all([cookies(), headers()]);
  return pickLanguage(preferences.get(LANG_COOKIE)?.value, request.get('accept-language')) as Language;
}
