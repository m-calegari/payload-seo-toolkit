import type { SeoConfig, SeoFeatures } from '../types.js'
import type { SeoPluginConfig } from './types.js'

export interface NormalizedPluginConfig {
  targetCollections: string[]
  targetGlobals: string[]
  uploadsCollection: string
  basePath: string
  redirectsSlug: string
  allowExternalRedirects: boolean
  features: Required<SeoFeatures>
  seoConfig: SeoConfig
  analyzerLocaleOptions: Pick<SeoPluginConfig, 'locale' | 'localeMapping'>
}

export function normalizeFeatures(features?: SeoFeatures): Required<SeoFeatures> {
  return {
    analyzer: true,
    dashboard: true,
    redirects: true,
    performance: true,
    linkGraph: true,
    keywords: true,
    cannibalization: true,
    schemaBuilder: true,
    sitemapAudit: true,
    seoLogs: true,
    scoreHistory: true,
    externalLinks: true,
    aiFeatures: true,
    duplicateContent: true,
    settings: true,
    gscApi: false,
    warmCache: true,
    alerts: false,
    indexNow: false,
    ...features,
  }
}

export function buildSeoConfig(pluginConfig: SeoPluginConfig): SeoConfig {
  return {
    ...(pluginConfig.localSeoSlugs && { localSeoSlugs: pluginConfig.localSeoSlugs }),
    ...(pluginConfig.siteName && { siteName: pluginConfig.siteName }),
    ...(pluginConfig.siteUrl && { siteUrl: pluginConfig.siteUrl }),
    ...(pluginConfig.disabledRules && { disabledRules: pluginConfig.disabledRules }),
    ...(pluginConfig.overrideWeights && { overrideWeights: pluginConfig.overrideWeights }),
    ...(pluginConfig.thresholds && { thresholds: pluginConfig.thresholds }),
    ...(pluginConfig.locale && { locale: pluginConfig.locale }),
    ...(pluginConfig.localeMapping && { localeMapping: pluginConfig.localeMapping }),
    ...(pluginConfig.collectionRoutes && { collectionRoutes: pluginConfig.collectionRoutes }),
  }
}

export function normalizePluginConfig(pluginConfig: SeoPluginConfig): NormalizedPluginConfig {
  return {
    targetCollections: pluginConfig.collections ?? ['pages', 'posts'],
    targetGlobals: pluginConfig.globals ?? [],
    uploadsCollection: pluginConfig.uploadsCollection ?? 'media',
    basePath: pluginConfig.endpointBasePath ?? '/seo-plugin',
    redirectsSlug: pluginConfig.redirectsCollection ?? 'seo-redirects',
    allowExternalRedirects: pluginConfig.allowExternalRedirects === true,
    features: normalizeFeatures(pluginConfig.features),
    seoConfig: buildSeoConfig(pluginConfig),
    analyzerLocaleOptions: { locale: pluginConfig.locale, localeMapping: pluginConfig.localeMapping },
  }
}
