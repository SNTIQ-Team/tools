/**
 * Recipient resolution via the Taper API (api.sntiq.com).
 *
 * Response types mirror the FastAPI service (taper api/main.py)
 * exactly — do not "improve" field names here; fix them in the API if
 * they need fixing. Caveats returned by the resolver are ALWAYS passed
 * through to the UI; this module never filters them.
 *
 * Contact channel policy (docs/LEGAL-REVISION.md §8): authorities are
 * contacted fax/tracked-letter first; e-mail is supplementary. The
 * `contactChannels()` helper encodes that ordering so every component
 * renders it consistently.
 */

import { taperUrl } from '../../../core/config';
import type { RecipientKind } from './letters';

// ---------------------------------------------------------- API types

export interface AuthorityCard {
  id: number;
  kind: string;
  name: string;
  legal_form: string | null;
  street: string | null;
  plz: string | null;
  city: string | null;
  postal_address: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  web: string | null;
  hours: string | null;
  erv_note: string | null;
  valid_from: string | null;
  valid_to: string | null;
  external_ids: Record<string, string>;
  provenance: { source: string; url: string | null; fetched_at: string };
}

export interface Caveat {
  severity: string;
  text_de: string;
  source: string;
}

export interface PlaceMatch {
  ags: string;
  name: string;
  kind: string;
  kreis: string;
  land: string;
  plz_count: number;
  /** present when the query was a postal code — no PLZ prompt needed */
  plz?: string | null;
  explicit_postcode?: boolean;
  representative_plz?: string | null;
  /** typo-tolerant match (difflib) — UI shows a "did you mean" hint */
  fuzzy?: boolean;
}

export interface PlaceSearchResponse {
  query: string;
  query_kind?: 'postcode' | 'name';
  matches: PlaceMatch[];
  /** court-register places without a Gemeinde mapping (rare but real) */
  court_register_only: { plz: string; ort: string; ortk: string }[];
}

/** Only an exact postal-code search confirms a user's code. A name result
 * from older servers may still contain a representative MIN(plz). */
export function confirmedPostcode(place: PlaceMatch, query: string): string | null {
  const code = query.trim();
  return /^\d{5}$/.test(code) && place.plz === code && place.explicit_postcode !== false ? code : null;
}

export interface AuthorityResolution {
  gemeinde: string;
  kind: string;
  resolved: AuthorityCard | null;
  candidates: AuthorityCard[];
  supervisory: AuthorityCard[];
  caveats: Caveat[];
}

export interface CourtChainEntry extends AuthorityCard {
  position: number;
  role: string;
  note: string | null;
}

export type CourtResolution =
  | { needs_ort: true; options: { ort: string; ortk: string }[] }
  | {
      needs_ort?: undefined;
      place: { plz: string; ort: string };
      matter: string;
      chain: CourtChainEntry[];
      caveats: Caveat[];
    };

// ------------------------------------------------------------- client

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(taperUrl(path), { signal });
  if (!res.ok) {
    throw new ResolverError(res.status, await res.text().catch(() => ''));
  }
  return res.json() as Promise<T>;
}

export class ResolverError extends Error {
  constructor(public status: number, detail: string) {
    super(`taper resolver: HTTP ${status} ${detail}`.trim());
  }
}

export const searchPlaces = (q: string, signal?: AbortSignal) =>
  get<PlaceSearchResponse>(
    `/places?q=${encodeURIComponent(q)}&limit=10`, signal);

export const resolveAuthority = (
  ags: string, kind: string, signal?: AbortSignal,
) =>
  get<AuthorityResolution>(
    `/resolve/authority?ags=${encodeURIComponent(ags)}` +
    `&kind=${encodeURIComponent(kind)}`, signal);

export const resolveCourt = (
  plz: string, matter: string, ort?: string, signal?: AbortSignal,
) =>
  get<CourtResolution>(
    `/resolve/court?plz=${encodeURIComponent(plz)}` +
    `&matter=${encodeURIComponent(matter)}` +
    (ort ? `&ort=${encodeURIComponent(ort)}` : ''), signal);

// --------------------------------------------- per-letter resolution

