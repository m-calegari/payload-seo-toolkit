import type { Field } from 'payload'
import type { SeoFeatures, RuleGroup, SeoThresholds } from '../types.js'
import type { CollectionRoutes } from '../helpers/docUrl.js'
import type { RetentionConfig } from '../retention.js'
import type { CapabilityToggles, SeoBackgroundServiceId, SeoIntegrationId, SeoModuleId } from './capabilities.js'

/** Arguments passed to generate functions (generateTitle, generateDescription, etc.) */
export interface GenerateFnArgs {
  doc: Record<string, unknown>
  locale?: string
  req: unknown
  collectionSlug?: string
  globalSlug?: string
}

export interface SeoPluginConfig {
  /** Collections to add SEO fields to (default: ['pages', 'posts']) */
  collections?: string[]
  /** Globals to add SEO fields to (default: []) */
  globals?: string[]
  /** Whether to add the SEO dashboard view at /admin/seo (default: true) */
  addDashboardView?: boolean
  /** Rule groups to disable entirely */
  disabledRules?: RuleGroup[]
  /** Override the weight of all checks within a rule group */
  overrideWeights?: Partial<Record<RuleGroup, number>>
  /** Custom thresholds (override defaults from constants) */
  thresholds?: SeoThresholds
  /** Additional local SEO slugs for the project */
  localSeoSlugs?: string[]
  /** Site name (used for brand duplicate check in titles) */
  siteName?: string
  /** Base URL of the site (used for canonical URL validation, e.g. 'https://example.com') */
  siteUrl?: string
  /** Base path for API endpoints (default: '/seo-plugin') */
  endpointBasePath?: string
  /** Legacy alias for the scoreHistory module. Omitted by default in core-only mode. */
  trackScoreHistory?: boolean
  /** Whether to add the sitemap audit view at /admin/sitemap-audit (default: true) */
  addSitemapAuditView?: boolean
  /** Collection slug for redirects (default: 'seo-redirects'). The plugin auto-creates this collection. */
  redirectsCollection?: string
  /**
   * Allow redirect destinations pointing to another origin (absolute http(s) URLs).
   * Default: `false` — an off-site 301 served from your own paths is a site-hijack
   * primitive (phishing with your domain's authority, OAuth redirect_uri abuse), and
   * nothing in the plugin used to forbid it. Turn it on only if you genuinely need
   * cross-origin redirects.
   */
  allowExternalRedirects?: boolean
  /** Known dynamic routes that are not stored as document slugs (e.g. ['blog', 'réalisations', 'posts']). These won't be flagged as broken links or orphan pages. */
  knownRoutes?: string[]
  /**
   * Public route prefix per collection, used by every URL the plugin generates
   * (sitemap.xml, canonical, JSON-LD, llms.txt, IndexNow).
   * Default: `{ posts: 'posts' }` — the convention llms.txt already shipped.
   * Set `{ posts: '' }` if your posts are served flat at `/<slug>`, or add your
   * own entries (e.g. `{ projects: 'work' }`).
   */
  collectionRoutes?: CollectionRoutes
  /**
   * Secret header value for the seo-logs POST endpoint. If set, POST requests must carry the
   * `X-SEO-Secret` header with this value — which is what lets a host's 404 middleware log hits
   * from ANONYMOUS visitors. If not set, POST requires an SEO-admin session (the same gate as the
   * collection's own `create` ACL), so a panel editor cannot write rows the collection refuses them.
   */
  seoLogsSecret?: string
  /** Locale for language-specific analysis (default: 'fr') */
  locale?: 'fr' | 'en'
  /** Collection slug for uploads/media (used for meta.image relationTo). Default: 'media' */
  uploadsCollection?: string
  /** Auto-create meta fields (title, description, image) on target collections. Default: true */
  autoCreateMetaFields?: boolean
  /**
   * Path to a build-time audit cache file (JSON, produced by `buildAuditToFile()`).
   * When set, the heavy site-wide dashboard audit is hydrated from this file on a cache
   * miss instead of being recomputed live — offloading the cost to CI on memory-constrained
   * hosts (e.g. Infomaniak). Stale-guarded: ignored once content changes (a live rebuild
   * takes over). Runtime kill-switch: set env `SEO_AUDIT_FILE_CACHE=0` to ignore the file.
   */
  auditCacheFile?: string
  /** @deprecated Use modules, integrations, and backgroundServices. Supplying this
   * object preserves historical feature defaults before new toggles override them. */
  features?: SeoFeatures
  /** Optional local capabilities. Omitted capabilities have zero registration/runtime cost. */
  modules?: CapabilityToggles<SeoModuleId>
  /** Optional external providers. Credentials remain server-only. */
  integrations?: CapabilityToggles<SeoIntegrationId>
  /** Explicit in-process jobs. These are not distributed schedulers. */
  backgroundServices?: CapabilityToggles<SeoBackgroundServiceId>
  /** Custom function to generate meta title */
  generateTitle?: (args: GenerateFnArgs) => string | Promise<string>
  /** Custom function to generate meta description */
  generateDescription?: (args: GenerateFnArgs) => string | Promise<string>
  /** Custom function to generate meta image (returns media ID or URL) */
  generateImage?: (args: GenerateFnArgs) => string | number | Promise<string | number>
  /** Custom function to generate page URL */
  generateURL?: (args: GenerateFnArgs) => string | Promise<string>
  /** Mapping from Payload locale codes to analysis locale ('fr' | 'en') */
  localeMapping?: Record<string, 'fr' | 'en'>
  /** Custom dashboard translations for additional locales (e.g. 'cs', 'de', 'es').
   *  Partial overrides are supported — missing keys fall back to English.
   *  @example
   *  ```ts
   *  customTranslations: {
   *    cs: {
   *      common: { loading: 'Načítání...', save: 'Uložit' },
   *      nav: { dashboard: 'Přehled', seo: 'SEO' },
   *    }
   *  }
   *  ```
   */
  customTranslations?: Record<string, Partial<import('../dashboard-i18n.js').DashboardTranslations>>
  /** Override or reorganize the default meta fields inside the 'meta' group.
   *  Receives the default fields (overview, title, description, image, preview) and must return a Field[].
   *  Use this to add custom fields, remove defaults, or reorder them. */
  fields?: (args: { defaultFields: Field[] }) => Field[]
  /** If true, wraps collection/global fields in a tabbed UI with "Content" and "SEO" tabs.
   *  Compatible with collections that already use a tabs field as their first field. */
  tabbedUI?: boolean
  /** Custom TypeScript interface name for the generated meta group type (e.g. 'SharedSEO') */
  interfaceName?: string
  /**
   * Days of history to keep, per time-series collection. OPT-IN: with this
   * option absent nothing is ever deleted, which is what every install does
   * today.
   *
   * `seo-rank-history`, `seo-score-history`, `seo-performance` and `seo-logs`
   * are append-only and grow without bound. Naming one here schedules a daily
   * purge of the rows older than the window, and registers
   * `GET/POST <basePath>/retention` for SEO admins (dry run / run now).
   *
   * A value that is not a finite number of at least 1 is ignored rather than
   * clamped — `0` would mean "delete everything".
   *
   * @example
   * ```ts
   * retentionDays: { 'seo-rank-history': 365, 'seo-logs': 90 }
   * ```
   */
  retentionDays?: RetentionConfig
}
