/** Intentional public boundary for existing URL primitives. */
export {
  buildDocPath,
  buildDocUrl,
  DEFAULT_COLLECTION_ROUTES,
  getCollectionRoute,
} from './docUrl.js'
export type { CollectionRoutes } from './docUrl.js'
export { createSiteModel, normalizeRoute, normalizeSiteOrigin } from './siteModel.js'
export type { CreateSiteModelOptions, SiteCollectionModel, SiteLocaleModel, SiteModel } from './siteModel.js'
export {
  matchDocumentIdentityFromPath,
  resolveCanonicalUrl,
  resolveDocumentPath,
  resolveDocumentUrl,
} from './resolver.js'
export type { CanonicalUrlInput, DocumentUrlIdentity } from './resolver.js'
