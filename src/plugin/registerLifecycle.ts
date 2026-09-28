import type { Config } from 'payload'
import type { SeoConfig, SeoFeatures } from '../types.js'
import { startCacheWarmUp } from '../warmCache.js'
import { startRankTracker } from '../rankTracker.js'
import { startAlertsScheduler } from '../alertsScheduler.js'
import { startRetentionPurge } from '../retentionScheduler.js'
import { resolveGscSiteUrl } from '../helpers/gscClient.js'
import type { SeoPluginConfig } from './types.js'

export interface LifecycleRegistration {
  basePath: string
  targetCollections: string[]
  targetGlobals: string[]
  seoConfig: SeoConfig
  features: Required<SeoFeatures>
  pluginConfig: SeoPluginConfig
}

/** Keep all startup side effects visible behind one composition boundary. */
export function registerLifecycle(config: Config, options: LifecycleRegistration): void {
  const { basePath, targetCollections, targetGlobals, seoConfig, features, pluginConfig } = options
  const existingOnInit = config.onInit
  config.onInit = async (payload) => {
    if (existingOnInit) await existingOnInit(payload)
    if (features.warmCache) startCacheWarmUp(payload, basePath, targetGlobals, targetCollections)
    if (features.gscApi) startRankTracker(payload, basePath, seoConfig)
    if (features.alerts) startAlertsScheduler(payload, resolveGscSiteUrl(seoConfig))
    startRetentionPurge(payload, pluginConfig.retentionDays)
  }
}
