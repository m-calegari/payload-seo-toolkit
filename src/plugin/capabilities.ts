import type { SeoFeatures } from '../types.js'
import type { SeoPluginConfig } from './types.js'

export type SeoModuleId =
  | 'redirects' | 'advancedSchema' | 'linkGraph' | 'cannibalization'
  | 'keywordResearch' | 'performance' | 'duplicateContent' | 'externalLinks'
  | 'sitemapAudit' | 'scoreHistory' | 'seoLogs' | 'specializedSitemaps' | 'llmsTxt'
export type SeoIntegrationId = 'ai' | 'googleSearchConsole' | 'pageSpeed' | 'indexNow'
export type SeoBackgroundServiceId = 'warmCache' | 'rankTracking' | 'alerts' | 'retention'
export type SeoCapabilityId = SeoModuleId | SeoIntegrationId | SeoBackgroundServiceId
export type SeoCapabilityKind = 'MODULE' | 'INTEGRATION' | 'BACKGROUND_SERVICE'

export type CapabilityToggles<T extends string> = Partial<Record<T, boolean>>

export interface CapabilityOwnership {
  collections?: readonly string[]
  endpoints?: readonly string[]
  views?: readonly string[]
  hooks?: readonly string[]
  jobs?: readonly string[]
}

export interface SeoCapabilityDescriptor {
  id: SeoCapabilityId
  kind: SeoCapabilityKind
  dependencies: readonly SeoCapabilityId[]
  ownership: CapabilityOwnership
  network?: boolean
}

export interface SeoCapabilityStatus {
  id: SeoCapabilityId
  kind: SeoCapabilityKind
  enabled: boolean
  available: boolean
  dependencies: readonly SeoCapabilityId[]
  issues: readonly string[]
  ownership: CapabilityOwnership
}

export interface SeoCapabilityRegistry {
  readonly statuses: Readonly<Record<SeoCapabilityId, SeoCapabilityStatus>>
  isEnabled(id: SeoCapabilityId): boolean
  publicStatus(): readonly SeoCapabilityStatus[]
}

export const CORE_ENDPOINTS = [
  'validate', 'check-keyword', 'generate', 'audit', 'indexation-audit', 'settings',
  'suggest-links', 'breadcrumb', 'health', 'robots.txt', 'sitemap.xml',
] as const

const module = (id: SeoModuleId, ownership: CapabilityOwnership = {}, dependencies: SeoCapabilityId[] = []): SeoCapabilityDescriptor =>
  ({ id, kind: 'MODULE', dependencies, ownership })
const integration = (id: SeoIntegrationId, ownership: CapabilityOwnership = {}, dependencies: SeoCapabilityId[] = []): SeoCapabilityDescriptor =>
  ({ id, kind: 'INTEGRATION', dependencies, ownership, network: true })
const background = (id: SeoBackgroundServiceId, ownership: CapabilityOwnership = {}, dependencies: SeoCapabilityId[] = []): SeoCapabilityDescriptor =>
  ({ id, kind: 'BACKGROUND_SERVICE', dependencies, ownership })

