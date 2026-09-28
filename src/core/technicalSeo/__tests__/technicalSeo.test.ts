import { describe, expect, it } from 'vitest'
import { createSiteModel } from '../../urls/index.js'
import {
  buildRobotsTxt,
  normalizeRobotsPolicy,
  normalizeTechnicalSeoPolicy,
  resolveSiteIdentity,
  resolveTechnicalSeo,
  validateTechnicalSeoSettings,
} from '../index.js'
import { detectPayloadSeoFields } from '../../../payload/compatibility/payloadSeo.js'
import { seoCache } from '../../../cache.js'
import { invalidateTechnicalSeoCaches } from '../../../payload/technicalSeo/cache.js'
import { buildSeoMetadata } from '../../../helpers/buildMetadata.js'
import { buildJsonLd } from '../../../helpers/buildSchema.js'

const siteModel = createSiteModel({
  origin: 'https://example.com/',
  collections: ['pages', 'posts', 'projects'],
  collectionRoutes: { projects: '/work/' },
})

function effective(
  collection: string,
  document: Record<string, unknown> = { slug: 'example', _status: 'published' },
  publicEligible = true,
  settings?: Parameters<typeof normalizeTechnicalSeoPolicy>[0],
) {
  const policy = normalizeTechnicalSeoPolicy(settings, ['pages', 'posts', 'projects'])
  return resolveTechnicalSeo({ siteModel, policy, identity: { collection, slug: String(document.slug ?? '') }, document, publicEligible })
}

describe('technical SEO policy', () => {
  it('uses collection compatibility defaults without sitemap collection-name branches', () => {
    expect(effective('pages').sitemap).toMatchObject({ include: true, priority: 0.8, changeFrequency: 'monthly' })
    expect(effective('posts').sitemap).toMatchObject({ include: true, priority: 0.7, changeFrequency: 'weekly' })
    expect(effective('projects').sitemap.priority).toBe(0.5)
  })

  it('applies an admin collection policy to an arbitrary configured collection', () => {
    const result = effective('projects', { slug: 'one', _status: 'published' }, true, {
      collections: [{ collection: 'projects', sitemapPriority: 0.9, sitemapChangeFrequency: 'daily', defaultSchemaType: 'Product' }],
    })
    expect(result.sitemap).toMatchObject({ include: true, priority: 0.9, changeFrequency: 'daily' })
    expect(result.schema.defaultType).toBe('Product')
    expect(result.canonicalUrl).toBe('https://example.com/work/one')
  })

  it.each([
    ['private', false, { slug: 'x', _status: 'published' }],
    ['draft', true, { slug: 'x', _status: 'draft' }],
  ])('%s content cannot become indexable through configuration', (_name, publicEligible, document) => {
    const result = effective('pages', document, publicEligible, { collections: [{ collection: 'pages', index: true }] })
    expect(result.index).toBe(false)
    expect(result.sitemap.include).toBe(false)
  })

  it('resolves document noindex and nofollow from compatible meta fields', () => {
    const result = effective('pages', { slug: 'x', _status: 'published', meta: { noindex: true, nofollow: true } })
    expect(result).toMatchObject({ index: false, follow: false, sitemap: { include: false } })
  })

  it('resolves string robots directives', () => {
    expect(effective('pages', { slug: 'x', robots: 'noindex, follow' })).toMatchObject({ index: false, follow: true })
    expect(effective('pages', { slug: 'x', meta: { robots: 'index, nofollow' } })).toMatchObject({ index: true, follow: false })
  })

  it('supports collection and document sitemap exclusion', () => {
    expect(effective('projects', { slug: 'x' }, true, { collections: [{ collection: 'projects', sitemapEnabled: false }] }).sitemap.include).toBe(false)
    expect(effective('pages', { slug: 'x', sitemap: { exclude: true } }).sitemap.include).toBe(false)
  })

  it('preserves legacy exclusions and priority overrides', () => {
    const settings = { sitemap: { excludedSlugs: [{ slug: 'private/*' }], priorityOverrides: [{ slugPattern: 'featured/*', priority: 0.9, changefreq: 'daily' }] } }
    expect(effective('pages', { slug: 'private/a' }, true, settings).sitemap.include).toBe(false)
    expect(effective('pages', { slug: 'featured/a' }, true, settings).sitemap).toMatchObject({ priority: 0.9, changeFrequency: 'daily' })
  })

  it('preserves root/home compatibility defaults', () => {
    expect(effective('pages', { slug: 'home' }).sitemap).toMatchObject({ priority: 1, changeFrequency: 'weekly' })
    expect(effective('pages', { slug: '' }).canonicalUrl).toBe('https://example.com')
  })

  it('uses safe computed canonical for invalid overrides', () => {
    expect(effective('pages', { slug: 'x', canonicalUrl: 'javascript:alert(1)' }).canonicalUrl).toBe('https://example.com/x')
  })

  it('preserves valid internal and external canonical overrides', () => {
    expect(effective('pages', { slug: 'x', canonicalUrl: '/preferred' }).canonicalUrl).toBe('https://example.com/preferred')
    expect(effective('pages', { slug: 'x', canonicalUrl: 'https://other.example/resource' }).canonicalUrl).toBe('https://other.example/resource')
  })

  it('fails closed when no valid canonical origin exists', () => {
    const model = createSiteModel({ collections: ['pages'] })
    const policy = normalizeTechnicalSeoPolicy(undefined, ['pages'])
    expect(resolveTechnicalSeo({ siteModel: model, policy, identity: { collection: 'pages', slug: 'x' }, document: { slug: 'x' }, publicEligible: true }).canonicalUrl).toBeNull()
  })

  it('validates admin collection settings against registered collections', () => {
    expect(validateTechnicalSeoSettings({ collections: [{ collection: 'unknown', sitemapPriority: 2, sitemapChangeFrequency: 'sometimes', defaultSchemaType: 'Thing' }] }, ['pages'])).toHaveLength(4)
  })
})

