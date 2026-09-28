import type { Payload } from 'payload'
import {
  normalizeTechnicalSeoPolicy,
  type StoredTechnicalSeoSettings,
  type TechnicalSeoPolicy,
} from '../../core/technicalSeo/index.js'

const policyCache = new WeakMap<Payload, Map<string, { policy: TechnicalSeoPolicy; settings?: Record<string, unknown> }>>()

export function invalidateTechnicalSeoPolicyCache(payload?: Payload): void {
  if (payload) policyCache.delete(payload)
}

export function technicalSeoSettingsInput(settings: Record<string, unknown> | undefined): StoredTechnicalSeoSettings {
  const technical = settings?.technicalSeo as Record<string, unknown> | undefined
  return {
    collections: technical?.collections,
    sitemap: settings?.sitemap as StoredTechnicalSeoSettings['sitemap'],
  }
}

export function policyCacheScope(policy: TechnicalSeoPolicy, origin: string | null, locale?: string): string {
  return JSON.stringify({ origin, locale: locale ?? '', policy })
}

export async function loadTechnicalSeoPolicy(
  payload: Payload,
  knownCollections: readonly string[],
): Promise<{ policy: TechnicalSeoPolicy; settings?: Record<string, unknown> }> {
  const key = [...knownCollections].sort().join(',')
  const cached = policyCache.get(payload)?.get(key)
  if (cached) return cached
  const result = await payload.find({ collection: 'seo-settings', limit: 1, overrideAccess: true })
  const settings = result.docs[0] as Record<string, unknown> | undefined
  const loaded = {
    settings,
    policy: normalizeTechnicalSeoPolicy(technicalSeoSettingsInput(settings), knownCollections),
  }
  const entries = policyCache.get(payload) ?? new Map()
  entries.set(key, loaded)
  policyCache.set(payload, entries)
  return loaded
}
