import { seoCache } from '../../cache.js'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

export const TECHNICAL_OUTPUT_CACHE_BASES = [
  'sitemap-xml',
  'sitemap-news',
  'sitemap-images',
  'sitemap-video',
  'robots-txt',
] as const

export function invalidateTechnicalSeoCaches(): void {
  for (const base of TECHNICAL_OUTPUT_CACHE_BASES) seoCache.invalidateByPrefix(base)
}

/** Core target-collection hooks: sitemap output is rebuilt lazily on the next request. */
export function createSitemapCacheInvalidationHooks(): {
  afterChange: CollectionAfterChangeHook
  afterDelete: CollectionAfterDeleteHook
} {
  return {
    afterChange: ({ doc }) => {
      seoCache.invalidateByPrefix('sitemap-xml')
      return doc
    },
    afterDelete: ({ doc }) => {
      seoCache.invalidateByPrefix('sitemap-xml')
      return doc
    },
  }
}
