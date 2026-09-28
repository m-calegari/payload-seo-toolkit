import { createSiteModel, DEFAULT_COLLECTION_ROUTES } from './siteModel.js'
import type { CollectionRoutes } from './siteModel.js'
import { resolveDocumentPath, resolveDocumentUrl } from './resolver.js'

export { DEFAULT_COLLECTION_ROUTES }
export type { CollectionRoutes }

export function getCollectionRoute(collectionSlug?: string, routes?: CollectionRoutes): string {
  if (!collectionSlug) return ''
  return createSiteModel({ collections: [collectionSlug], collectionRoutes: routes }).collections[collectionSlug]?.route ?? ''
}

/** Compatibility wrapper. Root documents historically return an empty path. */
export function buildDocPath(slug: string, collectionSlug?: string, routes?: CollectionRoutes): string {
  const model = createSiteModel({ collections: collectionSlug ? [collectionSlug] : [], collectionRoutes: routes })
  const path = resolveDocumentPath(model, { collection: collectionSlug ?? '', slug })
  return path === '/' ? '' : path
}

/** Compatibility wrapper around the canonical resolver. */
export function buildDocUrl(siteUrl: string, slug: string, collectionSlug?: string, routes?: CollectionRoutes): string {
  const model = createSiteModel({ origin: siteUrl, collections: collectionSlug ? [collectionSlug] : [], collectionRoutes: routes })
  return resolveDocumentUrl(model, { collection: collectionSlug ?? '', slug }) ?? ''
}
