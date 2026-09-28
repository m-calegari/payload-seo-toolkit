import type { Config } from 'payload'
import type { SeoFeatures } from '../types.js'
import { createGenerateHandler, createValidateHandler } from '../modules/analyzer/index.js'
import { createCheckKeywordHandler } from '../endpoints/checkKeyword.js'
import { createAuditHandler } from '../endpoints/audit.js'
import { createIndexationAuditHandler, createSitemapAuditHandler } from '../modules/indexation/index.js'
import { createHistoryHandler } from '../endpoints/history.js'
import { createSettingsHandler } from '../endpoints/settings.js'
import { createSuggestLinksHandler } from '../endpoints/suggestLinks.js'
import { createRedirectHandler, createRedirectsHandler, createRedirectChainsHandler } from '../modules/redirects/index.js'
import { createAiGenerateHandler } from '../endpoints/aiGenerate.js'
import { createAiOptimizeHandler } from '../endpoints/aiOptimize.js'
import { createAiAltTextHandler, createAltTextAuditHandler } from '../endpoints/aiAltText.js'
import { createAiContentBriefHandler } from '../endpoints/aiContentBrief.js'
import { createAiOptimizeBulkHandler } from '../endpoints/aiOptimizeBulk.js'
import { createCannibalizationHandler } from '../endpoints/cannibalization.js'
import { createExternalLinksHandler } from '../endpoints/externalLinks.js'
import { createSitemapConfigHandler } from '../endpoints/sitemapConfig.js'
import { createPerformanceHandler } from '../endpoints/performance.js'
import { createCoreWebVitalsHandler } from '../integrations/pagespeed/index.js'
import {
  createGscStatusHandler,
  createGscAuthStartHandler,
  createGscCallbackHandler,
  createGscDataHandler,
  createGscDisconnectHandler,
} from '../integrations/gsc/index.js'
import { createKeywordResearchHandler } from '../endpoints/keywordResearch.js'
import { createBreadcrumbHandler } from '../endpoints/breadcrumb.js'
import { createLinkGraphHandler } from '../endpoints/linkGraph.js'
import { createSchemaGeneratorHandler } from '../modules/schema/index.js'
import { createDuplicateContentHandler } from '../endpoints/duplicateContent.js'
import { createAiRewriteHandler } from '../endpoints/aiRewrite.js'
import { createRobotsHandler, createRobotsUpdateHandler } from '../modules/robots/index.js'
import { createLlmsTxtHandler, createSitemapHandler, createNewsSitemapHandler, createImageSitemapHandler, createVideoSitemapHandler } from '../modules/sitemap/index.js'
import { createRankSnapshotHandler, createRankHistoryHandler } from '../endpoints/rankTracking.js'
import { createCtrOpportunitiesHandler } from '../endpoints/ctrOpportunities.js'
import { createContentGradeHandler } from '../endpoints/contentGrade.js'
import { createSeoHealthHandler } from '../endpoints/health.js'
import {
  createIndexNowKeyHandler,
  createIndexNowSubmitHandler,
  createIndexNowHook,
} from '../integrations/indexnow/index.js'
import { createSeoLogsHandler } from '../endpoints/seoLogs.js'
import { resolveRetention, type RetentionConfig } from '../retention.js'
import { createRetentionPurgeHandler, createRetentionStatusHandler } from '../endpoints/retention.js'
import { createAlertsDigestHandler, createAlertsRunHandler } from '../integrations/alerts/index.js'
import { resolveGscSiteUrl } from '../helpers/gscClient.js'
import { createRateLimiter, rateLimitKey } from '../rateLimiter.js'

import type { SeoPluginConfig } from './types.js'
import type { NormalizedPluginConfig } from './config.js'

export type EndpointSecurity = 'PUBLIC' | 'PANEL' | 'ADMIN' | 'BACKGROUND/INTERNAL'
export type EndpointModule = 'analyzer' | 'sitemap' | 'robots' | 'redirects' | 'schema' | 'indexation' | 'ai' | 'gsc' | 'pagespeed' | 'indexnow' | 'operations'

/** Registration metadata makes endpoint ownership and trust intent reviewable. */
export interface EndpointClassification {
  module: EndpointModule
  security: EndpointSecurity
}

