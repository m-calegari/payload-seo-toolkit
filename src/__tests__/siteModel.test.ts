import { afterEach, describe, expect, it } from 'vitest'
import {
  createSiteModel,
  normalizeSiteOrigin,
  resolveCanonicalUrl,
  resolveDocumentPath,
  resolveDocumentUrl,
  matchDocumentIdentityFromPath,
} from '../core/urls/index.js'
import { buildDocPath, buildDocUrl, getCollectionRoute } from '../helpers/docUrl.js'
import { resolveSiteModel } from '../helpers/siteModel.js'
import { buildSeoMetadata } from '../helpers/buildMetadata.js'
import { buildJsonLd } from '../helpers/buildSchema.js'
import { docToUrl } from '../endpoints/indexNow.js'
import { createSitemapHandler } from '../endpoints/sitemap.js'
import { createLlmsTxtHandler } from '../endpoints/llmsTxt.js'
import { matchPageRows } from '../endpoints/contentGrade.js'
import { seoCache } from '../cache.js'

const ORIGIN = 'https://example.com'

afterEach(() => {
  delete process.env.SEO_LLMS_TXT
  seoCache.invalidateByPrefix('sitemap-xml')
})

describe('Site Model and document resolver', () => {
  const model = createSiteModel({
    origin: `${ORIGIN}/ignored/base/`,
    collections: ['pages', 'posts', 'projects'],
    collectionRoutes: { projects: '/projects/' },
  })

  it.each([
    ['pages root', { collection: 'pages', slug: 'home' }, '/'],
    ['empty slug', { collection: 'pages', slug: '' }, '/'],
    ['page slug', { collection: 'pages', slug: 'about' }, '/about'],
    ['post default route', { collection: 'posts', slug: 'hello' }, '/posts/hello'],
    ['custom collection', { collection: 'projects', slug: 'hello' }, '/projects/hello'],
    ['leading/trailing slashes', { collection: 'projects', slug: '//hello//' }, '/projects/hello'],
    ['existing route prefix', { collection: 'posts', slug: '/posts/hello/' }, '/posts/hello'],
  ])('%s', (_name, identity, expected) => {
    expect(resolveDocumentPath(model, identity)).toBe(expected)
  })

  it('normalizes the origin and prevents duplicate slashes', () => {
    expect(model.origin).toBe(ORIGIN)
    expect(resolveDocumentUrl(model, { collection: 'posts', slug: '/hello/' })).toBe(`${ORIGIN}/posts/hello`)
  })

  it('supports custom and flat collection routes', () => {
    const custom = createSiteModel({
      origin: ORIGIN,
      collections: ['posts', 'projects'],
      collectionRoutes: { posts: '', projects: 'work' },
    })
    expect(resolveDocumentPath(custom, { collection: 'posts', slug: 'hello' })).toBe('/hello')
    expect(resolveDocumentPath(custom, { collection: 'projects', slug: 'hello' })).toBe('/work/hello')
  })

  it('rejects invalid or non-HTTP origins', () => {
    expect(normalizeSiteOrigin('not a url')).toBeNull()
    expect(normalizeSiteOrigin('ftp://example.com')).toBeNull()
    expect(normalizeSiteOrigin('https://user:secret@example.com')).toBeNull()
    expect(resolveDocumentUrl(createSiteModel({ origin: 'invalid' }), { collection: 'pages', slug: 'x' })).toBeNull()
  })

  it('resolves internal and external canonical overrides and rejects unsafe schemes', () => {
    const identity = { collection: 'posts', slug: 'hello' }
    expect(resolveCanonicalUrl(model, { identity, explicitCanonical: '/preferred' })).toBe(`${ORIGIN}/preferred`)
    expect(resolveCanonicalUrl(model, { identity, explicitCanonical: 'https://other.example/item' })).toBe('https://other.example/item')
    expect(resolveCanonicalUrl(model, { identity, explicitCanonical: 'javascript:alert(1)' })).toBe(`${ORIGIN}/posts/hello`)
  })

  it('distinguishes the same slug in different collections', () => {
    expect(resolveDocumentUrl(model, { collection: 'pages', slug: 'hello' })).toBe(`${ORIGIN}/hello`)
    expect(resolveDocumentUrl(model, { collection: 'posts', slug: 'hello' })).toBe(`${ORIGIN}/posts/hello`)
    expect(resolveDocumentUrl(model, { collection: 'projects', slug: 'hello' })).toBe(`${ORIGIN}/projects/hello`)
  })

  it('carries locale identity without inventing locale routing', () => {
    expect(resolveDocumentPath(model, { collection: 'posts', slug: 'hello', locale: 'fr' })).toBe('/posts/hello')
  })
})

