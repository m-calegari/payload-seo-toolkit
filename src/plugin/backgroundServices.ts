import type { Payload } from 'payload'
import type { SeoConfig } from '../types.js'
import { startCacheWarmUp, stopCacheWarmUp } from '../warmCache.js'
import { startRankTracker, stopRankTracker } from '../rankTracker.js'
import { startAlertsScheduler, stopAlertsScheduler } from '../alertsScheduler.js'
import { startRetentionPurge, stopRetentionPurge } from '../retentionScheduler.js'
import { resolveGscSiteUrl } from '../helpers/gscClient.js'
import type { RetentionConfig } from '../retention.js'
import type { SeoBackgroundServiceId, SeoCapabilityRegistry } from './capabilities.js'

export interface SeoBackgroundService {
  id: SeoBackgroundServiceId
  start(payload: Payload): void
  stop(): void
}

interface BackgroundServiceContext {
  basePath: string
  collections: string[]
  globals: string[]
  seoConfig: SeoConfig
  retention?: RetentionConfig
}

export function createBackgroundServices(
  registry: SeoCapabilityRegistry,
  context: BackgroundServiceContext,
): SeoBackgroundService[] {
  const services: SeoBackgroundService[] = []
  if (registry.isEnabled('warmCache')) services.push({
    id: 'warmCache',
    start: (payload) => startCacheWarmUp(payload, context.basePath, context.globals, context.collections),
    stop: stopCacheWarmUp,
  })
  if (registry.isEnabled('rankTracking')) services.push({
    id: 'rankTracking',
    start: (payload) => startRankTracker(payload, context.basePath, context.seoConfig),
    stop: stopRankTracker,
  })
  if (registry.isEnabled('alerts')) services.push({
    id: 'alerts',
    start: (payload) => startAlertsScheduler(payload, resolveGscSiteUrl(context.seoConfig)),
    stop: stopAlertsScheduler,
  })
  if (registry.isEnabled('retention')) services.push({
    id: 'retention',
    start: (payload) => startRetentionPurge(payload, context.retention),
    stop: stopRetentionPurge,
  })
  return services
}

/** One logical instance per plugin composition; repeated starts first clean up prior timers. */
export function createBackgroundServiceManager(services: readonly SeoBackgroundService[]) {
  let running = false
  return {
    start(payload: Payload): void {
      if (running) for (const service of services) service.stop()
      for (const service of services) service.start(payload)
      running = true
    },
    stop(): void {
      for (const service of services) service.stop()
      running = false
    },
    ids: services.map(({ id }) => id),
  }
}
