import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { readAccessOpts } from '../helpers/readAccess.js'
import { hardenedRequest, isPrivateIP, isPrivateUrl } from '../helpers/ssrfGuard.js'
import { createValidateHandler } from '../endpoints/validate.js'
import { createGenerateHandler } from '../endpoints/generate.js'
import { createBreadcrumbHandler } from '../endpoints/breadcrumb.js'
import { createSchemaGeneratorHandler } from '../endpoints/schemaGenerator.js'
import { createAiRewriteHandler } from '../endpoints/aiRewrite.js'
import { createAiContentBriefHandler } from '../endpoints/aiContentBrief.js'
import { createAiOptimizeHandler } from '../endpoints/aiOptimize.js'
import { createSitemapHandler } from '../endpoints/sitemap.js'
import { createImageSitemapHandler, createNewsSitemapHandler, createVideoSitemapHandler } from '../endpoints/sitemapExtensions.js'
import { seoCache } from '../cache.js'
import { providerHttpError } from '../helpers/providerError.js'

const user = { id: 7, collection: 'users', role: 'editor' }
const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
const config = { admin: { user: 'users' } }

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.NEXT_PUBLIC_SERVER_URL
  for (const key of ['sitemap-xml', 'sitemap-news', 'sitemap-images', 'sitemap-video']) {
    seoCache.invalidateByPrefix(key)
  }
})

describe('caller-scoped document authorization', () => {
  it('uses caller access by default with no compatibility escape hatch', () => {
    process.env.SEO_STRICT_READ_ACCESS = '0'
    expect(readAccessOpts({ user } as any)).toEqual({ overrideAccess: false, user })
    delete process.env.SEO_STRICT_READ_ACCESS
  })

  it.each([
    ['validate', async (payload: any) => createValidateHandler(['pages'])({ user, method: 'GET', url: 'http://x/validate?id=secret&collection=pages', payload } as any)],
    ['generate', async (payload: any) => createGenerateHandler({ generateTitle: () => 'generated' }, ['pages'])({ user, json: async () => ({ type: 'title', collectionSlug: 'pages', docId: 'secret' }), payload } as any)],
    ['schema', async (payload: any) => createSchemaGeneratorHandler(['pages'])({ user, url: 'http://x/schema?collection=pages&id=secret', payload } as any)],
    ['ai-rewrite', async (payload: any) => createAiRewriteHandler(['pages'])({ user, json: async () => ({ collection: 'pages', id: 'secret', field: 'title' }), payload } as any)],
  ])('%s never elevates its document read', async (_name, invoke) => {
    const findByID = vi.fn(async (args: any) => {
      expect(args.overrideAccess).toBe(false)
      expect(args.user).toBe(user)
      throw new Error('forbidden')
    })
    const payload = {
      config,
      logger,
      findByID,
      find: vi.fn(async () => ({ docs: [], hasNextPage: false })),
    }
    await invoke(payload)
    expect(findByID).toHaveBeenCalled()
  })

  it('breadcrumb applies caller access to every collection lookup', async () => {
    const find = vi.fn(async (args: any) => {
      expect(args.overrideAccess).toBe(false)
      expect(args.user).toBe(user)
      return { docs: [], hasNextPage: false }
    })
    await createBreadcrumbHandler(['pages'])({
      user,
      url: 'http://x/breadcrumb?slug=secret&collection=pages',
      payload: { config, logger, find },
    } as any)
    expect(find).toHaveBeenCalled()
  })

  it('allows the same endpoint flow when Payload authorizes the caller', async () => {
    const findByID = vi.fn(async () => ({ id: 'ok', slug: 'public', title: 'Public page' }))
    const response = await createSchemaGeneratorHandler(['pages'])({
      user,
      url: 'http://x/schema?collection=pages&id=ok',
      payload: { config, logger, findByID },
    } as any)
    expect(response.status).toBe(200)
    expect(findByID.mock.calls[0][0]).toMatchObject({ overrideAccess: false, user })
  })

  it('does not call Anthropic when selected brief context is inaccessible', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not run'))
    const response = await createAiContentBriefHandler(['pages'])({
      user,
      json: async () => ({ keyword: 'secure seo', collection: 'pages', id: 'secret' }),
      payload: { config, logger, findByID: vi.fn(async () => { throw new Error('forbidden') }) },
    } as any)
    expect(response.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not call Anthropic when optimize cannot read the selected document', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not run'))
    const response = await createAiOptimizeHandler(['pages'])({
      user,
      locale: 'en',
      json: async () => ({ collection: 'pages', id: 'secret' }),
      payload: {
        config,
        logger,
        find: vi.fn(async () => ({ docs: [] })),
        findByID: vi.fn(async (args: any) => {
          expect(args).toMatchObject({ overrideAccess: false, user })
          throw new Error('forbidden')
        }),
      },
    } as any)
    expect(response.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('provider error privacy', () => {
  it('retains status and request id without consuming or exposing the response body', () => {
    const error = providerHttpError('Anthropic', new Response('sensitive prompt echo', {
      status: 500,
      headers: { 'request-id': 'req-safe-123' },
    }))
    expect(error.message).toContain('HTTP 500')
    expect(error.message).toContain('req-safe-123')
    expect(error.message).not.toContain('sensitive prompt echo')
  })
})

type FakeResponse = { status: number; headers?: Record<string, string>; body?: string }

function fakeTransport(sequence: FakeResponse[], connected: string[] = []) {
  return ((options: any, callback: (res: any) => void) => {
    const request = new EventEmitter() as any
    request.setTimeout = vi.fn()
    request.destroy = (error: Error) => request.emit('error', error)
    request.end = () => {
      options.lookup(options.hostname, {}, (error: Error | null, address: string) => {
        if (error) return request.emit('error', error)
        connected.push(address)
        const next = sequence.shift()!
        const response = new EventEmitter() as any
        response.statusCode = next.status
        response.headers = next.headers ?? {}
        callback(response)
        if (next.body) response.emit('data', Buffer.from(next.body))
        response.emit('end')
      })
    }
    return request
  }) as any
}

describe('pinned-address outbound requests', () => {
  const publicResolver = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }])

  it.each([
    '127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254',
    '::1', 'fc00::1', 'fe80::1', '::', 'ff02::1',
  ])('blocks private/reserved address %s', (address) => {
    expect(isPrivateIP(address)).toBe(true)
  })

  it.each([
    'http://localhost/', 'http://user:pass@example.com/', 'ftp://example.com/',
    'http://[::1]/', 'http://169.254.169.254/latest/meta-data/',
  ])('blocks unsafe URL %s', (url) => {
    expect(isPrivateUrl(url)).toBe(true)
  })

  it('pins the validated address into the socket lookup (DNS rebinding regression)', async () => {
    const connected: string[] = []
    const transport = fakeTransport([{ status: 200, body: 'ok' }], connected)
    const result = await hardenedRequest('https://example.com/a', {
      resolver: publicResolver,
      transports: { http: transport, https: transport },
      maxResponseBytes: 10,
    })
    expect(result.status).toBe(200)
    expect(publicResolver).toHaveBeenCalledTimes(1)
    expect(connected).toEqual(['93.184.216.34'])
  })

  it('blocks a redirect to a private destination before a second connection', async () => {
    const connected: string[] = []
    const transport = fakeTransport([{ status: 302, headers: { location: 'http://127.0.0.1/secret' } }], connected)
    await expect(hardenedRequest('https://example.com/', {
      resolver: publicResolver,
      transports: { http: transport, https: transport },
    })).rejects.toThrow('blocked-private-ip')
    expect(connected).toHaveLength(1)
  })

  it('blocks redirect loops and excessive redirect chains', async () => {
    const transport = fakeTransport(Array.from({ length: 3 }, () => ({ status: 302, headers: { location: '/again' } })))
    await expect(hardenedRequest('https://example.com/', {
      resolver: publicResolver,
      transports: { http: transport, https: transport },
      maxRedirects: 2,
    })).rejects.toThrow('too-many-redirects')
  })

  it('revalidates redirect origins for allowlisted image-style requests', async () => {
    const transport = fakeTransport([{ status: 302, headers: { location: 'https://other.example/image.png' } }])
    await expect(hardenedRequest('https://media.example/image.png', {
      resolver: publicResolver,
      transports: { http: transport, https: transport },
      allowedOrigins: new Set(['https://media.example']),
    })).rejects.toThrow('blocked-origin')
  })

  it('rejects an oversized response while streaming', async () => {
    const transport = fakeTransport([{ status: 200, body: 'too large' }])
    await expect(hardenedRequest('https://example.com/', {
      resolver: publicResolver,
      transports: { http: transport, https: transport },
      maxResponseBytes: 2,
    })).rejects.toThrow('response-too-large')
  })
})