export const ENDPOINT_SECURITY: Readonly<Record<string, EndpointClassification>> = {
  validate: { module: 'analyzer', security: 'PANEL' },
  generate: { module: 'analyzer', security: 'PANEL' },
  'ai-rewrite': { module: 'ai', security: 'PANEL' },
  'ai-optimize': { module: 'ai', security: 'PANEL' },
  'ai-optimize-bulk': { module: 'ai', security: 'ADMIN' },
  'ai-alt-text': { module: 'ai', security: 'ADMIN' },
  'sitemap.xml': { module: 'sitemap', security: 'PUBLIC' },
  'sitemap-news.xml': { module: 'sitemap', security: 'PUBLIC' },
  'sitemap-images.xml': { module: 'sitemap', security: 'PUBLIC' },
  'sitemap-video.xml': { module: 'sitemap', security: 'PUBLIC' },
  'llms.txt': { module: 'sitemap', security: 'PUBLIC' },
  'robots.txt:get': { module: 'robots', security: 'PUBLIC' },
  'robots.txt:post': { module: 'robots', security: 'ADMIN' },
  retention: { module: 'operations', security: 'ADMIN' },
  'indexnow-key.txt': { module: 'indexnow', security: 'PUBLIC' },
} as const

/** Build and append the endpoint catalog without changing paths or handlers. */
export function registerEndpoints(
  config: Config,
  pluginConfig: SeoPluginConfig,
  normalized: NormalizedPluginConfig,
): void {
  const { targetCollections, uploadsCollection, targetGlobals, basePath, seoConfig, features, redirectsSlug, allowExternalRedirects } = normalized
  // Rate limiter for expensive POST endpoints (LLM calls, heavy crawls): 10 req / 60s per IP.
  const expensiveEndpointLimiter = createRateLimiter(10, 60_000)
  // Separate, poll-friendly limiter for the background-built audits. These GET endpoints are
  // POLLED by the dashboard every 3s while the (single-flight) build runs — a build on a large
  // site can take minutes. The actual expensive work is the background build, which single-flight
  // already bounds to one at a time; the polled requests just read the cache / return a 202. A
  // 10/min cap (the expensive limiter) throttled the polls themselves and surfaced as HTTP 429
  // mid-build. This higher cap fits sustained polling (≈20 req/min/tab) while still guarding abuse.
  const auditPollLimiter = createRateLimiter(120, 60_000)
  // Per-document LLM endpoints (/ai-rewrite, /ai-optimize) were registered with NO limiter at
  // all: a panel user could bill the site owner an unbounded number of Claude calls in a loop.
  // They are driven one document at a time by a human click (SEO sidebar, CTR panel), so the
  // 10/min expensive cap would surface as a 429 in the middle of a legitimate pass over a list.
  // 30/min per user still bounds the spend hard while staying well above human clicking.
  const aiInteractiveLimiter = createRateLimiter(30, 60_000)
  
  /** Wrap a handler with rate limiting. Returns 429 if limit exceeded. */
  function withRateLimit(
    handler: ReturnType<typeof createAuditHandler>,
    limiter: ReturnType<typeof createRateLimiter> = expensiveEndpointLimiter,
  ): typeof handler {
    return async (req) => {
      // Prefer the authenticated user id (not spoofable) over the client IP —
      // X-Forwarded-For is client-controlled, so an IP-only key is trivially
      // bypassed by varying the header. Shared with the other limited paths, so
      // the rule cannot drift between them — see rateLimiter.ts::rateLimitKey.
      if (!limiter.check(rateLimitKey(req))) {
        return Response.json(
          { error: 'Too Many Requests. Please try again later.' },
          { status: 429 },
        )
      }
      return handler(req)
    }
  }
  
  // 2. Add SEO API endpoints (conditionally based on features)
  type EndpointDef = { path: string; method: 'get' | 'post' | 'patch' | 'delete'; handler: ReturnType<typeof createValidateHandler> }
  const pluginEndpoints: EndpointDef[] = [
    // Core — always active (analyzer sidebar needs these)
    {
      path: `${basePath}/validate`,
      method: 'post',
      handler: createValidateHandler(targetCollections, targetGlobals, seoConfig),
    },
    {
      path: `${basePath}/validate`,
      method: 'get',
      handler: createValidateHandler(targetCollections, targetGlobals, seoConfig),
    },
    {
      path: `${basePath}/check-keyword`,
      method: 'get',
      handler: createCheckKeywordHandler(targetCollections, targetGlobals),
    },
    // Generate meta values via custom functions — always active (used by meta field UI)
    {
      path: `${basePath}/generate`,
      method: 'post',
      handler: createGenerateHandler(
        {
          generateTitle: pluginConfig.generateTitle,
          generateDescription: pluginConfig.generateDescription,
          generateImage: pluginConfig.generateImage,
          generateURL: pluginConfig.generateURL,
        },
        targetCollections,
        targetGlobals,
      ),
    },
  ]
  
  // Dashboard: audit endpoint
  if (features.dashboard) {
    pluginEndpoints.push({
      path: `${basePath}/audit`,
      method: 'get',
      // Poll-friendly limiter: the dashboard polls this every 3s while the background build runs.
      handler: withRateLimit(createAuditHandler(targetCollections, seoConfig, targetGlobals, pluginConfig.auditCacheFile), auditPollLimiter),
    })
    // Indexation hygiene audit — cross-page noindex / canonical problems in one place
    pluginEndpoints.push({
      path: `${basePath}/indexation-audit`,
      method: 'get',
      handler: withRateLimit(createIndexationAuditHandler(targetCollections, seoConfig, targetGlobals)),
    })
  }
  
  // Score history
  if (features.scoreHistory) {
    pluginEndpoints.push({
      path: `${basePath}/history`,
      method: 'get',
      handler: createHistoryHandler(),
    })
  }
  
  // Sitemap audit
  if (features.sitemapAudit) {
    pluginEndpoints.push(
      {
        path: `${basePath}/sitemap-audit`,
        method: 'get',
        handler: withRateLimit(createSitemapAuditHandler(targetCollections, redirectsSlug, pluginConfig.knownRoutes || [])),
      },
      {
        path: `${basePath}/sitemap-config`,
        method: 'get',
        handler: createSitemapConfigHandler(targetCollections, seoConfig),
      },
    )
  }
  
  // Settings
  if (features.settings) {
    pluginEndpoints.push(
      { path: `${basePath}/settings`, method: 'get', handler: createSettingsHandler() },
      { path: `${basePath}/settings`, method: 'patch', handler: createSettingsHandler() },
    )
  }
  
  // Internal linking (suggest-links + breadcrumb — part of analyzer core helpers)
  pluginEndpoints.push(
    {
      path: `${basePath}/suggest-links`,
      method: 'post',
      // Rate limited, but with the POLL-friendly limiter: the editor debounces
      // this call to one every 2 s while typing, so the 10/min expensive
      // limiter would 429 a legitimate writer (the mistake already made once on
      // the audit endpoint). 120/min fits sustained editing and still caps abuse.
      handler: withRateLimit(createSuggestLinksHandler(targetCollections, targetGlobals), auditPollLimiter),
    },
    {
      path: `${basePath}/breadcrumb`,
      method: 'get',
      handler: createBreadcrumbHandler(targetCollections),
    },
  )
  
  // Redirects (CRUD + chain detection + auto-create)
  if (features.redirects) {
    const rSlug = pluginConfig.redirectsCollection ?? 'seo-redirects'
    pluginEndpoints.push(
      { path: `${basePath}/create-redirect`, method: 'post', handler: createRedirectHandler(rSlug, allowExternalRedirects) },
      { path: `${basePath}/redirects`, method: 'get', handler: createRedirectsHandler(rSlug, allowExternalRedirects) },
      { path: `${basePath}/redirects`, method: 'post', handler: createRedirectsHandler(rSlug, allowExternalRedirects) },
      { path: `${basePath}/redirects`, method: 'patch', handler: createRedirectsHandler(rSlug, allowExternalRedirects) },
      { path: `${basePath}/redirects`, method: 'delete', handler: createRedirectsHandler(rSlug, allowExternalRedirects) },
      { path: `${basePath}/redirect-chains`, method: 'get', handler: withRateLimit(createRedirectChainsHandler(rSlug)) },
    )
  }
  
  // AI features (generate + rewrite + optimize)
  if (features.aiFeatures) {
    pluginEndpoints.push(
      { path: `${basePath}/ai-generate`, method: 'post', handler: createAiGenerateHandler() },
      { path: `${basePath}/ai-rewrite`, method: 'post', handler: withRateLimit(createAiRewriteHandler(targetCollections), aiInteractiveLimiter) },
      { path: `${basePath}/ai-optimize`, method: 'post', handler: withRateLimit(createAiOptimizeHandler(targetCollections, seoConfig), aiInteractiveLimiter) },
      { path: `${basePath}/alt-text-audit`, method: 'get', handler: createAltTextAuditHandler(uploadsCollection) },
      { path: `${basePath}/ai-alt-text`, method: 'post', handler: withRateLimit(createAiAltTextHandler(uploadsCollection, seoConfig)) },
      { path: `${basePath}/ai-content-brief`, method: 'post', handler: withRateLimit(createAiContentBriefHandler(targetCollections, seoConfig)) },
      { path: `${basePath}/ai-optimize-bulk`, method: 'post', handler: withRateLimit(createAiOptimizeBulkHandler(targetCollections, seoConfig)) },
    )
  }
  
  // Cannibalization detection
  if (features.cannibalization) {
    pluginEndpoints.push({
      path: `${basePath}/cannibalization`,
      method: 'get',
      handler: withRateLimit(createCannibalizationHandler(targetCollections, targetGlobals)),
    })
  }
  
  // External links checker
  if (features.externalLinks) {
    pluginEndpoints.push({
      path: `${basePath}/external-links`,
      method: 'post',
      handler: withRateLimit(createExternalLinksHandler(targetCollections, targetGlobals)),
    })
  }
  
  // Performance (GSC import)
  if (features.performance) {
    pluginEndpoints.push(
      { path: `${basePath}/performance`, method: 'get', handler: withRateLimit(createPerformanceHandler()) },
      { path: `${basePath}/performance`, method: 'post', handler: withRateLimit(createPerformanceHandler()) },
      // Core Web Vitals via PageSpeed Insights — informational, on-demand, SSRF-safe
      { path: `${basePath}/core-web-vitals`, method: 'get', handler: withRateLimit(createCoreWebVitalsHandler(seoConfig)) },
    )
  }
  
  // Google Search Console (OAuth2) — opt-in (requires Google Cloud setup + secrets)
  if (features.gscApi) {
    pluginEndpoints.push(
      { path: `${basePath}/gsc/status`, method: 'get', handler: createGscStatusHandler(basePath, seoConfig) },
      { path: `${basePath}/gsc/auth`, method: 'get', handler: createGscAuthStartHandler(basePath, seoConfig) },
      { path: `${basePath}/gsc/callback`, method: 'get', handler: createGscCallbackHandler(basePath, seoConfig) },
      { path: `${basePath}/gsc/data`, method: 'get', handler: withRateLimit(createGscDataHandler(basePath, seoConfig)) },
      { path: `${basePath}/gsc/disconnect`, method: 'post', handler: createGscDisconnectHandler() },
      { path: `${basePath}/rank-snapshot`, method: 'post', handler: withRateLimit(createRankSnapshotHandler(basePath, seoConfig)) },
      { path: `${basePath}/rank-history`, method: 'get', handler: createRankHistoryHandler() },
      { path: `${basePath}/ctr-opportunities`, method: 'get', handler: createCtrOpportunitiesHandler(basePath, targetCollections, seoConfig) },
      // Content grade (Surfer/Clearscope-lite via GSC) — A–F grade of ONE doc vs its real queries
      { path: `${basePath}/content-grade`, method: 'get', handler: withRateLimit(createContentGradeHandler(basePath, targetCollections, seoConfig)) },
    )
  }
  
  // Monitoring & alerts (opt-in)
  if (features.alerts) {
    pluginEndpoints.push(
      { path: `${basePath}/alerts-digest`, method: 'get', handler: createAlertsDigestHandler() },
      { path: `${basePath}/alerts-run`, method: 'post', handler: withRateLimit(createAlertsRunHandler(resolveGscSiteUrl(seoConfig))) },
    )
  }
  
  // Retention purge (opt-in) — only exists when a window is actually configured,
  // so a host that never asked for it has no delete route at all.
  const retentionTargets = resolveRetention(pluginConfig.retentionDays)
  if (retentionTargets.length > 0) {
    pluginEndpoints.push(
      { path: `${basePath}/retention`, method: 'get', handler: createRetentionStatusHandler(pluginConfig.retentionDays!) },
      { path: `${basePath}/retention`, method: 'post', handler: withRateLimit(createRetentionPurgeHandler(pluginConfig.retentionDays!)) },
    )
  }
  
  // IndexNow — proactive indexing (opt-in). Key file is PUBLIC (search engines verify it).
  if (features.indexNow) {
    pluginEndpoints.push(
      { path: `${basePath}/indexnow-key.txt`, method: 'get', handler: createIndexNowKeyHandler() },
      { path: `${basePath}/indexnow-submit`, method: 'post', handler: withRateLimit(createIndexNowSubmitHandler(basePath, targetCollections, seoConfig)) },
    )
  }
  
  // Keyword research
  if (features.keywords) {
    pluginEndpoints.push({
      path: `${basePath}/keyword-research`,
      method: 'get',
      handler: withRateLimit(createKeywordResearchHandler(targetCollections, targetGlobals)),
    })
  }
  
  // Link graph
  if (features.linkGraph) {
    pluginEndpoints.push({
      path: `${basePath}/link-graph`,
      method: 'get',
      handler: withRateLimit(createLinkGraphHandler(targetCollections, targetGlobals)),
    })
  }
  
  // SEO Logs (404 tracking)
  if (features.seoLogs) {
    pluginEndpoints.push(
      { path: `${basePath}/seo-logs`, method: 'get', handler: createSeoLogsHandler(pluginConfig.seoLogsSecret) },
      { path: `${basePath}/seo-logs`, method: 'post', handler: createSeoLogsHandler(pluginConfig.seoLogsSecret) },
      { path: `${basePath}/seo-logs`, method: 'delete', handler: createSeoLogsHandler(pluginConfig.seoLogsSecret) },
    )
  }
  
  // Schema.org JSON-LD generator
  if (features.schemaBuilder) {
    pluginEndpoints.push({
      path: `${basePath}/schema-generator`,
      method: 'get',
      handler: createSchemaGeneratorHandler(targetCollections),
    })
  }
  
  // Duplicate content detection
  if (features.duplicateContent) {
    pluginEndpoints.push({
      path: `${basePath}/duplicate-content`,
      method: 'get',
      handler: withRateLimit(createDuplicateContentHandler(targetCollections)),
    })
  }
  
  // Module health / observability — always active (admin-only inside)
  pluginEndpoints.push({
    path: `${basePath}/health`,
    method: 'get' as const,
    handler: createSeoHealthHandler(basePath, seoConfig),
  })
  
  // robots.txt and sitemap.xml — always active (public endpoints)
  pluginEndpoints.push(
    {
      path: `${basePath}/robots.txt`,
      method: 'get' as const,
      handler: createRobotsHandler(targetCollections),
    },
    {
      path: `${basePath}/robots.txt`,
      method: 'post' as const,
      handler: createRobotsUpdateHandler(),
    },
    {
      path: `${basePath}/sitemap.xml`,
      method: 'get' as const,
      handler: createSitemapHandler(targetCollections, seoConfig),
    },
    {
      // AI discoverability (opt-in via SEO_LLMS_TXT=1; returns 404 when disabled). Not scored.
      path: `${basePath}/llms.txt`,
      method: 'get' as const,
      handler: createLlmsTxtHandler(targetCollections, seoConfig),
    },
    {
      path: `${basePath}/sitemap-news.xml`,
      method: 'get' as const,
      handler: createNewsSitemapHandler(targetCollections, seoConfig),
    },
    {
      path: `${basePath}/sitemap-images.xml`,
      method: 'get' as const,
      handler: createImageSitemapHandler(targetCollections, seoConfig),
    },
    {
      path: `${basePath}/sitemap-video.xml`,
      method: 'get' as const,
      handler: createVideoSitemapHandler(targetCollections, seoConfig),
    },
  )
  
  config.endpoints = [
    ...(config.endpoints || []),
    ...pluginEndpoints,
  ]
  
}