export interface RecipientResolution {
  /** single resolved recipient, if unambiguous */
  recipient: AuthorityCard | null;
  /** multiple primaries — the user must pick (UI shows all, no guess) */
  candidates: AuthorityCard[];
  caveats: Caveat[];
  /** which strategy produced the result (for provenance display) */
  via: string;
  /** court resolution needs an Ort pick (one PLZ, several districts) */
  ortOptions?: { ort: string; ortk: string }[];
  /** supervisory authorities (rank 1) — shown alongside for escalation */
  supervisory?: AuthorityCard[];
}

/**
 * BAMF — static address incl. the Datenschutzbeauftragter (file-access
 * requests). Verified against the org's working template 12/2025.
 */
export const BAMF: AuthorityCard = {
  id: -2, kind: 'bamf',
  name: 'Bundesamt für Migration und Flüchtlinge - ' +
        'Der behördliche Datenschutzbeauftragte',
  legal_form: null, street: 'Frankenstraße 210', plz: '90461',
  city: 'Nürnberg', postal_address: null,
  phone: null, fax: '+49 911 943-10000',
  email: 'service@bamf.bund.de', web: 'https://www.bamf.de',
  hours: null, erv_note: null, valid_from: null, valid_to: null,
  external_ids: {},
  provenance: { source: 'static', url: 'https://www.bamf.de',
                fetched_at: '2025-12-17' },
};

/**
 * Resolve the recipient for a letter's RecipientKind at the user's
 * place (Gemeinde AGS + a PLZ of that Gemeinde).
 *
 * AsylbLG competence varies wildly across Germany (dedicated office /
 * Sozialamt / a department of it) — try the dedicated kind first and
 * fall back to sozialamt; the caveats explain local quirks.
 */
export async function resolveRecipient(
  kind: RecipientKind,
  place: { ags: string; plz: string; ort?: string },
  signal?: AbortSignal,
): Promise<RecipientResolution> {
  switch (kind) {
    case 'bamf':
      return { recipient: BAMF, candidates: [], caveats: [],
               via: 'static/bamf' };
    case 'any_authority':
      // the wizard asks the user which authority — no resolution here
      return { recipient: null, candidates: [], caveats: [],
               via: 'any_authority/pick' };
    case 'auslaenderbehoerde': {
      const r = await resolveAuthority(place.ags, 'auslaenderbehoerde', signal);
      return { recipient: r.resolved, candidates: r.candidates,
               caveats: r.caveats, via: 'auslaenderbehoerde',
               supervisory: r.supervisory };
    }
    case 'aufsichtsbehoerde': {
      const r = await resolveAuthority(place.ags, 'auslaenderbehoerde', signal);
      const sup = r.supervisory;
      return { recipient: sup.length === 1 ? sup[0] : null,
               candidates: sup.length > 1 ? sup : [],
               caveats: r.caveats, via: 'auslaenderbehoerde/supervisory' };
    }
    case 'jobcenter': {
      const r = await resolveAuthority(place.ags, 'jobcenter', signal);
      // Older directory snapshots can attach a BA carrier ID to an office
      // explicitly identified as SGB XII. Do not address an SGB II request there.
      const compatible = (card: AuthorityCard) =>
        !/\bSGB\s*XII\b/i.test(card.name) || /\b(?:Jobcenter|SGB\s*II)\b/i.test(card.name);
      return { recipient: r.resolved && compatible(r.resolved) ? r.resolved : null,
               candidates: r.candidates.filter(compatible),
               caveats: r.caveats, via: 'jobcenter' };
    }
    case 'asylblg_traeger': {
      try {
        const r = await resolveAuthority(place.ags, 'asylblg_behoerde', signal);
        return { recipient: r.resolved, candidates: r.candidates,
                 caveats: r.caveats, via: 'asylblg_behoerde' };
      } catch (e) {
        if (!(e instanceof ResolverError) || e.status !== 404) throw e;
      }
      const r = await resolveAuthority(place.ags, 'sozialamt', signal);
      return { recipient: r.resolved, candidates: r.candidates,
               caveats: r.caveats, via: 'sozialamt (asylblg fallback)' };
    }
    case 'verwaltungsgericht': {
      const r = await resolveCourt(place.plz, 'verwaltung', place.ort, signal);
      if ('options' in r) {
        // needs_ort: caller re-asks with an Ort from ortOptions
        return { recipient: null, candidates: [], caveats: [],
                 via: 'court/needs_ort', ortOptions: r.options };
      }
      const res = r as Extract<CourtResolution, { place: unknown }>;
      const vg = res.chain.find((c) => c.kind === 'verwaltungsgericht')
        ?? res.chain[0];
      return { recipient: vg ?? null, candidates: [],
               caveats: res.caveats, via: 'court/verwaltung' };
    }
  }
}

