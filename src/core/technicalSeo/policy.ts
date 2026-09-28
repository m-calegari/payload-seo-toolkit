import type { SiteModel } from '../urls/siteModel.js'
import type { DocumentUrlIdentity } from '../urls/resolver.js'
import { resolveCanonicalUrl } from '../urls/resolver.js'

export const SITEMAP_CHANGE_FREQUENCIES = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'] as const
export type SitemapChangeFrequency = (typeof SITEMAP_CHANGE_FREQUENCIES)[number]

export const TECHNICAL_SCHEMA_TYPES = [
  'WebPage', 'Article', 'Product', 'Event', 'LocalBusiness', 'FAQPage',
  'Organization', 'Person', 'Recipe', 'Video', 'BreadcrumbList',
] as const
export type TechnicalSchemaType = (typeof TECHNICAL_SCHEMA_TYPES)[number]

export interface CollectionSeoPolicy {
  indexation: { index: boolean; follow: boolean }
  sitemap: { enabled: boolean; priority: number; changeFrequency: SitemapChangeFrequency }
  schema: { defaultType: TechnicalSchemaType }
}

export interface SitemapPatternOverride {
  slugPattern: string
  priority?: number
  changeFrequency?: SitemapChangeFrequency
}

export interface TechnicalSeoPolicy {
  defaults: CollectionSeoPolicy
  collections: Record<string, CollectionSeoPolicy>
  excludedSlugs: string[]
  sitemapOverrides: SitemapPatternOverride[]
}

export interface ResolveTechnicalSeoInput {
  siteModel: SiteModel
  policy: TechnicalSeoPolicy
  identity: DocumentUrlIdentity
  document: Record<string, unknown>
  publicEligible: boolean
}

export interface EffectiveTechnicalSeo {
  canonicalUrl: string | null
  index: boolean
  follow: boolean
  sitemap: {
    include: boolean
    priority: number
    changeFrequency: SitemapChangeFrequency
  }
  schema: { defaultType: TechnicalSchemaType }
}

const BASE_DEFAULT: CollectionSeoPolicy = {
  indexation: { index: true, follow: true },
  sitemap: { enabled: true, priority: 0.5, changeFrequency: 'weekly' },
  schema: { defaultType: 'WebPage' },
}

const COMPATIBILITY_DEFAULTS: Record<string, Partial<CollectionSeoPolicy>> = {
  pages: {
    sitemap: { enabled: true, priority: 0.8, changeFrequency: 'monthly' },
    schema: { defaultType: 'WebPage' },
  },
  posts: {
    sitemap: { enabled: true, priority: 0.7, changeFrequency: 'weekly' },
    schema: { defaultType: 'Article' },
  },
  products: { schema: { defaultType: 'Product' } },
  events: { schema: { defaultType: 'Event' } },
}

export interface StoredCollectionSeoPolicy {
  collection?: unknown
  index?: unknown
  follow?: unknown
  sitemapEnabled?: unknown
  sitemapPriority?: unknown
  sitemapChangeFrequency?: unknown
  defaultSchemaType?: unknown
}

export interface StoredTechnicalSeoSettings {
  collections?: unknown
  sitemap?: {
    excludedSlugs?: unknown
    defaultPriority?: unknown
    defaultChangefreq?: unknown
    priorityOverrides?: unknown
  }
}

