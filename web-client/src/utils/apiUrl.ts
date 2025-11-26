// Implemented for specs: agent/specs/meal-appointment-view-appointment-frontend-spec.md, agent/specs/meal-appointment-participation-frontend-implementation-spec.md

const RELATIVE_ORIGIN_FALLBACK = 'http://localhost';

function resolveOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  if (typeof globalThis !== 'undefined' && 'location' in globalThis && globalThis.location?.origin) {
    return globalThis.location.origin as string;
  }

  return RELATIVE_ORIGIN_FALLBACK;
}

export function buildApiUrl(apiBaseUrl: string, path: string): URL {
  const trimmedPath = path.replace(/^\/+/, '');
  const normalizedBase = apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`;
  const absoluteBase = /^https?:\/\//i.test(normalizedBase)
    ? normalizedBase
    : new URL(normalizedBase, resolveOrigin()).toString();

  return new URL(trimmedPath, absoluteBase);
}
