import type { Config } from 'payload'
import type { SeoConfig } from '../types.js'
import type { SeoPluginConfig } from './types.js'
import type { SeoCapabilityRegistry } from './capabilities.js'
import { createBackgroundServiceManager, createBackgroundServices } from './backgroundServices.js'

export interface LifecycleRegistration {
  basePath: string
  targetCollections: string[]
  targetGlobals: string[]
  seoConfig: SeoConfig
  capabilities: SeoCapabilityRegistry
  pluginConfig: SeoPluginConfig
}

/** Keep all startup side effects visible behind one composition boundary. */
export function registerLifecycle(config: Config, options: LifecycleRegistration): void {
  const { basePath, targetCollections, targetGlobals, seoConfig, capabilities, pluginConfig } = options
  const services = createBackgroundServices(capabilities, {
    basePath, collections: targetCollections, globals: targetGlobals, seoConfig,
    retention: pluginConfig.retentionDays,
  })
  if (services.length === 0) return
  const manager = createBackgroundServiceManager(services)
  const existingOnInit = config.onInit
  config.onInit = async (payload) => {
    if (existingOnInit) await existingOnInit(payload)
    manager.start(payload)
  }
}
