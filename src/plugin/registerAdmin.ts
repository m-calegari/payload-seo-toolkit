import type { Config } from 'payload'
import type { SeoFeatures } from '../types.js'
import { seoTranslations } from '../translations.js'
import { registerDashboardTranslations } from '../dashboard-i18n.js'
import type { SeoPluginConfig } from './types.js'

/** Register admin views, navigation, translations, and client-visible feature config. */
export function registerAdmin(
  config: Config,
  pluginConfig: SeoPluginConfig,
  features: Required<SeoFeatures>,
): void {
  // 3. Add admin views + nav link (conditionally based on features)
  // At least one view-based feature must be enabled to inject admin components
  const hasAnyView = features.dashboard || features.sitemapAudit || features.settings
    || features.redirects || features.cannibalization || features.performance
    || features.keywords || features.schemaBuilder || features.linkGraph
  
  if (pluginConfig.addDashboardView !== false && hasAnyView) {
    if (!config.admin) config.admin = {}
    if (!config.admin.components) config.admin.components = {}
    if (!config.admin.components.views) config.admin.components.views = {}
  
    const views = config.admin.components.views as Record<string, unknown>
  
    if (features.dashboard) {
      views.seo = {
        Component: '@consilioweb/payload-seo-analyzer/views#SeoView',
        path: '/seo',
      }
    }
  
    if (features.sitemapAudit && pluginConfig.addSitemapAuditView !== false) {
      views['sitemap-audit'] = {
        Component: '@consilioweb/payload-seo-analyzer/views#SitemapAuditView',
        path: '/sitemap-audit',
      }
    }
  
    if (features.settings) {
      views['seo-config'] = {
        Component: '@consilioweb/payload-seo-analyzer/views#SeoConfigView',
        path: '/seo-config',
      }
    }
  
    if (features.redirects) {
      views['redirects'] = {
        Component: '@consilioweb/payload-seo-analyzer/views#RedirectManagerView',
        path: '/redirects',
      }
    }
  
    if (features.cannibalization) {
      views['cannibalization'] = {
        Component: '@consilioweb/payload-seo-analyzer/views#CannibalizationView',
        path: '/cannibalization',
      }
    }
  
    if (features.performance) {
      views['performance'] = {
        Component: '@consilioweb/payload-seo-analyzer/views#PerformanceView',
        path: '/performance',
      }
    }
  
    if (features.keywords) {
      views['keyword-research'] = {
        Component: '@consilioweb/payload-seo-analyzer/views#KeywordResearchView',
        path: '/keyword-research',
      }
    }
  
    if (features.schemaBuilder) {
      views['schema-builder'] = {
        Component: '@consilioweb/payload-seo-analyzer/views#SchemaBuilderView',
        path: '/schema-builder',
      }
    }
  
    if (features.linkGraph) {
      views['link-graph'] = {
        Component: '@consilioweb/payload-seo-analyzer/views#LinkGraphView',
        path: '/link-graph',
      }
    }
  
    // Inject nav link into admin sidebar
    const navLinks = config.admin.components.afterNavLinks || []
    config.admin.components.afterNavLinks = [
      ...(Array.isArray(navLinks) ? navLinks : [navLinks]),
      '@consilioweb/payload-seo-analyzer/client#SeoNavLink',
    ]
  }
  
  // 4. Inject i18n translations for meta field UI labels (39 languages)
  if (!config.i18n) config.i18n = {}
  const existingTranslations = (config.i18n as Record<string, unknown>).translations as
    Record<string, Record<string, unknown>> | undefined
  const merged: Record<string, Record<string, unknown>> = { ...(existingTranslations || {}) }
  for (const [locale, namespaces] of Object.entries(seoTranslations)) {
    merged[locale] = {
      ...(merged[locale] || {}),
      ...namespaces,
    }
  }
  ;(config.i18n as Record<string, unknown>).translations = merged
  
  // 5. Register custom dashboard translations if provided
  if (pluginConfig.customTranslations) {
    for (const [locale, translations] of Object.entries(pluginConfig.customTranslations)) {
      registerDashboardTranslations(locale, translations)
    }
  }
  
  // The admin components run in the browser with their own module copies, so
  // what they need from this config travels in `admin.custom`, which is part of
  // the client config: the feature flags (a panel then never calls an endpoint
  // that was not registered) and the custom dashboard translations (the
  // registry above lives in this server module). Read by hooks/useSeoLocale.ts.
  if (!config.admin) config.admin = {}
  const adminCustom = (config.admin.custom ?? {}) as Record<string, unknown>
  config.admin.custom = {
    ...adminCustom,
    seoAnalyzer: {
      ...((adminCustom.seoAnalyzer as Record<string, unknown> | undefined) ?? {}),
      features,
      ...(pluginConfig.customTranslations && { customTranslations: pluginConfig.customTranslations }),
    },
  }
  
}
