export interface SiteCollectionModel {
  /** Normalized route prefix without surrounding slashes. Empty means a flat route. */
  route: string
}

export interface SiteLocaleModel {
  /** M2 preserves the existing locale-neutral URL behavior. */
  strategy: 'none'
  defaultLocale?: string
}

export interface SiteModel {
  /** Normalized HTTP(S) origin without a trailing slash, or null when unavailable. */
  origin: string | null
  collections: Record<string, SiteCollectionModel>
  locale: SiteLocaleModel
}

export type CollectionRoutes = Record<string, string>

export const DEFAULT_COLLECTION_ROUTES: CollectionRoutes = { posts: 'posts' }

export interface CreateSiteModelOptions {
  origin?: string | null
  collections?: readonly string[]
  collectionRoutes?: CollectionRoutes
  defaultLocale?: string
}

export function normalizeRoute(value: string | null | undefined): string {
  return String(value ?? '').split(/[?#]/, 1)[0].split('/').filter(Boolean).join('/')
}

export function normalizeSiteOrigin(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.username || url.password) return null
    return url.origin
  } catch {
    return null
  }
}

export function createSiteModel(options: CreateSiteModelOptions = {}): SiteModel {
  const configuredRoutes = { ...DEFAULT_COLLECTION_ROUTES, ...(options.collectionRoutes ?? {}) }
  const slugs = new Set([...(options.collections ?? []), ...Object.keys(configuredRoutes)])
  const collections: Record<string, SiteCollectionModel> = {}
  for (const slug of slugs) {
    collections[slug] = { route: normalizeRoute(configuredRoutes[slug]) }
  }
  return {
    origin: normalizeSiteOrigin(options.origin),
    collections,
    locale: { strategy: 'none', ...(options.defaultLocale ? { defaultLocale: options.defaultLocale } : {}) },
  }
}
