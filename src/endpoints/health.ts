/**
 * SEO module health / observability (SEO 2026).
 *
 *   GET /health → a read-only snapshot of the module's configuration + background-job state, so
 *   you can see at a glance whether the AI/GSC/PSI integrations are configured and whether the
 *   periodic jobs (rank tracking, alerts) are actually running. For "reference-grade, nothing
 *   left to optimize", silent failures must be visible.
 *
 * No secret values are returned — only booleans (configured / connected) and timestamps. Admin only.
 */
import type { PayloadHandler } from 'payload'
import type { SeoConfig } from '../types.js'
import { resolveSiteModel } from '../helpers/siteModel.js'
import { seoCache } from '../cache.js'
import { getGscOAuthConfig, getOrCreateGscAuthDoc } from '../helpers/gscClient.js'
import { aiModel } from '../helpers/aiModel.js'

import { isSeoAdminRequest as isAdmin } from '../helpers/isAdmin.js'
import type { SeoCapabilityStatus } from '../plugin/capabilities.js'

export function createSeoHealthHandler(basePath: string, seoConfig?: SeoConfig, capabilities?: readonly SeoCapabilityStatus[]): PayloadHandler {
  return async (req) => {
    try {
      if (!isAdmin(req)) return Response.json({ error: 'Forbidden' }, { status: 403 })

      // --- Env configuration (booleans only, never the values) ---
      // Direct handler consumers predate the capability registry; preserve that public API.
      const enabled = (id: string) => capabilities === undefined || capabilities.some((capability) => capability.id === id && capability.enabled)
      const config = {
        aiKey: enabled('ai') && !!process.env.ANTHROPIC_API_KEY,
        aiModel: enabled('ai') ? aiModel() : null,
        pageSpeedKey: enabled('pageSpeed') && !!(process.env.PAGESPEED_API_KEY || process.env.GOOGLE_PAGESPEED_API_KEY),
        gscConfigured: enabled('googleSearchConsole') && !!getGscOAuthConfig(basePath, seoConfig),
        gscEncryptionKey: enabled('googleSearchConsole') && !!process.env.SEO_GSC_ENCRYPTION_KEY,
        alertWebhook: enabled('alerts') && !!process.env.SEO_ALERT_WEBHOOK_URL,
        alertEmail: enabled('alerts') && !!process.env.SEO_ALERT_EMAIL,
        indexNowKey: enabled('indexNow') && !!process.env.SEO_INDEXNOW_KEY,
        siteUrl: resolveSiteModel(seoConfig).origin,
      }

      // --- Runtime cache state ---
      const cacheStats = seoCache.stats()
      const auditCached = cacheStats.keys.some((k) => k === 'audit' || k.startsWith('audit:'))

      // --- GSC connection + last rank snapshot ---
      let gscConnected = false
      let gscEmail: string | null = null
      let lastRankSnapshot: string | null = null
      if (enabled('googleSearchConsole')) try {
        const authDoc = await getOrCreateGscAuthDoc(req.payload)
        gscConnected = !!authDoc.refreshTokenEnc
        gscEmail = (authDoc.connectedEmail as string) || null
      } catch {
        /* collection absent */
      }
      if (enabled('rankTracking')) try {
        const latest = await req.payload.find({
          collection: 'seo-rank-history',
          sort: '-snapshotDate',
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        lastRankSnapshot = (latest.docs[0]?.snapshotDate as string) || null
      } catch {
        /* collection absent */
      }

      // --- Derived warnings (what to fix) ---
      const warnings: string[] = []
      if (enabled('ai') && !config.aiKey) warnings.push('AI integration enabled but its provider credential is not configured.')
      if (config.gscConfigured && !gscConnected) warnings.push('GSC configured but not connected — rank tracking & CTR opportunities inactive.')
      if (config.gscConfigured && !config.gscEncryptionKey) warnings.push('SEO_GSC_ENCRYPTION_KEY not set — GSC token encrypted with a derived key (set an explicit key for stability).')
      if (enabled('alerts') && !config.alertWebhook && !config.alertEmail) warnings.push('Alerts are enabled but no delivery channel is configured.')

      return Response.json(
        {
          ok: warnings.length === 0,
          config,
          runtime: {
            auditCached,
            cacheKeys: cacheStats.size,
            gscConnected,
            gscEmail,
            lastRankSnapshot,
          },
          warnings,
          capabilities: capabilities ?? [],
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] health error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
