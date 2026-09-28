import type { SeoConfig, SeoFeatures } from '../types.js'
import { createAutoRedirectHook } from '../hooks/autoRedirect.js'
import { createTrackSeoScoreGlobalHook, createTrackSeoScoreHook } from '../hooks/trackSeoScore.js'
import { createIndexNowHook } from '../endpoints/indexNow.js'

interface HookRegistrationOptions {
  features: Required<SeoFeatures>
  trackHistory: boolean
  redirectsSlug: string
  basePath: string
  seoConfig: SeoConfig
}

type Hookable = { hooks?: Record<string, unknown> }

function existingHooks(value: unknown): unknown[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

/** Attach module-owned hooks to a configured target collection. */
export function registerCollectionHooks<T extends Hookable>(
  collection: T,
  options: HookRegistrationOptions,
): T {
  const { features, trackHistory, redirectsSlug, basePath, seoConfig } = options
  const hooks = { ...(collection.hooks ?? {}) }
  if (features.redirects) {
    hooks.beforeChange = [
      ...existingHooks(hooks.beforeChange),
      createAutoRedirectHook(redirectsSlug),
    ]
  }
  if (trackHistory) {
    hooks.afterChange = [
      ...existingHooks(hooks.afterChange),
      createTrackSeoScoreHook(seoConfig),
    ]
  }
  if (features.indexNow) {
    hooks.afterChange = [
      ...existingHooks(hooks.afterChange),
      createIndexNowHook(basePath, seoConfig),
    ]
  }
  return { ...collection, hooks } as T
}

/** Globals have score history hooks but no slug redirect or IndexNow hook. */
export function registerGlobalHooks<T extends Hookable>(
  global: T,
  trackHistory: boolean,
  seoConfig: SeoConfig,
): T {
  if (!trackHistory) return global
  return {
    ...global,
    hooks: {
      ...(global.hooks ?? {}),
      afterChange: [
        ...existingHooks(global.hooks?.afterChange),
        createTrackSeoScoreGlobalHook(seoConfig),
      ],
    },
  } as T
}
