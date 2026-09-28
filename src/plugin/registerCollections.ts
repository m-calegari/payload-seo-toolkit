import type { Config, Field } from 'payload'
import { seoFields } from '../fields.js'
import { metaFields } from '../metaFields.js'
import { createSeoScoreHistoryCollection } from '../collections/SeoScoreHistory.js'
import { createSeoPerformanceCollection } from '../collections/SeoPerformance.js'
import { createSeoSettingsCollection } from '../collections/SeoSettings.js'
import { createSeoRedirectsCollection } from '../collections/SeoRedirects.js'
import { createSeoLogsCollection } from '../collections/SeoLogs.js'
import { createSeoGscAuthCollection } from '../collections/SeoGscAuth.js'
import { createSeoRankHistoryCollection } from '../collections/SeoRankHistory.js'
import type { SeoPluginConfig } from './types.js'
import type { NormalizedPluginConfig } from './config.js'
import { registerCollectionHooks, registerGlobalHooks } from './registerHooks.js'
import { hasCompatiblePayloadSeoMeta } from '../payload/compatibility/payloadSeo.js'

/** Register fields, hooks, and plugin-managed collections without owning composition. */
export function registerCollections(
  config: Config,
  pluginConfig: SeoPluginConfig,
  normalized: NormalizedPluginConfig,
): void {
  const {
    targetCollections,
    targetGlobals,
    basePath,
    seoConfig,
    analyzerLocaleOptions,
    features,
    redirectsSlug,
    allowExternalRedirects,
  } = normalized
  // Build meta fields config
  const metaFieldsConfig = {
    uploadsCollection: pluginConfig.uploadsCollection ?? 'media',
    interfaceName: pluginConfig.interfaceName,
    hasGenerateTitle: !!pluginConfig.generateTitle,
    hasGenerateDescription: !!pluginConfig.generateDescription,
    hasGenerateImage: !!pluginConfig.generateImage,
    basePath: `/api${basePath}`,
  }
  
  // Build meta fields with optional user override
  function buildMetaFields(): Field[] {
    const defaults = metaFields(metaFieldsConfig)
    if (!pluginConfig.fields) return defaults
    // defaults is [{ name: 'meta', type: 'group', fields: [...] }]
    // Extract inner fields from the meta group, let user override, then re-wrap
    const metaGroup = defaults[0] as Record<string, unknown>
    const innerFields = (metaGroup.fields || []) as Field[]
    const overridden = pluginConfig.fields({ defaultFields: innerFields })
    return [{ ...metaGroup, fields: overridden } as Field]
  }
  
  const trackHistory = pluginConfig.trackScoreHistory !== false && features.scoreHistory
  
  // Helper: build the final fields array, optionally wrapping in tabs
  function assembleFields(
    existingFields: Field[],
    fieldsToAdd: Field[],
    options?: { label?: string; isAuth?: boolean },
  ): Field[] {
    if (!pluginConfig.tabbedUI) {
      return [...existingFields, ...fieldsToAdd]
    }
  
    // Auth collections: keep email field outside tabs
    const isAuth = options?.isAuth ?? false
    const emailField = isAuth
      ? existingFields.find((f) => 'name' in f && f.name === 'email')
      : undefined
    const contentFields = emailField
      ? existingFields.filter((f) => !('name' in f && f.name === 'email'))
      : existingFields
  
    const firstField = contentFields[0] as Record<string, unknown> | undefined
    const hasExistingTabs = firstField?.type === 'tabs' && Array.isArray((firstField as Record<string, unknown>).tabs)
  
    const contentTabs = hasExistingTabs
      ? ((firstField as Record<string, unknown>).tabs as unknown[])
      : [{ fields: contentFields, label: options?.label || 'Content' }]
  
    const tabbedField = {
      type: 'tabs' as const,
      tabs: [
        ...contentTabs,
        { fields: fieldsToAdd, label: 'SEO' },
      ],
    }
  
    return [
      ...(emailField ? [emailField] : []),
      tabbedField as unknown as Field,
      ...(hasExistingTabs ? contentFields.slice(1) : []),
    ]
  }
  
  // 1. Add SEO fields + afterChange hook to target collections
  if (config.collections) {
    config.collections = config.collections.map((collection) => {
      if (targetCollections.includes(collection.slug)) {
        const existingFields = (collection.fields || []) as Field[]
        const hasSeoMeta = hasCompatiblePayloadSeoMeta(existingFields)
  
        // Determine which fields to add
        const fieldsToAdd = [...seoFields(analyzerLocaleOptions)]
  
        // Auto-create meta fields if:
        // - @payloadcms/plugin-seo is NOT detected
        // - autoCreateMetaFields is not explicitly set to false
        if (!hasSeoMeta && pluginConfig.autoCreateMetaFields !== false) {
          fieldsToAdd.push(...buildMetaFields())
        } else if (hasSeoMeta) {
          console.warn(
            `[seo-analyzer] Collection "${collection.slug}" already has SEO meta fields (likely from @payloadcms/plugin-seo). ` +
            `Meta fields will NOT be auto-created. Only SEO analyzer fields will be added.`
          )
        }
  
        const isAuth = !!(collection as Record<string, unknown>).auth
        const label = typeof collection.labels?.singular === 'string'
          ? collection.labels.singular
          : undefined
  
        const updated = {
          ...collection,
          fields: assembleFields(existingFields, fieldsToAdd, { label, isAuth }),
        }
        return registerCollectionHooks(updated, {
          features,
          trackHistory,
          redirectsSlug,
          basePath,
          seoConfig,
        })
      }
      return collection
    })
  }
  
  // 1a. Add SEO fields to target globals
  if (targetGlobals.length > 0 && config.globals) {
    config.globals = config.globals.map((global) => {
      if (!targetGlobals.includes(global.slug)) return global
  
      const existingFields = global.fields || []
      const hasSeoMeta = hasCompatiblePayloadSeoMeta(existingFields)
  
      const fieldsToAdd = [...seoFields(analyzerLocaleOptions)]
      if (!hasSeoMeta && pluginConfig.autoCreateMetaFields !== false) {
        fieldsToAdd.push(...buildMetaFields())
      }
  
      const label = typeof global.label === 'string' ? global.label : undefined
  
      const updated = {
        ...global,
        fields: assembleFields(existingFields as Field[], fieldsToAdd, { label }),
      }
  
      return registerGlobalHooks(updated, trackHistory, seoConfig)
    })
  }
  
  // 1b. Add plugin-managed collections (conditionally based on features)
  const hasExistingRedirects = config.collections?.some((c) => c.slug === redirectsSlug)
  const pluginCollections = []
  if (trackHistory) pluginCollections.push(createSeoScoreHistoryCollection())
  if (features.settings) pluginCollections.push(createSeoSettingsCollection(targetCollections))
  if (features.redirects && !hasExistingRedirects) pluginCollections.push(createSeoRedirectsCollection(redirectsSlug, allowExternalRedirects))
  if (features.performance) pluginCollections.push(createSeoPerformanceCollection())
  if (features.seoLogs) pluginCollections.push(createSeoLogsCollection())
  if (features.gscApi) pluginCollections.push(createSeoGscAuthCollection(), createSeoRankHistoryCollection())
  config.collections = [
    ...(config.collections || []),
    ...pluginCollections,
  ]
  
}
