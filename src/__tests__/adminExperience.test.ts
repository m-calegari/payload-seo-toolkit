import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildTechnicalSeoAdminContract } from '../payload/technicalSeo/adminContract.js'
import { createSettingsHandler } from '../endpoints/settings.js'
import { createSitemapConfigHandler } from '../endpoints/sitemapConfig.js'
import { seoCache } from '../cache.js'
import { registerAdmin } from '../plugin/registerAdmin.js'

const seoConfig = { siteUrl: 'https://example.com/', collectionRoutes: { posts: 'blog', projects: 'work' } }

describe('M4 admin contract', () => {
  it('registers stable direct routes for every primary configuration section', () => {
    const config: Record<string, any> = {}
    const features = {
      dashboard: false, sitemapAudit: false, settings: true, redirects: false, cannibalization: false,
      performance: false, keywords: false, schemaBuilder: false, linkGraph: false,
    }
    registerAdmin(config as never, {}, features as never)
    const views = config.admin.components.views
    expect(Object.values(views).map((view: any) => view.path)).toEqual(expect.arrayContaining([
      '/seo-overview', '/seo-search-appearance', '/seo-sitemap', '/seo-robots', '/seo-structured-data', '/seo-config', '/seo-legacy-config',
    ]))
  })

  it('returns effective collection, route, identity, robots and health summaries', () => {
    const contract = buildTechnicalSeoAdminContract({
      siteName: 'Example',
      technicalSeo: { collections: [{ collection: 'projects', index: false, sitemapEnabled: false, defaultSchemaType: 'Product' }] },
    }, ['pages', 'posts', 'projects'], seoConfig)
    expect(contract.site).toMatchObject({ name: 'Example', origin: 'https://example.com', organizationId: 'https://example.com/#organization' })
    expect(contract.collections.find((row) => row.slug === 'posts')).toMatchObject({ route: '/blog', schemaType: 'Article' })
    expect(contract.collections.find((row) => row.slug === 'projects')).toMatchObject({ route: '/work', index: false, sitemapEnabled: false, schemaType: 'Product', source: 'stored' })
    expect(contract.robots.preview).toContain('Sitemap: https://example.com/sitemap.xml')
    expect(contract.health.some((item) => item.code === 'noindex:projects')).toBe(true)
  })

  it('reports missing origin, all-sitemap-disabled and broad robots blocking conservatively', () => {
    const contract = buildTechnicalSeoAdminContract({
      technicalSeo: { collections: [{ collection: 'pages', sitemapEnabled: false }] },
      robots: { disallow: [{ path: '/' }] },
    }, ['pages'])
    expect(contract.health.map((item) => item.code)).toEqual(expect.arrayContaining(['missing-origin', 'sitemap-disabled', 'robots-block-all']))
    expect(contract.robots.preview).not.toContain('Sitemap:')
  })
})

describe('M4 settings contract', () => {
  beforeEach(() => seoCache.invalidate())

  function payload(settings: Record<string, unknown> = {}) {
    return {
      config: { admin: { user: 'users' } },
      logger: { error: vi.fn(), warn: vi.fn() },
      find: vi.fn(async () => ({ docs: Object.keys(settings).length ? [{ id: 'settings', ...settings }] : [], hasNextPage: false })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'settings', ...settings, ...data })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'settings', ...data })),
    }
  }

  it('loads stored settings and server-resolved effective state for a panel user', async () => {
    const store = payload({ siteName: 'Example' })
    const response = await createSettingsHandler(['pages', 'posts'], seoConfig)({
      method: 'GET', user: { id: '1', collection: 'users' }, payload: store,
    } as never)
    expect(response.status).toBe(200)
    const body = await response.json() as Record<string, any>
    expect(body.settings.siteName).toBe('Example')
    expect(body.effective.collections).toHaveLength(2)
    expect(body.effective.collections[1]).toMatchObject({ slug: 'posts', route: '/blog' })
  })

  it('rejects settings mutations from a non-admin panel user', async () => {
    const store = payload()
    const response = await createSettingsHandler(['pages'], seoConfig)({
      method: 'PATCH', user: { id: '1', collection: 'users', role: 'editor' }, payload: store,
      json: async () => ({ siteName: 'Changed' }),
    } as never)
    expect(response.status).toBe(403)
    expect(store.update).not.toHaveBeenCalled()
    expect(store.create).not.toHaveBeenCalled()
  })

  it('returns actionable validation errors for unknown collections and invalid robots paths', async () => {
    const store = payload()
    const response = await createSettingsHandler(['pages'], seoConfig)({
      method: 'PATCH', user: { id: '1', collection: 'users', role: 'admin' }, payload: store,
      json: async () => ({
        technicalSeo: { collections: [{ collection: 'unknown', sitemapPriority: 2 }] },
        robots: { disallow: [{ path: 'private' }] },
      }),
    } as never)
    expect(response.status).toBe(400)
    const body = await response.json() as { details: string[] }
    expect(body.details.join(' ')).toContain('Unknown SEO collection')
    expect(body.details.join(' ')).toContain('between 0 and 1')
    expect(body.details.join(' ')).toContain('begin with /')
    expect(store.update).not.toHaveBeenCalled()
  })

  it('invalidates settings-derived output and returns refreshed effective state after save', async () => {
    seoCache.set('sitemap-xml:test', 'stale')
    seoCache.set('robots-txt:test', 'stale')
    const store = payload({ siteName: 'Old' })
    const response = await createSettingsHandler(['pages'], seoConfig)({
      method: 'PATCH', user: { id: '1', collection: 'users', role: 'admin' }, payload: store,
      json: async () => ({ siteName: 'New' }),
    } as never)
    expect(response.status).toBe(200)
    expect(seoCache.get('sitemap-xml:test')).toBeNull()
    expect(seoCache.get('robots-txt:test')).toBeNull()
    const body = await response.json() as Record<string, any>
    expect(body.effective.site.name).toBe('New')
  })
})

describe('M4 bounded sitemap preview', () => {
  it('uses anonymous access, M3 policy, resolved URLs and a 50-entry browser bound', async () => {
    const docs = Array.from({ length: 60 }, (_, index) => ({ id: index, slug: `page-${index}`, title: `Page ${index}`, _status: 'published' }))
    docs[0] = { ...docs[0], meta: { noindex: true } } as any
    const find = vi.fn(async ({ collection, overrideAccess }: { collection: string; overrideAccess?: boolean }) => {
      if (collection === 'seo-settings') return { docs: [], hasNextPage: false }
      expect(overrideAccess).toBe(false)
      return { docs, hasNextPage: false }
    })
    const response = await createSitemapConfigHandler(['pages'], seoConfig)({
      method: 'GET', user: { id: '1', collection: 'users' },
      payload: { config: { admin: { user: 'users' } }, find, logger: { error: vi.fn(), warn: vi.fn() } },
    } as never)
    expect(response.status).toBe(200)
    const body = await response.json() as PreviewResponse
    expect(body.preview).toHaveLength(50)
    expect(body.stats).toMatchObject({ totalPages: 60, includedCount: 59, excludedCount: 1, previewLimit: 50 })
    expect(body.preview[0].url).toMatch(/^\//)
    expect(body.preview.some((entry) => entry.url.endsWith('/page-0'))).toBe(false)
  })
})

interface PreviewResponse {
  preview: Array<{ url: string }>
  stats: { totalPages: number; includedCount: number; excludedCount: number; previewLimit: number }
}