// ------------------------------------------------------ channel policy

export type Channel =
  | { type: 'fax'; value: string; preferred: true }
  | { type: 'post'; value: string[]; preferred: true; tracked: true }
  | { type: 'email'; value: string; preferred: false; supplementary: true };

/**
 * Ordered contact channels for an authority. Fax and tracked letter
 * come first — proof of access (Zugang) is what survives in court.
 * E-mail is returned last and flagged supplementary; the UI must render
 * the channel notice (i18n: chamfer.channels.notice) wherever these
 * are shown.
 */
/**
 * DIN address block: one fact per line. Source data is messy —
 * "Landratsamt Erding - Sachgebiet 31-3" must become two lines and
 * "Alois-Schießl-Platz 2 85435 Erding" must split before the PLZ.
 */
function postalLines(a: AuthorityCard): string[] {
  const raw = a.postal_address?.trim();
  const locality = [a.plz, a.city].filter(Boolean).join(' ');
  const lines = raw ? raw.split('\n') : [a.street ?? '', locality];
  return lines.map(line => line.trim()).filter(Boolean).flatMap(line => {
    if (a.kind === 'manual') return [line]; // preserve each user-entered address line
    // PVOG stores "Straße 1, 14469, Potsdam"; older courts also use
    // "Postfach 12 07 09 01008 Dresden". Keep the complete mailbox number.
    const match = line.match(/^(?:(.+?)[,\s]+)?(\d{5})[,\s]+(\p{L}.*)$/u);
    return match ? [match[1], match[2] + ' ' + match[3]].filter(Boolean) : [line];
  });
}

export function hasPostalAddress(a: AuthorityCard): boolean {
  const lines = postalLines(a);
  if (a.kind === 'manual') return lines.length > 0;
  // A directory's explicit mailing address can consist of a large-volume
  // recipient's dedicated postal code and city, without a street or Postfach.
  const hasLocality = lines.some(line => /^\d{5}\s+\p{L}/u.test(line));
  return hasLocality && Boolean(a.postal_address?.trim() || a.street?.trim());
}

export function addressLines(a: AuthorityCard): string[] {
  const name = a.name.split(/\s+-\s+/).map(s => s.trim()).filter(Boolean);
  return [...name, ...postalLines(a)];
}

export function contactChannels(a: AuthorityCard): Channel[] {
  const channels: Channel[] = [];
  if (a.fax) channels.push({ type: 'fax', value: a.fax, preferred: true });
  channels.push({ type: 'post', value: addressLines(a), preferred: true,
                  tracked: true });
  if (a.email) {
    channels.push({ type: 'email', value: a.email, preferred: false,
                    supplementary: true });
  }
  return channels;
}

/**
 * Recipient entered by hand — used when the place step was skipped or
 * the resolver is unreachable. Provenance 'manual' tells the UI to
 * render an "address entered manually, double-check it" note instead
 * of the dataset provenance line.
 */
export function manualAuthority(
  name: string, addressLines: string[], fax?: string,
): AuthorityCard {
  return {
    id: -1, kind: 'manual', name, legal_form: null,
    street: null, plz: null, city: null,
    postal_address: addressLines.map((l) => l.trim()).filter(Boolean)
      .join('\n'),
    phone: null, fax: fax?.trim() || null, email: null, web: null,
    hours: null, erv_note: null, valid_from: null, valid_to: null,
    external_ids: {},
    provenance: { source: 'manual', url: null, fetched_at: '' },
  };
}
