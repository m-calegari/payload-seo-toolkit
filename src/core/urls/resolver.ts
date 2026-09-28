import type { CollectionRoutes, SiteModel } from './siteModel.js'
import { createSiteModel, normalizeRoute } from './siteModel.js'

export interface DocumentUrlIdentity {
  collection: string
  slug?: string | null
  /** Carried for future locale strategies; M2 intentionally leaves paths locale-neutral. */
  locale?: string | null
}

export interface CanonicalUrlInput {
  identity: DocumentUrlIdentity
  explicitCanonical?: string | null
}

function documentSegments(model: SiteModel, identity: DocumentUrlIdentity): string[] {
  const slug = normalizeRoute(identity.slug)
  if (!slug || slug === 'home') return []
  const route = model.collections[identity.collection]?.route ?? ''
  if (!route) return slug.split('/')
  if (slug === route || slug.startsWith(`${route}/`)) return slug.split('/')
  return [...route.split('/'), ...slug.split('/')]
}

export function resolveDocumentPath(model: SiteModel, identity: DocumentUrlIdentity): string {
  const segments = documentSegments(model, identity)
  return segments.length ? `/${segments.join('/')}` : '/'
}

export function resolveDocumentUrl(model: SiteModel, identity: DocumentUrlIdentity): string | null {
  if (!model.origin) return null
  const path = resolveDocumentPath(model, identity)
  return path === '/' ? model.origin : `${model.origin}${path}`
}

function resolveCanonicalOverride(model: SiteModel, value: string): string | null {
  const candidate = value.trim()
  if (!candidate) return null
  try {
    const absolute = new URL(candidate)
    if (absolute.protocol !== 'http:' && absolute.protocol !== 'https:') return null
    return absolute.toString()
  } catch {
    if (!model.origin) return null
    if (candidate.startsWith('//')) return null
    try {
      const resolved = new URL(candidate.startsWith('/') ? candidate : `/${candidate}`, `${model.origin}/`)
      return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.toString() : null
    } catch {
      return null
    }
  }
}

export function resolveCanonicalUrl(model: SiteModel, input: CanonicalUrlInput): string | null {
  if (input.explicitCanonical) {
    const override = resolveCanonicalOverride(model, input.explicitCanonical)
    if (override) return override
  }
  return resolveDocumentUrl(model, input.identity)
}

/** Collection-aware reverse match used for GSC page URLs. */
export function matchDocumentIdentityFromPath(
  model: SiteModel,
  pathname: string,
  collections: readonly string[],
): DocumentUrlIdentity | null {
  const normalized = `/${normalizeRoute(pathname)}`
  const candidates = collections.map((collection) => {
    const route = model.collections[collection]?.route ?? ''
    const prefix = route ? `/${route}` : ''
    if (prefix && normalized !== prefix && !normalized.startsWith(`${prefix}/`)) return null
    const slugPath = prefix ? normalized.slice(prefix.length) : normalized
    const slug = normalizeRoute(slugPath) || 'home'
    return { collection, slug, routeLength: route.length }
  }).filter((candidate): candidate is { collection: string; slug: string; routeLength: number } => !!candidate)

  if (!candidates.length) return null
  candidates.sort((a, b) => b.routeLength - a.routeLength || a.collection.localeCompare(b.collection))
  const best = candidates[0]
  const tied = candidates.filter((candidate) => candidate.routeLength === best.routeLength)
  if (tied.length > 1 && best.routeLength === 0) return null
  return { collection: best.collection, slug: best.slug }
}

/** Legacy route-map adapter; new code should create a SiteModel once. */
export function siteModelFromRoutes(origin: string | null, routes?: CollectionRoutes): SiteModel {
  return createSiteModel({ origin, collectionRoutes: routes })
}
