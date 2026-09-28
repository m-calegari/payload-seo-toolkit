/**
 * SEO Settings endpoint handler.
 * GET — returns current settings from the seo-settings collection.
 * PATCH — updates (or creates) the singleton settings document.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler } from 'payload'
import { parseJsonBody } from '../helpers/parseBody.js'

import { isSeoAdminRequest as isAdmin, isSeoPanelUser } from '../helpers/isAdmin.js'
import { validateRobotsPolicyInput, validateTechnicalSeoSettings } from '../core/technicalSeo/index.js'
import { invalidateTechnicalSeoPolicyCache, technicalSeoSettingsInput } from '../payload/technicalSeo/settings.js'
import { invalidateTechnicalSeoCaches } from '../payload/technicalSeo/cache.js'
import { sanitizeRobotsRules } from '../helpers/robotsSafety.js'
import type { SeoConfig } from '../types.js'
import { buildTechnicalSeoAdminContract } from '../payload/technicalSeo/adminContract.js'
import { validateAnalyzerSettings } from '../core/analyzer/config.js'

export function createSettingsHandler(targetCollections: string[] = [], seoConfig?: SeoConfig): PayloadHandler {
  return async (req) => {
    try {
      if (!isSeoPanelUser(req)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // GET — return current settings (any authenticated user)
      if (req.method === 'GET') {
        const result = await req.payload.find({
          collection: 'seo-settings',
          limit: 1,
          overrideAccess: true,
        })
        const settings = result.docs[0] || {}
        return Response.json({ settings, effective: buildTechnicalSeoAdminContract(settings as Record<string, unknown>, targetCollections, seoConfig) })
      }

      // PATCH — update settings (admin only)
      if (req.method === 'PATCH') {
        if (!isAdmin(req)) {
          return Response.json({ error: 'Admin access required' }, { status: 403 })
        }
        const rawBody = await parseJsonBody(req)

        // Whitelist allowed fields — strip everything else
        const ALLOWED_FIELDS = ['siteName', 'ignoredSlugs', 'disabledRules', 'thresholds', 'sitemap', 'technicalSeo', 'robots', 'breadcrumb', 'robotsCustomRules']
        const body: Record<string, unknown> = {}
        for (const key of ALLOWED_FIELDS) {
          if (rawBody[key] !== undefined) {
            body[key] = rawBody[key]
          }
        }
        if (body.robotsCustomRules !== undefined) body.robotsCustomRules = sanitizeRobotsRules(body.robotsCustomRules)
        const errors = [
          ...validateTechnicalSeoSettings(technicalSeoSettingsInput(body), targetCollections),
          ...validateRobotsPolicyInput(body.robots),
          ...validateAnalyzerSettings({ disabledRules: body.disabledRules, thresholds: body.thresholds }),
        ]
        if (errors.length) return Response.json({ error: 'Invalid technical SEO settings', details: errors }, { status: 400 })

        // Find existing or create
        const result = await req.payload.find({
          collection: 'seo-settings',
          limit: 1,
          overrideAccess: true,
        })

        let settings
        if (result.docs.length > 0) {
          settings = await req.payload.update({
            collection: 'seo-settings',
            id: result.docs[0].id,
            data: body,
            overrideAccess: true,
          })
        } else {
          settings = await req.payload.create({
            collection: 'seo-settings',
            data: body,
            overrideAccess: true,
          })
        }

        invalidateTechnicalSeoCaches()
        invalidateTechnicalSeoPolicyCache(req.payload)

        return Response.json({
          settings,
          effective: buildTechnicalSeoAdminContract(settings as Record<string, unknown>, targetCollections, seoConfig),
          success: true,
        })
      }

      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] settings error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
