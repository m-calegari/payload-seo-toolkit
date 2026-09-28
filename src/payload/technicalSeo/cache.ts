import { seoCache } from '../../cache.js'

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