/** Declarative ownership inventory. Core registrations deliberately do not appear here. */
export const CAPABILITY_DESCRIPTORS: readonly SeoCapabilityDescriptor[] = [
  module('redirects', { collections: ['seo-redirects'], endpoints: ['create-redirect', 'redirects', 'redirect-chains'], views: ['redirects'], hooks: ['autoRedirect'] }),
  module('advancedSchema', { endpoints: ['schema-generator'], views: ['schema-builder'] }),
  module('linkGraph', { endpoints: ['link-graph'], views: ['link-graph'] }),
  module('cannibalization', { endpoints: ['cannibalization'], views: ['cannibalization'] }),
  module('keywordResearch', { endpoints: ['keyword-research'], views: ['keyword-research'] }),
  module('performance', { collections: ['seo-performance'], endpoints: ['performance'], views: ['performance'] }),
  module('duplicateContent', { endpoints: ['duplicate-content'] }),
  module('externalLinks', { endpoints: ['external-links'] }),
  module('sitemapAudit', { endpoints: ['sitemap-audit', 'sitemap-config'], views: ['sitemap-audit'] }),
  module('scoreHistory', { collections: ['seo-score-history'], endpoints: ['history'], hooks: ['trackSeoScore'] }),
  module('seoLogs', { collections: ['seo-logs'], endpoints: ['seo-logs'] }),
  module('specializedSitemaps', { endpoints: ['sitemap-news.xml', 'sitemap-images.xml', 'sitemap-video.xml'] }),
  module('llmsTxt', { endpoints: ['llms.txt'] }),
  integration('ai', { endpoints: ['ai-generate', 'ai-rewrite', 'ai-optimize', 'alt-text-audit', 'ai-alt-text', 'ai-content-brief', 'ai-optimize-bulk'] }),
  integration('googleSearchConsole', { collections: ['seo-gsc-auth', 'seo-rank-history'], endpoints: ['gsc/status', 'gsc/auth', 'gsc/callback', 'gsc/data', 'gsc/disconnect', 'rank-snapshot', 'rank-history', 'ctr-opportunities', 'content-grade'] }),
  integration('pageSpeed', { endpoints: ['core-web-vitals'] }, ['performance']),
  integration('indexNow', { endpoints: ['indexnow-key.txt', 'indexnow-submit'], hooks: ['indexNow'] }),
  background('warmCache', { jobs: ['warmCache'] }),
  background('rankTracking', { jobs: ['rankTracking'] }, ['googleSearchConsole']),
  background('alerts', { endpoints: ['alerts-digest', 'alerts-run'], jobs: ['alerts'] }),
  background('retention', { endpoints: ['retention'], jobs: ['retention'] }),
] as const

const IDS = new Set(CAPABILITY_DESCRIPTORS.map(({ id }) => id))
const byId = Object.fromEntries(CAPABILITY_DESCRIPTORS.map((descriptor) => [descriptor.id, descriptor])) as Record<SeoCapabilityId, SeoCapabilityDescriptor>

const LEGACY_FEATURE_MAP: Partial<Record<keyof SeoFeatures, readonly SeoCapabilityId[]>> = {
  redirects: ['redirects'], performance: ['performance', 'pageSpeed'], linkGraph: ['linkGraph'],
  keywords: ['keywordResearch'], cannibalization: ['cannibalization'], schemaBuilder: ['advancedSchema'],
  sitemapAudit: ['sitemapAudit'], seoLogs: ['seoLogs'], scoreHistory: ['scoreHistory'],
  externalLinks: ['externalLinks'], aiFeatures: ['ai'], gscApi: ['googleSearchConsole', 'rankTracking'],
  warmCache: ['warmCache'], duplicateContent: ['duplicateContent'], alerts: ['alerts'], indexNow: ['indexNow'],
}

const LEGACY_DEFAULTS: Required<SeoFeatures> = {
  analyzer: true, dashboard: true, redirects: true, performance: true, linkGraph: true,
  keywords: true, cannibalization: true, schemaBuilder: true, sitemapAudit: true, seoLogs: true,
  scoreHistory: true, externalLinks: true, aiFeatures: true, duplicateContent: true, settings: true,
  gscApi: false, warmCache: true, alerts: false, indexNow: false,
}

let warnedLegacyFeatures = false

function validateKeys(kind: string, input: Record<string, boolean> | undefined): void {
  for (const key of Object.keys(input ?? {})) {
    if (!IDS.has(key as SeoCapabilityId) || byId[key as SeoCapabilityId].kind !== kind) {
      throw new Error(`[seo-analyzer] Unknown ${kind.toLowerCase()} capability: ${key}`)
    }
  }
}

function availability(id: SeoCapabilityId, enabled: boolean, pluginConfig: SeoPluginConfig): string[] {
  if (!enabled) return []
  if (id === 'ai' && !process.env.ANTHROPIC_API_KEY) return ['Provider credential is not configured.']
  if (id === 'googleSearchConsole' && !(process.env.GSC_OAUTH_CLIENT_ID && process.env.GSC_OAUTH_CLIENT_SECRET)) return ['OAuth configuration is incomplete.']
  if (id === 'indexNow' && !process.env.SEO_INDEXNOW_KEY) return ['IndexNow key is not configured.']
  if (id === 'retention' && !pluginConfig.retentionDays) return ['Retention windows are not configured.']
  return []
}

