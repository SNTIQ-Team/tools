import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import Shell from '@/core/shell/Shell';
import { htmlLang, LANG_COOKIE, pickLanguage } from '@/core/i18n/config';
import './globals.css';
import './tools.css';

export const metadata: Metadata = { title: 'SNTIQ Tools', description: 'Tools for working with German law, public authorities, letters and legal aid.' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [preferences, request] = await Promise.all([cookies(), headers()]);
  const lang = pickLanguage(preferences.get(LANG_COOKIE)?.value, request.get('accept-language'));
  return <html lang={htmlLang(lang)} suppressHydrationWarning><body>
    <Shell initialLang={lang}>{children}</Shell>
  </body></html>;
}