function validPriority(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

function validFrequency(value: unknown): value is SitemapChangeFrequency {
  return typeof value === 'string' && (SITEMAP_CHANGE_FREQUENCIES as readonly string[]).includes(value)
}

function validSchema(value: unknown): value is TechnicalSchemaType {
  return typeof value === 'string' && (TECHNICAL_SCHEMA_TYPES as readonly string[]).includes(value)
}

function mergeCollectionPolicy(
  base: CollectionSeoPolicy,
  compatibility?: Partial<CollectionSeoPolicy>,
  stored?: StoredCollectionSeoPolicy,
): CollectionSeoPolicy {
  const compatIndex = compatibility?.indexation
  const compatSitemap = compatibility?.sitemap
  return {
    indexation: {
      index: typeof stored?.index === 'boolean' ? stored.index : compatIndex?.index ?? base.indexation.index,
      follow: typeof stored?.follow === 'boolean' ? stored.follow : compatIndex?.follow ?? base.indexation.follow,
    },
    sitemap: {
      enabled: typeof stored?.sitemapEnabled === 'boolean' ? stored.sitemapEnabled : compatSitemap?.enabled ?? base.sitemap.enabled,
      priority: validPriority(stored?.sitemapPriority) ? stored.sitemapPriority : compatSitemap?.priority ?? base.sitemap.priority,
      changeFrequency: validFrequency(stored?.sitemapChangeFrequency)
        ? stored.sitemapChangeFrequency
        : compatSitemap?.changeFrequency ?? base.sitemap.changeFrequency,
    },
    schema: {
      defaultType: validSchema(stored?.defaultSchemaType)
        ? stored.defaultSchemaType
        : compatibility?.schema?.defaultType ?? base.schema.defaultType,
    },
  }
}

export function validateTechnicalSeoSettings(
  input: StoredTechnicalSeoSettings | undefined,
  knownCollections: readonly string[],
): string[] {
  const errors: string[] = []
  if (input?.collections !== undefined && !Array.isArray(input.collections)) {
    errors.push('technicalSeo.collections must be an array')
  }
  for (const item of Array.isArray(input?.collections) ? input.collections : []) {
    if (!item || typeof item !== 'object') {
      errors.push('Each collection policy must be an object')
      continue
    }
    const row = item as StoredCollectionSeoPolicy
    if (typeof row.collection !== 'string' || !knownCollections.includes(row.collection)) {
      errors.push(`Unknown SEO collection: ${String(row.collection ?? '')}`)
    }
    if (row.sitemapPriority !== undefined && !validPriority(row.sitemapPriority)) {
      errors.push(`Invalid sitemap priority for ${String(row.collection ?? '')}`)
    }
    if (row.sitemapChangeFrequency !== undefined && !validFrequency(row.sitemapChangeFrequency)) {
      errors.push(`Invalid sitemap change frequency for ${String(row.collection ?? '')}`)
    }
    if (row.defaultSchemaType !== undefined && !validSchema(row.defaultSchemaType)) {
      errors.push(`Invalid schema type for ${String(row.collection ?? '')}`)
    }
  }
  return errors
}

export function normalizeTechnicalSeoPolicy(
  input: StoredTechnicalSeoSettings | undefined,
  knownCollections: readonly string[],
): TechnicalSeoPolicy {
  const legacy = input?.sitemap
  const defaults = mergeCollectionPolicy({
    ...BASE_DEFAULT,
    sitemap: {
      ...BASE_DEFAULT.sitemap,
      priority: validPriority(legacy?.defaultPriority) ? legacy.defaultPriority : BASE_DEFAULT.sitemap.priority,
      changeFrequency: validFrequency(legacy?.defaultChangefreq) ? legacy.defaultChangefreq : BASE_DEFAULT.sitemap.changeFrequency,
    },
  })
  const rows = new Map<string, StoredCollectionSeoPolicy>()
  for (const item of Array.isArray(input?.collections) ? input.collections : []) {
    if (item && typeof item === 'object' && typeof (item as StoredCollectionSeoPolicy).collection === 'string') {
      rows.set((item as StoredCollectionSeoPolicy).collection as string, item as StoredCollectionSeoPolicy)
    }
  }
  const collections: Record<string, CollectionSeoPolicy> = {}
  for (const collection of knownCollections) {
    collections[collection] = mergeCollectionPolicy(defaults, COMPATIBILITY_DEFAULTS[collection], rows.get(collection))
  }
  const excludedSlugs = Array.isArray(legacy?.excludedSlugs)
    ? legacy.excludedSlugs.map((entry) => typeof entry === 'string' ? entry : String((entry as { slug?: unknown })?.slug ?? '')).filter(Boolean)
    : []
  const sitemapOverrides: SitemapPatternOverride[] = Array.isArray(legacy?.priorityOverrides)
    ? legacy.priorityOverrides.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const row = entry as Record<string, unknown>
      if (typeof row.slugPattern !== 'string') return []
      return [{
        slugPattern: row.slugPattern,
        ...(validPriority(row.priority) ? { priority: row.priority } : {}),
        ...(validFrequency(row.changefreq) ? { changeFrequency: row.changefreq } : {}),
      }]
    })
    : []
  return { defaults, collections, excludedSlugs, sitemapOverrides }
}

function matchesPattern(slug: string, pattern: string): boolean {
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2)
    return slug === prefix || slug.startsWith(`${prefix}/`)
  }
  if (pattern.endsWith('*')) return slug.startsWith(pattern.slice(0, -1))
  return slug === pattern
}

function documentFlag(document: Record<string, unknown>, name: 'noindex' | 'nofollow'): boolean {
  const meta = document.meta as Record<string, unknown> | undefined
  const robots = [meta?.robots, document.robots].filter((value): value is string => typeof value === 'string').join(',').toLowerCase()
  return document[name] === true || meta?.[name] === true || robots.includes(name)
}

export function resolveTechnicalSeo(input: ResolveTechnicalSeoInput): EffectiveTechnicalSeo {
  const { document, identity, siteModel, publicEligible } = input
  const publicationEligible = publicEligible && (document._status === undefined || document._status === 'published')
  const collection = input.policy.collections[identity.collection] ?? input.policy.defaults
  const slug = String(identity.slug ?? '')
  const noindex = documentFlag(document, 'noindex')
  const nofollow = documentFlag(document, 'nofollow')
  const explicitCanonical = String(
    (document.meta as Record<string, unknown> | undefined)?.canonicalUrl
      ?? document.canonicalUrl
      ?? '',
  )
  let priority = collection.sitemap.priority
  let changeFrequency = collection.sitemap.changeFrequency
  let matchedOverride = false
  for (const override of input.policy.sitemapOverrides) {
    if (!matchesPattern(slug, override.slugPattern)) continue
    matchedOverride = true
    if (override.priority !== undefined) priority = override.priority
    if (override.changeFrequency) changeFrequency = override.changeFrequency
  }
  if (!slug || slug === 'home') {
    if (!matchedOverride) {
      priority = 1
      changeFrequency = 'weekly'
    }
  }
  const documentSitemap = document.sitemap as Record<string, unknown> | undefined
  if (validPriority(documentSitemap?.priority)) priority = documentSitemap.priority
  if (validFrequency(documentSitemap?.changeFrequency)) changeFrequency = documentSitemap.changeFrequency
  const excluded = input.policy.excludedSlugs.some((pattern) => matchesPattern(slug, pattern))
    || document.excludeFromSitemap === true
    || (document.meta as Record<string, unknown> | undefined)?.excludeFromSitemap === true
    || documentSitemap?.exclude === true
  const index = publicationEligible && collection.indexation.index && !noindex
  const follow = publicationEligible && collection.indexation.follow && !nofollow
  return {
    canonicalUrl: resolveCanonicalUrl(siteModel, { identity, explicitCanonical }),
    index,
    follow,
    sitemap: {
      include: publicationEligible && index && collection.sitemap.enabled && !excluded,
      priority,
      changeFrequency,
    },
    schema: { defaultType: collection.schema.defaultType },
  }
}
