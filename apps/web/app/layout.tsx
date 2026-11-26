import type { Metadata } from 'next';
import descriptions from '@/core/i18n/toolDescriptions.json';
import { resolveServerLang } from '@/core/i18n/pageMeta';
import Shell from '@/core/shell/Shell';
import { htmlLang } from '@/core/i18n/config';
import './globals.css';
import './tools.css';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await resolveServerLang();
  return { title: 'SNTIQ Tools', description: descriptions[lang].tools };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await resolveServerLang();
  return <html lang={htmlLang(lang)} suppressHydrationWarning><body>
    <Shell initialLang={lang}>{children}</Shell>
  </body></html>;
}
