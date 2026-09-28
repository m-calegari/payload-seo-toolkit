import { afterEach, describe, expect, it, vi } from 'vitest'
import { seoAnalyzerPlugin } from '../plugin.js'
import { createBackgroundServiceManager, type SeoBackgroundService } from '../plugin/backgroundServices.js'
import { CORE_ENDPOINTS, createCapabilityRegistry } from '../plugin/capabilities.js'

function baseConfig() {
  return {
    collections: [
      { slug: 'pages', fields: [] }, { slug: 'posts', fields: [] },
      { slug: 'media', fields: [], upload: true },
    ],
    globals: [], endpoints: [], admin: {},
  } as never
}

function run(options: Record<string, unknown> = {}) {
  return seoAnalyzerPlugin({ collections: ['pages', 'posts'], ...options })(baseConfig()) as any
}

const paths = (config: any) => (config.endpoints ?? []).map((endpoint: any) => endpoint.path)
const slugs = (config: any) => (config.collections ?? []).map((collection: any) => collection.slug)
const views = (config: any) => Object.keys(config.admin?.components?.views ?? {})

describe('M6 capability registry', () => {
  afterEach(() => vi.restoreAllMocks())

  it('has a zero-cost core-only default', () => {
    const config = run()
    expect(slugs(config)).toEqual(['pages', 'posts', 'media', 'seo-settings'])
    expect(paths(config)).not.toEqual(expect.arrayContaining([
      '/seo-plugin/redirects', '/seo-plugin/schema-generator', '/seo-plugin/link-graph',
      '/seo-plugin/ai-rewrite', '/seo-plugin/gsc/status', '/seo-plugin/core-web-vitals',
      '/seo-plugin/indexnow-submit', '/seo-plugin/llms.txt', '/seo-plugin/sitemap-news.xml',
    ]))
    expect(views(config)).not.toEqual(expect.arrayContaining(['redirects', 'schema-builder', 'link-graph', 'performance']))
    expect(config.onInit).toBeUndefined()
    const pages = config.collections.find((collection: any) => collection.slug === 'pages')
    expect(pages.hooks?.beforeChange ?? []).toHaveLength(0)
    expect(pages.hooks?.afterChange ?? []).toHaveLength(0)
  })

  it.each([
    ['redirects', 'seo-redirects', '/seo-plugin/redirects', 'redirects'],
    ['advancedSchema', undefined, '/seo-plugin/schema-generator', 'schema-builder'],
    ['linkGraph', undefined, '/seo-plugin/link-graph', 'link-graph'],
  ] as const)('registers only the enabled %s module contribution', (id, collection, endpoint, view) => {
    const config = run({ modules: { [id]: true } })
    if (collection) expect(slugs(config)).toContain(collection)
    expect(paths(config)).toContain(endpoint)
    expect(views(config)).toContain(view)
    expect(paths(config)).not.toContain('/seo-plugin/ai-rewrite')
  })

  it('separates performance presentation from PageSpeed network behavior', () => {
    const local = run({ modules: { performance: true } })
    expect(paths(local)).toContain('/seo-plugin/performance')
    expect(paths(local)).not.toContain('/seo-plugin/core-web-vitals')
    const integrated = run({ modules: { performance: true }, integrations: { pageSpeed: true } })
    expect(paths(integrated)).toContain('/seo-plugin/core-web-vitals')
  })

  it.each([
    ['ai', '/seo-plugin/ai-rewrite'],
    ['googleSearchConsole', '/seo-plugin/gsc/status'],
    ['indexNow', '/seo-plugin/indexnow-submit'],
  ] as const)('gates the %s integration', (id, endpoint) => {
    expect(paths(run({ integrations: { [id]: true } }))).toContain(endpoint)
    expect(paths(run())).not.toContain(endpoint)
  })

  it('rejects unknown IDs and disabled dependencies early', () => {
    expect(() => run({ modules: { mystery: true } })).toThrow(/Unknown module capability: mystery/)
    expect(() => run({ integrations: { pageSpeed: true } })).toThrow(/requires "performance"/)
    expect(() => run({ backgroundServices: { rankTracking: true } })).toThrow(/requires "googleSearchConsole"/)
  })

  it('maps the inherited features object through the same registry', () => {
    const legacy = createCapabilityRegistry({ features: { redirects: false, aiFeatures: true, gscApi: true } })
    expect(legacy.isEnabled('redirects')).toBe(false)
    expect(legacy.isEnabled('ai')).toBe(true)
    expect(legacy.isEnabled('googleSearchConsole')).toBe(true)
    expect(legacy.isEnabled('rankTracking')).toBe(true)
    // Historical partial-feature semantics remain intact.
    expect(legacy.isEnabled('linkGraph')).toBe(true)
  })

  it('publishes sanitized status without credential values', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'do-not-expose')
    const config = run({ integrations: { ai: true } })
    const status = config.admin.custom.seoAnalyzer.capabilities
    expect(status.find((entry: any) => entry.id === 'ai')).toMatchObject({ enabled: true, available: true })
    expect(JSON.stringify(status)).not.toContain('do-not-expose')
  })

  it('gives every registered endpoint a core or enabled-capability owner', () => {
    const config = run({
      modules: { redirects: true, advancedSchema: true, linkGraph: true, cannibalization: true, keywordResearch: true, performance: true, duplicateContent: true, externalLinks: true, sitemapAudit: true, scoreHistory: true, seoLogs: true, specializedSitemaps: true, llmsTxt: true },
      integrations: { ai: true, googleSearchConsole: true, pageSpeed: true, indexNow: true },
      backgroundServices: { rankTracking: true, alerts: true },
      retentionDays: { 'seo-logs': 30 },
    })
    const owned = new Set<string>(CORE_ENDPOINTS)
    for (const capability of config.admin.custom.seoAnalyzer.capabilities) {
      for (const endpoint of capability.ownership.endpoints ?? []) owned.add(endpoint)
    }
    for (const path of paths(config)) {
      expect(owned.has(path.replace('/seo-plugin/', '')), `missing owner for ${path}`).toBe(true)
    }
  })
})

describe('background service lifecycle', () => {
  it('is idempotent and supports cleanup', () => {
    vi.useFakeTimers()
    let timer: ReturnType<typeof setInterval> | undefined
    const start = vi.fn(() => { timer = setInterval(() => undefined, 1000) })
    const stop = vi.fn(() => { if (timer) clearInterval(timer) })
    const service: SeoBackgroundService = { id: 'warmCache', start, stop }
    const manager = createBackgroundServiceManager([service])
    manager.start({} as never)
    expect(vi.getTimerCount()).toBe(1)
    manager.start({} as never)
    expect(stop).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)
    manager.stop()
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
  })
})
