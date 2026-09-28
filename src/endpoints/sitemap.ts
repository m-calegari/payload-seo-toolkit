/**
 * XML Sitemap endpoint handler.
 * GET — Dynamically generates sitemap.xml from published documents
 * across all target collections, respecting seo-settings configuration.
 */

import type { PayloadHandler } from 'payload'
import type { SeoConfig } from '../types.js'
import { resolveDocumentPath, resolveDocumentUrl } from '../core/urls/resolver.js'
import { resolveSiteModel } from '../helpers/siteModel.js'
import { fetchAllDocs } from '../helpers/fetchAllDocs.js'
import { seoCache } from '../cache.js'
import { isPubliclyReadableDocument } from '../helpers/publicSeoDocument.js'
import { resolveTechnicalSeo } from '../core/technicalSeo/index.js'
import { loadTechnicalSeoPolicy, policyCacheScope } from '../payload/technicalSeo/settings.js'

/**
 * Cache key base for the rendered XML. Scoped by the collections the handler was
 * built with (never by anything the caller sends): the document is identical for
 * every anonymous visitor, so a shared entry leaks nothing and is no oracle.
 * Cleared by the same afterChange invalidation as the other caches — see
 * CACHE_BASES in hooks/trackSeoScore.ts.
 */
export const SITEMAP_XML_CACHE_BASE = 'sitemap-xml'

/**
 * Memory cap for the public sitemap build.
 *
 * This handler used to pass a hard-coded `limit: 10000` to fetchAllDocs, which
 * takes precedence over SEO_FETCH_MAX_DOCS: an operator lowering that variable to
 * survive on a constrained host still loaded 10 000 documents on every ANONYMOUS
 * request. The cap now comes from the environment, like every other site-wide read,
 * and reuses the SEO_SITEMAP_MAX_DOCS name already honoured by the news/image/video
 * sitemaps so the two public paths share one knob.
 */
function sitemapMaxDocs(): number {
  const raw = process.env.SEO_SITEMAP_MAX_DOCS ?? process.env.SEO_FETCH_MAX_DOCS
  const parsed = raw != null ? parseInt(raw, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000
}

/** Escape special XML characters */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

interface SitemapUrl {
  loc: string
  lastmod?: string
  changefreq?: string
  priority?: string
}

/**
 * GET handler — generates sitemap.xml dynamically.
 * Public endpoint, no authentication required.
 */
export function createSitemapHandler(
  targetCollections: string[],
  seoConfig?: SeoConfig,
): PayloadHandler {
  const xmlResponse = (xml: string) =>
    new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })

  return async (req) => {
    try {
      // Serve the rendered XML when it is still warm. Without this, every anonymous
      // hit re-scanned the whole corpus — the most expensive request in the plugin,
      // on its only unauthenticated (and deliberately un-rate-limited) endpoint.
      // Staleness stays bounded by the cache TTL, which is well under the one-hour
      // Cache-Control this endpoint has always advertised.
      const siteModel = resolveSiteModel(seoConfig, targetCollections)
      const { policy } = await loadTechnicalSeoPolicy(req.payload, targetCollections)
      const cacheKey = `${SITEMAP_XML_CACHE_BASE}:${targetCollections.join(',')}:${policyCacheScope(policy, siteModel.origin, seoConfig?.locale)}`
      const cachedXml = seoCache.get<string>(cacheKey)
      if (typeof cachedXml === 'string') return xmlResponse(cachedXml)

      // Fetch all published documents from target collections
      const allDocs = await fetchAllDocs(req.payload, {
        collections: targetCollections,
        depth: 0,
        maxDocs: sitemapMaxDocs(),
        access: 'public',
      })

      const urls: SitemapUrl[] = []

      for (const { doc, sourceSlug: collectionSlug } of allDocs) {
        // Anonymous collection access establishes public readability; this predicate
        // additionally enforces publication and indexability.
        const publicEligible = isPubliclyReadableDocument(doc)

        const slug: string = doc.slug || ''

        // Prefix by the collection route (posts → /posts/<slug> by default):
        // emitting the bare slug for a `posts` document declares a 404 to
        // Googlebot and wastes crawl budget.
        const identity = { collection: collectionSlug, slug }
        const technical = resolveTechnicalSeo({ siteModel, policy, identity, document: doc, publicEligible })
        if (!technical.sitemap.include) continue
        const documentUrl = resolveDocumentUrl(siteModel, identity) ?? resolveDocumentPath(siteModel, identity)

        urls.push({
          loc: documentUrl,
          lastmod: doc.updatedAt
            ? new Date(doc.updatedAt).toISOString().split('T')[0]
            : undefined,
          changefreq: technical.sitemap.changeFrequency,
          priority: technical.sitemap.priority.toFixed(1),
        })
      }

      // Build XML
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      for (const url of urls) {
        xml += '  <url>\n'
        xml += `    <loc>${escapeXml(url.loc)}</loc>\n`
        if (url.lastmod) xml += `    <lastmod>${url.lastmod}</lastmod>\n`
        if (url.changefreq) xml += `    <changefreq>${url.changefreq}</changefreq>\n`
        if (url.priority) xml += `    <priority>${url.priority}</priority>\n`
        xml += '  </url>\n'
      }
      xml += '</urlset>'

      seoCache.set(cacheKey, xml)
      return xmlResponse(xml)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] sitemap.xml generation error: ${message}`)
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
        {
          headers: { 'Content-Type': 'application/xml' },
          status: 500,
        },
      )
    }
  }
}
