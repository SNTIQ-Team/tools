import type { AgAuthority } from './client';
import { enrichEuContact, EU_CONTACTS } from './euContacts';

const ids = Array.from({ length: 11 }, (_, i) => 19950 + i);
for (const id of ids) {
  const patch = EU_CONTACTS[id];
  if (!patch) throw new Error(`EU authority ${id} has no verified contact`);
  if (!(patch.postal_address || (patch.street && patch.city))) {
    throw new Error(`EU authority ${id} has no official address`);
  }
  if (!patch.phone) throw new Error(`EU authority ${id} has no phone`);
  if (!patch.contact_sources.length ||
      patch.contact_sources.some((source) => !source.url.startsWith('https://'))) {
    throw new Error(`EU authority ${id} has invalid provenance`);
  }
}

const raw: AgAuthority = {
  id: 19950,
  kind: 'eu_institution',
  name: 'Europäisches Parlament',
  street: null,
  plz: null,
  city: 'API broad multi-seat city',
  postal_address: null,
  phone: null,
  fax: null,
  email: null,
  web: null,
  external_ids: {},
  provenance: { source: 'eu_curated', url: null, fetched_at: '2026-07-14' },
};
const enriched = enrichEuContact(raw);
if (enriched.city !== 'Bruxelles / Brussel') {
  throw new Error('broad API city corrupted the verified office address');
}
if (enriched.email !== 'epbrussels@europarl.europa.eu' ||
    !enriched.contact_sources?.length) {
  throw new Error('verified Parliament contact was not applied');
}
const backendContact = enrichEuContact({
  ...raw,
  city: 'Backend contact city',
  phone: '+1 API',
});
if (backendContact.city !== 'Backend contact city' ||
    backendContact.phone !== '+1 API') {
  throw new Error('frontend enrichment overwrote a real API contact');
}
if (EU_CONTACTS[19955].fax_unavailable_reason !== 'not_used' ||
    EU_CONTACTS[19956].fax_unavailable_reason !== 'not_used') {
  throw new Error('court fax deprecation must remain explicit');
}

console.log('EU contact enrichment regression OK');
