import type { AgAuthority } from './client';

/**
 * Contact details for the small, curated EU layer in Taper.
 *
 * The graph API intentionally keeps authority topology separate from this
 * frontend.  Until its EU rows carry contacts, enrich only the known stable
 * IDs here.  Every value below is copied from the institution's own current
 * contact page; absent email/fax values stay absent rather than being guessed.
 */
export interface AgContactSource {
  label: string;
  url: string;
}

export interface AgVerifiedContact {
  contact_sources: AgContactSource[];
  contact_verified_at: string;
  /** The Courts explicitly say that fax is no longer used. */
  fax_unavailable_reason?: 'not_used';
}

type ContactKey = 'street' | 'plz' | 'city' | 'postal_address' |
  'phone' | 'fax' | 'email' | 'web';
type ContactPatch = Partial<Pick<AgAuthority, ContactKey>> &
  AgVerifiedContact;

const VERIFIED_AT = '2026-07-15';

export const EU_CONTACTS: Readonly<Record<number, ContactPatch>> = {
  19950: {
    street: 'Rue Wiertz / Wiertzstraat 60',
    plz: 'B-1047',
    city: 'Bruxelles / Brussel',
    phone: '+32 2 284 21 11',
    email: 'epbrussels@europarl.europa.eu',
    web: 'https://www.europarl.europa.eu/portal/en/contact',
    contact_sources: [{
      label: 'European Parliament · Contact',
      url: 'https://www.europarl.europa.eu/portal/en/contact',
    }],
    contact_verified_at: VERIFIED_AT,
  },
  // The European Council and Council of the EU share the Brussels premises
  // and public switchboard run by the General Secretariat of the Council.
  19951: {
    street: 'Rue de la Loi / Wetstraat 175',
    plz: 'B-1048',
    city: 'Bruxelles / Brussel',
    phone: '+32 2 281 61 11',
    fax: '+32 2 281 69 34',
    web: 'https://www.consilium.europa.eu/en/contact/',
    contact_sources: [{
      label: 'Council of the EU · Address',
      url: 'https://www.consilium.europa.eu/en/contact/address/',
    }],
    contact_verified_at: VERIFIED_AT,
  },
  19952: {
    street: 'Rue de la Loi / Wetstraat 175',
    plz: 'B-1048',
    city: 'Bruxelles / Brussel',
    phone: '+32 2 281 61 11',
    fax: '+32 2 281 69 34',
    web: 'https://www.consilium.europa.eu/en/contact/',
    contact_sources: [{
      label: 'Council of the EU · Address',
      url: 'https://www.consilium.europa.eu/en/contact/address/',
    }],
    contact_verified_at: VERIFIED_AT,
  },
  19953: {
    street: 'Rue de la Loi / Wetstraat 200',
    plz: '1049',
    city: 'Brussels',
    phone: '+32 2 299 11 11',
    web: 'https://commission.europa.eu/about/contact_en',
    contact_sources: [{
      label: 'European Commission · Contact',
      url: 'https://commission.europa.eu/about/contact_en',
    }],
    contact_verified_at: VERIFIED_AT,
  },
  19954: {
    postal_address: 'Court of Justice of the European Union\nL-2925 Luxembourg',
    city: 'Luxembourg',
    phone: '+352 4303-1',
    web: 'https://curia.europa.eu/site/jcms/d2_5186/en/contact',
    contact_sources: [{
      label: 'Court of Justice of the EU · Contact',
      url: 'https://curia.europa.eu/site/jcms/d2_5186/en/contact',
    }],
    contact_verified_at: VERIFIED_AT,
  },
  19955: {
    postal_address: 'Registry of the Court of Justice\nRue du Fort Niedergrünewald\nL-2925 Luxembourg',
    city: 'Luxembourg',
    phone: '+352 4303-1',
    email: 'ECJ.Registry@curia.europa.eu',
    web: 'https://curia.europa.eu/site/jcms/d2_5109/en/',
    contact_sources: [{
      label: 'Court of Justice · Lodging documents',
      url: 'https://curia.europa.eu/site/jcms/d2_5109/en/',
    }],
    contact_verified_at: VERIFIED_AT,
    fax_unavailable_reason: 'not_used',
  },
  19956: {
    postal_address: 'Registry of the General Court of the European Union\nRue du Fort Niedergrünewald\nL-2925 Luxembourg',
    city: 'Luxembourg',
    phone: '+352 4303-1',
    email: 'GC.Registry@curia.europa.eu',
    web: 'https://curia.europa.eu/site/jcms/d2_5108/en/',
    contact_sources: [{
      label: 'General Court · Lodging documents',
      url: 'https://curia.europa.eu/site/jcms/d2_5108/en/',
    }],
    contact_verified_at: VERIFIED_AT,
    fax_unavailable_reason: 'not_used',
  },
  19957: {
    postal_address: 'European Central Bank\n60640 Frankfurt am Main\nGermany',
    city: 'Frankfurt am Main',
    phone: '+49 69 1344 0',
    web: 'https://www.ecb.europa.eu/ecb/contacts/html/index.en.html',
    contact_sources: [
      {
        label: 'ECB · Contacts',
        url: 'https://www.ecb.europa.eu/ecb/contacts/html/index.en.html',
      },
      {
        label: 'ECB · Postal and delivery addresses',
        url: 'https://www.ecb.europa.eu/ecb/contacts/address/html/index.en.html',
      },
    ],
    contact_verified_at: VERIFIED_AT,
  },
  19958: {
    street: '12, rue Alcide De Gasperi',
    plz: 'L-1615',
    city: 'Luxembourg',
    phone: '+352 4398-1',
    email: 'eca-info@eca.europa.eu',
    web: 'https://www.eca.europa.eu/en/contact',
    contact_sources: [
      {
        label: 'European Court of Auditors · Contact',
        url: 'https://www.eca.europa.eu/en/contact',
      },
      {
        label: 'European Court of Auditors · Current visitor notice',
        url: 'https://www.eca.europa.eu/ContentPagesDocuments/Privacy_statements/Visiting_the_Court/Privacy-statement-visitors_EN.pdf',
      },
    ],
    contact_verified_at: VERIFIED_AT,
  },
  19959: {
    postal_address: 'European Ombudsman\n1 avenue du Président Robert Schuman\nCS 30403\nF-67001 Strasbourg Cedex',
    city: 'Strasbourg',
    phone: '+33 3 88 17 23 13',
    email: 'eo@ombudsman.europa.eu',
    web: 'https://www.ombudsman.europa.eu/contacts',
    contact_sources: [
      {
        label: 'European Ombudsman · Contacts',
        url: 'https://www.ombudsman.europa.eu/contacts',
      },
      {
        label: 'European Ombudsman · Annual report 2024',
        url: 'https://www.ombudsman.europa.eu/publication/202253',
      },
    ],
    contact_verified_at: VERIFIED_AT,
  },
  19960: {
    postal_address: 'European Data Protection Supervisor\nRue Wiertz 60\nB-1047 Brussels',
    city: 'Brussels',
    phone: '+32 2 283 19 00',
    email: 'edps@edps.europa.eu',
    web: 'https://www.edps.europa.eu/about-edps/contact_en',
    contact_sources: [{
      label: 'European Data Protection Supervisor · Contact',
      url: 'https://www.edps.europa.eu/about-edps/contact_en',
    }],
    contact_verified_at: VERIFIED_AT,
  },
};

export type AgAuthorityWithVerifiedContact<T extends AgAuthority = AgAuthority> =
  T & Partial<AgVerifiedContact>;

/**
 * API contact values win once the backend starts publishing an actual contact
 * record.  Its current EU rows contain only broad multi-seat `city` labels;
 * those must not be combined with a verified single-office street address.
 */
export function enrichEuContact<T extends AgAuthority>(
  authority: T,
): AgAuthorityWithVerifiedContact<T> {
  const patch = EU_CONTACTS[authority.id];
  if (!patch) return authority;
  const apiHasContact = Boolean(
    authority.street || authority.postal_address || authority.phone ||
    authority.fax || authority.email,
  );
  const present = <K extends ContactKey>(key: K) => apiHasContact
    ? authority[key] ?? patch[key]
    : patch[key] ?? authority[key];
  return {
    ...authority,
    street: present('street'),
    plz: present('plz'),
    city: present('city'),
    postal_address: present('postal_address'),
    phone: present('phone'),
    fax: present('fax'),
    email: present('email'),
    web: present('web'),
    contact_sources: patch.contact_sources,
    contact_verified_at: patch.contact_verified_at,
    fax_unavailable_reason: patch.fax_unavailable_reason,
  };
}
