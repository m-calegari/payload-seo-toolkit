/**
 * Payload CMS SEO Analyzer Plugin composition root.
 *
 * Adds SEO analysis capabilities to any Payload CMS project:
 * - SEO fields (focusKeyword, focusKeywords, isCornerstone) on target collections
 * - SeoAnalyzer UI component in the editor sidebar (real-time SEO scoring)
 * - SEO dashboard admin view at /admin/seo
 * - API endpoints for validation, keyword dedup, and audit
 *
 * Usage:
 *   import { seoAnalyzerPlugin } from '@consilioweb/payload-seo-analyzer'
 *
 *   export default buildConfig({
 *     plugins: [
 *       seoAnalyzerPlugin({ collections: ['pages', 'posts'] }),
 *     ],
 *   })
 *
 * Note: The legacy name `seoPlugin` is still available as an alias for
 * backward compatibility, but `seoAnalyzerPlugin` is preferred to avoid
 * naming conflicts with `@payloadcms/plugin-seo`.
 */

import type { Config, Plugin } from 'payload'
import type { SeoPluginConfig } from './types.js'
import { normalizePluginConfig } from './config.js'
import { registerAdmin } from './registerAdmin.js'
import { registerCollections } from './registerCollections.js'
import { registerEndpoints } from './registerEndpoints.js'
import { registerLifecycle } from './registerLifecycle.js'
export type { GenerateFnArgs, SeoPluginConfig } from './types.js'
export type { SeoModuleId, SeoIntegrationId, SeoBackgroundServiceId, SeoCapabilityStatus } from './capabilities.js'

export const seoAnalyzerPlugin =
  (pluginConfig: SeoPluginConfig = {}): Plugin =>
  (incomingConfig: Config): Config => {
    const config = { ...incomingConfig }
    const normalized = normalizePluginConfig(pluginConfig)
    const {
      targetCollections,
      uploadsCollection,
      targetGlobals,
      basePath,
      seoConfig,
      analyzerLocaleOptions,
      features,
      redirectsSlug,
      allowExternalRedirects,
    } = normalized

    registerCollections(config, pluginConfig, normalized)
    registerEndpoints(config, pluginConfig, normalized)

    registerAdmin(config, pluginConfig, features, normalized.capabilities)
    registerLifecycle(config, {
      basePath,
      targetCollections,
      targetGlobals,
      seoConfig,
      capabilities: normalized.capabilities,
      pluginConfig,
    })

    return config
  }

/** @deprecated Use `seoAnalyzerPlugin` instead. Kept for backward compatibility. */
export { seoAnalyzerPlugin as seoPlugin }
