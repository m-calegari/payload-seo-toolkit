import type { SeoConfig, SeoFeatures } from '../types.js'
import type { SeoPluginConfig } from './types.js'
import { capabilitiesToLegacyFeatures, createCapabilityRegistry, type SeoCapabilityRegistry } from './capabilities.js'

export interface NormalizedPluginConfig {
  targetCollections: string[]
  targetGlobals: string[]
  uploadsCollection: string
  basePath: string
  redirectsSlug: string
  allowExternalRedirects: boolean
  features: Required<SeoFeatures>
  capabilities: SeoCapabilityRegistry
  seoConfig: SeoConfig
  analyzerLocaleOptions: Pick<SeoPluginConfig, 'locale' | 'localeMapping'>
}

export function normalizeFeatures(features?: SeoFeatures): Required<SeoFeatures> {
  return capabilitiesToLegacyFeatures(createCapabilityRegistry({ features }))
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
  const capabilities = createCapabilityRegistry(pluginConfig)
  return {
    targetCollections: pluginConfig.collections ?? ['pages', 'posts'],
    targetGlobals: pluginConfig.globals ?? [],
    uploadsCollection: pluginConfig.uploadsCollection ?? 'media',
    basePath: pluginConfig.endpointBasePath ?? '/seo-plugin',
    redirectsSlug: pluginConfig.redirectsCollection ?? 'seo-redirects',
    allowExternalRedirects: pluginConfig.allowExternalRedirects === true,
    features: capabilitiesToLegacyFeatures(capabilities),
    capabilities,
    seoConfig: buildSeoConfig(pluginConfig),
    analyzerLocaleOptions: { locale: pluginConfig.locale, localeMapping: pluginConfig.localeMapping },
  }
}