describe('robots and site identity policies', () => {
  it('provides safe defaults and the canonical sitemap reference', () => {
    const text = buildRobotsTxt(normalizeRobotsPolicy(), 'https://example.com/sitemap.xml')
    expect(text).toContain('Disallow: /admin/*')
    expect(text).toContain('Disallow: /api/*')
    expect(text).toContain('Sitemap: https://example.com/sitemap.xml')
  })

  it('drops injected agents and invalid path directives', () => {
    const policy = normalizeRobotsPolicy({ userAgent: '*\nDisallow: /', allow: [{ path: '/public' }], disallow: [{ path: 'relative' }, { path: '/safe' }] })
    expect(policy.userAgent).toBe('*')
    expect(policy.allow).toEqual(['/public'])
    expect(policy.disallow).toEqual(['/safe'])
  })

  it('omits sitemap output when origin is unavailable', () => {
    expect(buildRobotsTxt(normalizeRobotsPolicy(), null)).not.toContain('Sitemap:')
  })

  it('normalizes site-level Organization and WebSite identity', () => {
    expect(resolveSiteIdentity(siteModel)).toEqual({
      root: 'https://example.com',
      organizationId: 'https://example.com/#organization',
      websiteId: 'https://example.com/#website',
    })
  })

  it('invalidates settings-derived sitemap and robots output', () => {
    seoCache.set('sitemap-xml:test', 'old')
    seoCache.set('robots-txt:test', 'old')
    seoCache.set('unrelated:test', 'keep')
    invalidateTechnicalSeoCaches()
    expect(seoCache.get('sitemap-xml:test')).toBeNull()
    expect(seoCache.get('robots-txt:test')).toBeNull()
    expect(seoCache.get('unrelated:test')).toBe('keep')
    seoCache.invalidate()
  })
})

describe('official Payload SEO compatibility', () => {
  it('detects reusable group fields without importing the official plugin', () => {
    expect(detectPayloadSeoFields([{ name: 'meta', type: 'group', fields: [
      { name: 'title' }, { name: 'description' }, { name: 'image' }, { name: 'canonicalUrl' }, { name: 'noindex' },
    ] }])).toMatchObject({ container: 'group', title: true, description: true, image: true, canonical: true, noindex: true })
  })

  it('detects tab form and reports absent fields', () => {
    expect(detectPayloadSeoFields([{ type: 'tabs', tabs: [{ name: 'meta', fields: [{ name: 'title' }, { name: 'description' }] }] }])).toMatchObject({ container: 'tab', title: true, description: true, image: false })
  })
})

describe('cross-producer technical consistency', () => {
  it('shares canonical, sitemap, metadata, JSON-LD, and robots sitemap identity', () => {
    const document = { slug: 'one', title: 'One', _status: 'published' }
    const policy = normalizeTechnicalSeoPolicy(undefined, ['projects'])
    const resolved = resolveTechnicalSeo({ siteModel, policy, identity: { collection: 'projects', slug: 'one' }, document, publicEligible: true })
    const metadata = buildSeoMetadata(document, { collection: 'projects', siteUrl: 'https://example.com', collectionRoutes: { projects: 'work' }, technicalSeoPolicy: policy })
    const schema = buildJsonLd(document, { collection: 'projects', siteUrl: 'https://example.com', collectionRoutes: { projects: 'work' }, technicalSeoPolicy: policy })
    const robots = buildRobotsTxt(normalizeRobotsPolicy(), 'https://example.com/sitemap.xml')
    expect(resolved.canonicalUrl).toBe('https://example.com/work/one')
    expect(resolved.sitemap.include).toBe(true)
    expect(metadata.alternates?.canonical).toBe(resolved.canonicalUrl)
    expect(metadata.openGraph?.url).toBe(resolved.canonicalUrl)
    expect(schema.jsonLd.url).toBe(resolved.canonicalUrl)
    expect(robots).toContain('Sitemap: https://example.com/sitemap.xml')
  })
})