export function createCapabilityRegistry(pluginConfig: SeoPluginConfig): SeoCapabilityRegistry {
  validateKeys('MODULE', pluginConfig.modules as Record<string, boolean> | undefined)
  validateKeys('INTEGRATION', pluginConfig.integrations as Record<string, boolean> | undefined)
  validateKeys('BACKGROUND_SERVICE', pluginConfig.backgroundServices as Record<string, boolean> | undefined)

  const enabled = Object.fromEntries(CAPABILITY_DESCRIPTORS.map(({ id }) => [id, false])) as Record<SeoCapabilityId, boolean>

  // Legacy mode preserves the historical defaults. The new configuration path is conservative.
  if (pluginConfig.features !== undefined) {
    if (!warnedLegacyFeatures) {
      console.warn('[seo-analyzer] `features` is deprecated; use `modules`, `integrations`, and `backgroundServices`. Historical defaults were preserved for this configuration.')
      warnedLegacyFeatures = true
    }
    const legacy = { ...LEGACY_DEFAULTS, ...pluginConfig.features }
    for (const [flag, ids] of Object.entries(LEGACY_FEATURE_MAP) as [keyof SeoFeatures, readonly SeoCapabilityId[]][]) {
      for (const id of ids) enabled[id] = legacy[flag]
    }
  }
  for (const [id, value] of Object.entries(pluginConfig.modules ?? {})) enabled[id as SeoCapabilityId] = value === true
  for (const [id, value] of Object.entries(pluginConfig.integrations ?? {})) enabled[id as SeoCapabilityId] = value === true
  for (const [id, value] of Object.entries(pluginConfig.backgroundServices ?? {})) enabled[id as SeoCapabilityId] = value === true

  // Existing explicit options remain useful aliases for their capability.
  if (pluginConfig.trackScoreHistory !== undefined) enabled.scoreHistory = pluginConfig.trackScoreHistory
  if (pluginConfig.retentionDays && pluginConfig.backgroundServices?.retention !== false) enabled.retention = true

  const statuses = {} as Record<SeoCapabilityId, SeoCapabilityStatus>
  for (const descriptor of CAPABILITY_DESCRIPTORS) {
    const issues = availability(descriptor.id, enabled[descriptor.id], pluginConfig)
    for (const dependency of descriptor.dependencies) {
      if (enabled[descriptor.id] && !enabled[dependency]) {
        throw new Error(`[seo-analyzer] Capability "${descriptor.id}" requires "${dependency}" to be enabled.`)
      }
    }
    statuses[descriptor.id] = {
      id: descriptor.id, kind: descriptor.kind, enabled: enabled[descriptor.id],
      available: enabled[descriptor.id] && issues.length === 0,
      dependencies: descriptor.dependencies, issues, ownership: descriptor.ownership,
    }
  }
  return {
    statuses,
    isEnabled: (id) => statuses[id].enabled,
    publicStatus: () => CAPABILITY_DESCRIPTORS.map(({ id }) => statuses[id]),
  }
}

/** Temporary adapter for code and clients using the inherited feature vocabulary. */
export function capabilitiesToLegacyFeatures(registry: SeoCapabilityRegistry): Required<SeoFeatures> {
  return {
    analyzer: true, dashboard: true, settings: true,
    redirects: registry.isEnabled('redirects'), performance: registry.isEnabled('performance'),
    linkGraph: registry.isEnabled('linkGraph'), keywords: registry.isEnabled('keywordResearch'),
    cannibalization: registry.isEnabled('cannibalization'), schemaBuilder: registry.isEnabled('advancedSchema'),
    sitemapAudit: registry.isEnabled('sitemapAudit'), seoLogs: registry.isEnabled('seoLogs'),
    scoreHistory: registry.isEnabled('scoreHistory'), externalLinks: registry.isEnabled('externalLinks'),
    aiFeatures: registry.isEnabled('ai'), gscApi: registry.isEnabled('googleSearchConsole'),
    warmCache: registry.isEnabled('warmCache'), duplicateContent: registry.isEnabled('duplicateContent'),
    alerts: registry.isEnabled('alerts'), indexNow: registry.isEnabled('indexNow'),
  }
}
