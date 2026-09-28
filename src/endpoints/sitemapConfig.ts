/**
 * Sitemap Config endpoint handler.
 * GET — returns sitemap configuration from seo-settings + a preview
 * of generated sitemap entries for all pages/posts.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler } from 'payload'
import type { SeoConfig } from '../types.js'
import { resolveDocumentPath } from '../core/urls/resolver.js'
import { resolveSiteModel } from '../helpers/siteModel.js'
import { fetchAllDocs } from '../helpers/fetchAllDocs.js'
import { isSeoPanelUser } from '../helpers/isAdmin.js'
import { loadTechnicalSeoPolicy } from '../payload/technicalSeo/settings.js'
import { resolveTechnicalSeo } from '../core/technicalSeo/index.js'
import { isPubliclyReadableDocument } from '../helpers/publicSeoDocument.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PriorityOverride {
  slugPattern: string
  priority: number
  changefreq?: string
}

interface SitemapPreviewEntry {
  url: string
  collection: string
  title: string
  changefreq: string
  priority: number
  lastmod: string
}

// ---------------------------------------------------------------------------
// Endpoint handler
// ---------------------------------------------------------------------------

export function createSitemapConfigHandler(
  targetCollections: string[],
  seoConfig?: SeoConfig,
): PayloadHandler {
  return async (req) => {
    try {
      if (!isSeoPanelUser(req)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { policy } = await loadTechnicalSeoPolicy(req.payload, targetCollections)
      const preview: SitemapPreviewEntry[] = []
      const siteModel = resolveSiteModel(seoConfig, targetCollections)
      let totalPages = 0
      let excludedCount = 0

      const allFetched = await fetchAllDocs(req.payload, {
        collections: targetCollections,
        depth: 0,
        maxDocs: 1000,
        access: 'public',
      })

      for (const { doc, sourceSlug: collectionSlug } of allFetched) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = doc as any
        const slug = (d.slug as string) || ''
        const title = (d.title as string) || ''

        totalPages++

        const identity = { collection: collectionSlug, slug }
        const effective = resolveTechnicalSeo({
          siteModel, policy, identity, document: d,
          publicEligible: isPubliclyReadableDocument(d),
        })
        if (!effective.sitemap.include) {
          excludedCount++
          continue
        }
        if (preview.length < 50) preview.push({
          // Same path builder as sitemap.xml (sitemap.ts): the preview must show
          // exactly what the generated sitemap will publish, collection route
          // prefix included. `|| '/'` keeps the home page displayable, where the
          // XML emits the bare site URL.
          url: resolveDocumentPath(siteModel, identity),
          collection: collectionSlug,
          title,
          changefreq: effective.sitemap.changeFrequency,
          priority: effective.sitemap.priority,
          lastmod: d.updatedAt || '',
        })
      }

      // Sort by priority descending, then alphabetically
      preview.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority
        return a.url.localeCompare(b.url)
      })

      return Response.json({
        config: {
          excludedSlugs: policy.excludedSlugs,
          defaultChangefreq: policy.defaults.sitemap.changeFrequency,
          defaultPriority: policy.defaults.sitemap.priority,
          priorityOverrides: policy.sitemapOverrides.map((entry) => ({
            slugPattern: entry.slugPattern,
            priority: entry.priority ?? policy.defaults.sitemap.priority,
            ...(entry.changeFrequency ? { changefreq: entry.changeFrequency } : {}),
          })),
        },
        preview,
        stats: {
          totalPages,
          excludedCount,
          includedCount: totalPages - excludedCount,
          previewLimit: 50,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] sitemap-config error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
