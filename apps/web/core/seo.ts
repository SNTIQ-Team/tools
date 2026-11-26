// Page metadata and structured data, shared by every route. Server-safe: no
// next/headers, no client code, so static `metadata` objects can use it too.
import type { Metadata } from 'next';
import { SITE_URL } from './config';

export const SITE_NAME = 'SNTIQ';
export const SITE_TAGLINE = 'Scaling & Networking Tools for Intelligence Quality';
export const SITE_DESCRIPTION =
  'SNTIQ builds open graphs in which every fact carries its source and its date, and tools in which every step can be checked.';
export const GITHUB_URL = 'https://github.com/SNTIQ-Team';
export const API_URL = 'https://api.sntiq.com/';

/** Title of the page as it appears in a share preview: the bare page name
 *  plus the site, or the site and its tagline for the home page. */
export const fullTitle = (title?: string) => (title ? `${title} | ${SITE_NAME}` : `${SITE_NAME}: ${SITE_TAGLINE}`);

interface PageMetaInput {
  /** Path of the canonical URL, starting with "/". */
  path: string;
  /** Bare page name; the root layout's template adds " | SNTIQ". Omit on the home page. */
  title?: string;
  description?: string;
  type?: 'website' | 'article';
}

/**
 * Canonical URL, og:url and the page's own preview title and description.
 * Without this every page shared the home page's og:title and description,
 * and only three pages declared a canonical at all.
 */
export function pageMeta({ path, title, description, type = 'website' }: PageMetaInput): Metadata {
  const url = `${SITE_URL}${path}`;
  const text = description ?? SITE_DESCRIPTION;
  const shareTitle = fullTitle(title);
  return {
    ...(title ? { title } : {}),
    description: text,
    alternates: { canonical: url },
    openGraph: { type, siteName: SITE_NAME, url, title: shareTitle, description: text },
    twitter: { card: 'summary_large_image', title: shareTitle, description: text },
  };
}

const ORG_ID = `${SITE_URL}/#organization`;

/** One module of Deutschland Together, described as the web application it is. */
export function moduleLd(name: string, path: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    url: `${SITE_URL}${path}`,
    description,
    applicationCategory: 'Legal',
    operatingSystem: 'Any (web browser)',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    isPartOf: { '@type': 'CreativeWork', name: 'Deutschland Together' },
    publisher: { '@id': ORG_ID },
  };
}

/** JSON for a <script type="application/ld+json">: `<` escaped so no value can close the tag. */
export const ldJson = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