describe('origin precedence and compatibility wrappers', () => {
  it('uses config, NEXT_PUBLIC, PAYLOAD_PUBLIC, then SERVER_URL', () => {
    const env = {
      NEXT_PUBLIC_SERVER_URL: 'https://next.example',
      PAYLOAD_PUBLIC_SERVER_URL: 'https://payload.example',
      SERVER_URL: 'https://server.example',
    }
    expect(resolveSiteModel({ siteUrl: 'https://config.example' }, [], env).origin).toBe('https://config.example')
    expect(resolveSiteModel(undefined, [], env).origin).toBe('https://next.example')
    expect(resolveSiteModel(undefined, [], { PAYLOAD_PUBLIC_SERVER_URL: env.PAYLOAD_PUBLIC_SERVER_URL, SERVER_URL: env.SERVER_URL }).origin).toBe('https://payload.example')
    expect(resolveSiteModel(undefined, [], { SERVER_URL: env.SERVER_URL }).origin).toBe('https://server.example')
    expect(resolveSiteModel({ siteUrl: 'invalid' }, [], env).origin).toBe('https://next.example')
    expect(resolveSiteModel(undefined, [], {}).origin).toBeNull()
  })

  it('keeps legacy helper return shapes while delegating to the resolver', () => {
    expect(buildDocPath('home', 'pages')).toBe('')
    expect(buildDocPath('hello', 'posts')).toBe('/posts/hello')
    expect(buildDocUrl(`${ORIGIN}/`, 'hello', 'posts')).toBe(`${ORIGIN}/posts/hello`)
    expect(getCollectionRoute('posts')).toBe('posts')
  })
})

describe('cross-producer document URL consistency', () => {
  it('uses one URL for canonical, OpenGraph, JSON-LD, IndexNow, sitemap, and llms.txt', async () => {
    const collection = 'articles-m2'
    const slug = 'consistent-url'
    const routes = { [collection]: 'blog' }
    const expected = `${ORIGIN}/blog/${slug}`
    const seoConfig = { siteUrl: ORIGIN, collectionRoutes: routes }
    const doc = {
      id: 'doc-1', slug, title: 'Consistent URL', _status: 'published',
      publishedAt: new Date().toISOString(), meta: { title: 'Consistent URL' },
    }
    const metadata = buildSeoMetadata(doc, { collection, siteUrl: ORIGIN, collectionRoutes: routes })
    const schema = buildJsonLd(doc, { collection, siteUrl: ORIGIN, collectionRoutes: routes, type: 'Article' })
    expect(metadata.alternates?.canonical).toBe(expected)
    expect(metadata.openGraph?.url).toBe(expected)
    expect((schema.jsonLd.mainEntityOfPage as Record<string, unknown>)['@id']).toBe(expected)
    expect(docToUrl(slug, ORIGIN, collection, routes)).toBe(expected)

    const payload = {
      logger: { error: () => {}, warn: () => {}, info: () => {} },
      find: async ({ collection: requested }: { collection: string }) => ({
        docs: requested === 'seo-settings' ? [] : [doc],
        hasNextPage: false,
        totalDocs: requested === 'seo-settings' ? 0 : 1,
      }),
    }
    const sitemap = await (await createSitemapHandler([collection], seoConfig as any)({ payload } as any)).text()
    expect(sitemap).toContain(`<loc>${expected}</loc>`)

    process.env.SEO_LLMS_TXT = '1'
    const llms = await (await createLlmsTxtHandler([collection], seoConfig as any)({ payload } as any)).text()
    expect(llms).toContain(`](${expected})`)
  })
})

describe('GSC path-aware matching', () => {
  it('maps routed same-slug documents to their collections and rejects ambiguous flat routes', () => {
    const routed = createSiteModel({
      collections: ['posts', 'projects'],
      collectionRoutes: { posts: 'blog', projects: 'projects' },
    })
    expect(matchDocumentIdentityFromPath(routed, '/blog/example', ['posts', 'projects'])).toEqual({ collection: 'posts', slug: 'example' })
    expect(matchDocumentIdentityFromPath(routed, '/projects/example', ['posts', 'projects'])).toEqual({ collection: 'projects', slug: 'example' })

    const flat = createSiteModel({ collections: ['pages', 'projects'], collectionRoutes: { pages: '', projects: '' } })
    expect(matchDocumentIdentityFromPath(flat, '/example', ['pages', 'projects'])).toBeNull()
  })

  it('content grading matches the full collection route rather than the last segment', () => {
    const rows = [
      { keys: [`${ORIGIN}/blog/example`, 'blog query'], impressions: 10, clicks: 1, ctr: 0.1, position: 3 },
      { keys: [`${ORIGIN}/projects/example`, 'project query'], impressions: 100, clicks: 10, ctr: 0.1, position: 3 },
    ]
    const result = matchPageRows(rows, {
      collection: 'posts',
      slug: 'example',
      collectionRoutes: { posts: 'blog', projects: 'projects' },
    })
    expect(result.matchedUrl).toBe(`${ORIGIN}/blog/example`)
    expect(result.queryRows[0]?.query).toBe('blog query')
  })
})
