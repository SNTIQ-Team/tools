type ActSource = { id: string; juris: string; jurabk: string; source_url?: string | null; permalink?: string | null; stand?: string | null };
const GII_ALIASES: Record<string, string> = { rustag: 'stag', azrg_dv: 'azrg-dv', vwdg_dv: 'vwdg-dv' };

export function officialActSource(act: ActSource): string | null {
  if (act.juris === 'EU') {
    const celex = /^eu_([a-z0-9]+)$/iu.exec(act.id)?.[1].toUpperCase();
    const base = /^https:\/\/eur-lex\.europa\.eu\/legal-content\/DE\/TXT\/\?uri=CELEX:([A-Z0-9]+)$/u.exec(act.source_url ?? '');
    if (!celex || base?.[1] !== celex) return null;
    const edition = /^0([0-9]{4}[A-Z][0-9]{4})-([0-9]{8})$/u.exec(act.stand ?? '');
    return edition && celex === `3${edition[1]}`
      ? `https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:${edition[0]}`
      : act.source_url!;
  }
  if (act.juris === 'DE' && /^fed_[a-z0-9][a-z0-9_-]*$/u.test(act.id)) {
    if (act.source_url != null) {
      return /^https:\/\/www\.gesetze-im-internet\.de\/[a-z0-9][a-z0-9_-]*\/$/u.test(act.source_url)
        ? act.source_url : null;
    }
    const slug = act.id.slice(4);
    return `https://www.gesetze-im-internet.de/${GII_ALIASES[slug] ?? slug}/`;
  }
  if (act.juris === 'DE-BY' && act.permalink && /^https:\/\/www\.gesetze-bayern\.de\/Content\/Document\/[A-Za-z0-9_-]+$/u.test(act.permalink)) return act.permalink;
  if (act.juris === 'DE-BY') return `https://www.gesetze-bayern.de/Search?q=${encodeURIComponent(act.jurabk)}`;
  return null;
}