describe('public SEO document eligibility', () => {
  const publicDoc = { slug: 'public', title: 'Public', _status: 'published', publishedAt: new Date().toISOString(), meta: { image: { mimeType: 'image/png', url: '/public.png' } }, videoUrl: 'https://cdn.example/video.mp4' }
  const privateDoc = { slug: 'private', title: 'Private', _status: 'published', meta: { image: { mimeType: 'image/png', url: '/private.png' } }, videoUrl: 'https://cdn.example/private.mp4' }
  const draftDoc = { slug: 'draft', title: 'Draft', _status: 'draft' }
  const noindexDoc = { slug: 'hidden', title: 'Hidden', _status: 'published', noindex: true }

  function payloadForPublicAccess() {
    return {
      logger,
      find: vi.fn(async (args: any) => {
        if (args.collection === 'seo-settings') return { docs: [{ sitemap: {} }], hasNextPage: false }
        expect(args.overrideAccess).toBe(false)
        // Simulate Payload collection access excluding the private row.
        return { docs: [publicDoc, draftDoc, noindexDoc], hasNextPage: false }
      }),
    }
  }

  it('standard sitemap uses anonymous access and includes only public/indexable records', async () => {
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://site.example'
    const xml = await (await createSitemapHandler(['foundation-standard'])(
      { payload: payloadForPublicAccess(), url: 'http://x/sitemap.xml' } as any,
    )).text()
    expect(xml).toContain('/public')
    expect(xml).not.toContain(privateDoc.slug)
    expect(xml).not.toContain(draftDoc.slug)
    expect(xml).not.toContain(noindexDoc.slug)
  })

  it.each([
    ['news', createNewsSitemapHandler],
    ['images', createImageSitemapHandler],
    ['video', createVideoSitemapHandler],
  ])('%s sitemap applies the same anonymous access boundary', async (name, factory) => {
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://site.example'
    const xml = await (await factory([`foundation-${name}`])(
      { payload: payloadForPublicAccess(), url: `http://x/sitemap-${name}.xml` } as any,
    )).text()
    expect(xml).not.toContain('private')
    expect(xml).not.toContain('draft')
    expect(xml).not.toContain('hidden')
  })
})
