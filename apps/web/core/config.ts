export const SITE_URL = 'https://sntiq.com';

export const KERF_API_BASE_URL =
  process.env.NEXT_PUBLIC_KERF_API_BASE_URL ?? 'https://api.sntiq.com/kerf';
export const TAPER_API_BASE_URL =
  process.env.NEXT_PUBLIC_TAPER_API_BASE_URL ?? 'https://api.sntiq.com/taper';
export const CHAMFER_API_BASE_URL =
  process.env.NEXT_PUBLIC_CHAMFER_API_BASE_URL ?? 'https://api.sntiq.com/chamfer';

const serviceUrl = (base: string, path: string) =>
  `${base}${path.startsWith('/') ? path : `/${path}`}`;

export const kerfUrl = (path: string) => serviceUrl(KERF_API_BASE_URL, path);
export const taperUrl = (path: string) => serviceUrl(TAPER_API_BASE_URL, path);
export const chamferUrl = (path: string) => serviceUrl(CHAMFER_API_BASE_URL, path);

