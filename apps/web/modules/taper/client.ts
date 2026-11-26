/**
 * Thin client for the Taper API (api.sntiq.com/taper) — independent of
 * the Chamfer module on purpose: the viewer browses the raw graph,
 * Chamfer consumes resolved recipients.
 */

import { taperUrl } from '../../core/config';
import { normaliseAuthorityKind } from './authorityKind';
import { enrichEuContact } from './euContacts';

export interface AgPlace {
  ags: string;
  name: string;
  kind: string;
  kreis: string;
  land: string;
  plz_count: number;
  plz?: string | null;
  explicit_postcode?: boolean;
  representative_plz?: string | null;
  fuzzy?: boolean;
}

export interface AgAuthority {
  id: number;
  kind: string;
  name: string;
  street: string | null;
  plz: string | null;
  city: string | null;
  postal_address: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  web: string | null;
  external_ids: Record<string, string>;
  provenance: { source: string; url: string | null; fetched_at: string };
  /** Frontend-verified EU contact sources until the API rows carry them. */
  contact_sources?: { label: string; url: string }[];
  contact_verified_at?: string;
  fax_unavailable_reason?: 'not_used';
}

export interface AgEdge {
  relation: string;
  matter: string | null;
  note?: string | null;
  source?: string | null;
  source_url?: string | null;
  id: number;
  name: string;
  kind: string;
}

export interface AgDetail extends AgAuthority {
  related: AgEdge[];
  /** Edges whose target is this node; counterpart `id` is the source. */
  related_incoming?: AgEdge[];
}

export interface AgCaveat { severity: string; text_de: string; source: string }

export interface AgResolution {
  /** typed outcome: ok | ambiguous_identity | partial | … */
  status?: string;
  /** several rank-0 offices: the API selects none of them */
  ambiguity?: string;
  gemeinde: string;
  kind: string;
  resolved: AgAuthority | null;
  candidates: AgAuthority[];
  supervisory: AgAuthority[];
  caveats: AgCaveat[];
}

export interface AgMatter {
  code: string; label_de: string; grp: string; core: number;
}

export interface AgChainEntry extends AgAuthority {
  position: number; role: string; note: string | null;
}

export class AgHttpError extends Error {
  constructor(public status: number) {
    super(`taper: HTTP ${status}`);
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(taperUrl(path), { signal });
  if (!res.ok) throw new AgHttpError(res.status);
  return res.json() as Promise<T>;
}

export const agSearchPlaces = async (q: string, signal?: AbortSignal) => {
  const result = await get<{ matches: AgPlace[] }>(
    `/places?q=${encodeURIComponent(q)}&limit=10`, signal);
  const code = q.trim();
  return { ...result, matches: result.matches.map(place => ({ ...place,
    // Old APIs return MIN(plz) for names; never use it as the user's code.
    plz: /^\d{3,5}$/.test(code) && /^\d{5}$/.test(place.plz ?? '') &&
      place.plz?.startsWith(code) && (place.explicit_postcode === true ||
        (code === place.plz && place.explicit_postcode !== false)) ? place.plz : null,
  })) };
};

export const agResolve = (ags: string, kind: string, signal?: AbortSignal) =>
  get<AgResolution>(
    `/resolve/authority?ags=${ags}&kind=${kind}`, signal);

export const normaliseAgDetail = (detail: AgDetail): AgDetail => ({
  ...detail,
  kind: normaliseAuthorityKind(
    detail.kind,
    detail.name,
    detail.related.some((edge) =>
      edge.relation === 'parent' && edge.id !== detail.id),
  ),
});

export const agDetail = async (id: number, signal?: AbortSignal) =>
  normaliseAgDetail(
    enrichEuContact(await get<AgDetail>(`/authorities/${id}`, signal)),
  );

export const agMatters = (signal?: AbortSignal) =>
  get<AgMatter[]>('/matters', signal);

export interface CourtLocality { ort: string; ortk: string; place_id?: string }
interface CourtResult {
  status?: string;
  needs_ort?: boolean;
  options?: CourtLocality[];
  place?: CourtLocality;
  chain?: AgChainEntry[];
  caveats?: AgCaveat[];
  missingPlace?: boolean;
}

async function courtResult<T extends { status?: string }>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(taperUrl(path), { signal });
  if (res.ok) return res.json();
  if (res.status === 404) {
    const item: T | null = await res.json().catch(() => null);
    if (item?.status === 'not_found_in_searched_scope') return item;
  }
  throw new AgHttpError(res.status);
}

export const agCourtChain = async (
  plz: string, matter: string, ort?: string, signal?: AbortSignal,
  ortk?: string,
): Promise<CourtResult> => {
  const result = await courtResult<CourtResult>(
    `/resolve/court?plz=${plz}&matter=${matter}` +
    (ort ? `&ort=${encodeURIComponent(ort)}` : '') +
    // the register key disambiguates places that share a display name
    (ortk ? `&ortk=${encodeURIComponent(ortk)}` : ''), signal);
  if (result.status !== 'not_found_in_searched_scope' || result.place || !ort) return result;
  // Municipal and court registers may use different names for the same postcode.
  // Offer the register identity for confirmation before displaying a chain.
  const byPostcode = await courtResult<CourtResult>(
    `/resolve/court?plz=${plz}&matter=${matter}`, signal);
  const options = byPostcode.place ? [byPostcode.place] : byPostcode.options ?? [];
  return options.length ? { needs_ort: true, options } : { ...result, missingPlace: true };
};

/** authority kinds the place view queries in parallel */
export const VIEW_KINDS = [
  'auslaenderbehoerde', 'sozialamt', 'asylblg_behoerde', 'jobcenter',
  'jugendamt', 'wohngeldstelle', 'standesamt',
] as const;
