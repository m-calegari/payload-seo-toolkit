import type { SeoConfig } from '../types.js'
import { createSiteModel, normalizeSiteOrigin, type SiteModel } from '../core/urls/siteModel.js'

export interface SiteEnvironment {
  NEXT_PUBLIC_SERVER_URL?: string
  PAYLOAD_PUBLIC_SERVER_URL?: string
  SERVER_URL?: string
}

/** Single runtime precedence for every public SEO URL producer. */
export function resolveSiteModel(
  seoConfig?: SeoConfig,
  collections: readonly string[] = [],
  environment: SiteEnvironment = process.env as SiteEnvironment,
): SiteModel {
  const origin = [
    seoConfig?.siteUrl,
    environment.NEXT_PUBLIC_SERVER_URL,
    environment.PAYLOAD_PUBLIC_SERVER_URL,
    environment.SERVER_URL,
  ].map(normalizeSiteOrigin).find((candidate): candidate is string => candidate !== null) ?? null
  return createSiteModel({
    origin,
    collections,
    collectionRoutes: seoConfig?.collectionRoutes,
    defaultLocale: seoConfig?.locale,
  })
}
