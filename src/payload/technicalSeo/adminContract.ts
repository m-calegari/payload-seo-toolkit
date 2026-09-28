import type { SeoConfig } from '../../types.js'
import { buildRobotsTxt, normalizeRobotsPolicy, resolveSiteIdentity } from '../../core/technicalSeo/index.js'
import { resolveDocumentPath } from '../../core/urls/index.js'
import { resolveSiteModel } from '../../helpers/siteModel.js'
import { normalizeTechnicalSeoPolicy } from '../../core/technicalSeo/index.js'
import { sanitizeRobotsRules } from '../../helpers/robotsSafety.js'
import { technicalSeoSettingsInput } from './settings.js'

export interface AdminCollectionSummary {
  slug: string
  label: string
  route: string
  examplePath: string
  index: boolean
  follow: boolean
  sitemapEnabled: boolean
  sitemapPriority: number
  sitemapChangeFrequency: string
  schemaType: string
  source: 'stored' | 'compatibility default'
}

export interface TechnicalSeoAdminContract {
  site: {
    name: string
    origin: string | null
    root: string | null
    organizationId: string | null
    websiteId: string | null
    originSource: 'application configuration' | 'unavailable'
  }
  defaults: {
    index: boolean
    follow: boolean
    schemaType: string
  }
  collections: AdminCollectionSummary[]
  sitemap: { endpoint: string; url: string | null; enabledCount: number; disabledCount: number }
  robots: {
    endpoint: string
    url: string | null
    builtInDisallow: string[]
    policy: ReturnType<typeof normalizeRobotsPolicy>
    preview: string
  }
  health: Array<{ code: string; status: 'configured' | 'needs-attention' | 'disabled' | 'unavailable'; message: string }>
  application: {
    targetCollections: string[]
    collectionRoutes: Record<string, string>
    siteOriginEditable: false
  }
}

function labelFor(slug: string): string {
  return slug.split(/[-_]/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

export function buildTechnicalSeoAdminContract(
  settings: Record<string, unknown> | undefined,
  targetCollections: string[],
  seoConfig?: SeoConfig,
): TechnicalSeoAdminContract {
  const siteModel = resolveSiteModel(seoConfig, targetCollections)
  const policy = normalizeTechnicalSeoPolicy(technicalSeoSettingsInput(settings), targetCollections)
  const identities = resolveSiteIdentity(siteModel)
  const storedRows = new Set(
    Array.isArray((settings?.technicalSeo as Record<string, unknown> | undefined)?.collections)
      ? ((settings?.technicalSeo as Record<string, unknown>).collections as Array<Record<string, unknown>>).map((row) => String(row.collection ?? ''))
      : [],
  )
  const collections = targetCollections.map((slug): AdminCollectionSummary => {
    const effective = policy.collections[slug] ?? policy.defaults
    const route = siteModel.collections[slug]?.route ?? ''
    return {
      slug,
      label: labelFor(slug),
      route: route ? `/${route}` : '/',
      examplePath: resolveDocumentPath(siteModel, { collection: slug, slug: 'example' }),
      index: effective.indexation.index,
      follow: effective.indexation.follow,
      sitemapEnabled: effective.sitemap.enabled,
      sitemapPriority: effective.sitemap.priority,
      sitemapChangeFrequency: effective.sitemap.changeFrequency,
      schemaType: effective.schema.defaultType,
      source: storedRows.has(slug) ? 'stored' : 'compatibility default',
    }
  })
  const rawRobots = settings?.robots as Record<string, unknown> | undefined
  const robotsPolicy = normalizeRobotsPolicy({
    userAgent: rawRobots?.userAgent,
    allow: rawRobots?.allow,
    disallow: rawRobots?.disallow,
    advertiseSitemap: rawRobots?.advertiseSitemap,
    customRules: sanitizeRobotsRules(settings?.robotsCustomRules),
  })
  const sitemapUrl = siteModel.origin ? `${siteModel.origin}/sitemap.xml` : null
  const health: TechnicalSeoAdminContract['health'] = []
  if (!siteModel.origin) health.push({ code: 'missing-origin', status: 'unavailable', message: 'No valid public site origin is configured.' })
  if (collections.every((collection) => !collection.sitemapEnabled)) {
    health.push({ code: 'sitemap-disabled', status: 'disabled', message: 'All configured collections are excluded from the sitemap.' })
  }
  for (const collection of collections.filter((item) => !item.index)) {
    health.push({ code: `noindex:${collection.slug}`, status: 'needs-attention', message: `${collection.label} is noindex by default.` })
  }
  if (robotsPolicy.disallow.includes('/') || robotsPolicy.disallow.includes('/*')) {
    health.push({ code: 'robots-block-all', status: 'needs-attention', message: 'The robots policy blocks the entire public site.' })
  }
  if (health.length === 0) health.push({ code: 'healthy', status: 'configured', message: 'Core technical SEO configuration is available.' })

  return {
    site: {
      name: typeof settings?.siteName === 'string' ? settings.siteName : seoConfig?.siteName ?? '',
      origin: siteModel.origin,
      root: identities.root,
      organizationId: identities.organizationId,
      websiteId: identities.websiteId,
      originSource: siteModel.origin ? 'application configuration' : 'unavailable',
    },
    defaults: {
      index: policy.defaults.indexation.index,
      follow: policy.defaults.indexation.follow,
      schemaType: policy.defaults.schema.defaultType,
    },
    collections,
    sitemap: {
      endpoint: '/sitemap.xml', url: sitemapUrl,
      enabledCount: collections.filter((collection) => collection.sitemapEnabled).length,
      disabledCount: collections.filter((collection) => !collection.sitemapEnabled).length,
    },
    robots: {
      endpoint: '/robots.txt',
      url: siteModel.origin ? `${siteModel.origin}/robots.txt` : null,
      builtInDisallow: ['/admin/*', '/api/*'],
      policy: robotsPolicy,
      preview: buildRobotsTxt(robotsPolicy, sitemapUrl),
    },
    health,
    application: {
      targetCollections: [...targetCollections],
      collectionRoutes: Object.fromEntries(targetCollections.map((slug) => [slug, siteModel.collections[slug]?.route ?? ''])),
      siteOriginEditable: false,
    },
  }
}
