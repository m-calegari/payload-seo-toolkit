/**
 * SEO Analyzer — Main orchestrator.
 * Imports all rule modules, builds the analysis context, runs every check,
 * and computes the final score.
 *
 * Public API:
 *   analyzeSeo(data: SeoInput, config?: SeoConfig): SeoAnalysis
 *
 * All types and useful helpers are re-exported for convenience.
 */

// Re-export types
export type {
  CheckStatus,
  CheckCategory,
  RuleGroup,
  SeoCheck,
  SeoLevel,
  SeoAnalysis,
  SeoInput,
  AnalysisContext,
  PageType,
  SeoConfig,
  SeoThresholds,
  SeoFeatures,
} from './types'

// Re-export helpers for external consumers
export {
  extractTextFromLexical,
  extractHeadingsFromLexical,
  extractLinksFromLexical,
  extractImagesFromLexical,
  extractLinkUrlsFromLexical,
  extractListsFromLexical,
  checkImagesInBlocks,
  normalizeForComparison,
  slugifyKeyword,
  keywordMatchesText,
  countKeywordOccurrences,
  countWords,
  countSentences,
  countSyllablesFR,
  calculateFleschFR,
  calculateFlesch,
  countSyllablesEN,
  detectPassiveVoice,
  hasTransitionWord,
  checkHeadingHierarchy,
  countLongSections,
  detectPageType,
  getStopWordsFR,
  getActionVerbsFR,
  isStopWordInCompoundExpression,
} from './helpers'

// Re-export plugin
export { seoAnalyzerPlugin, seoPlugin } from './plugin.js'
export type { SeoPluginConfig, GenerateFnArgs } from './plugin.js'

// Re-export field definitions
export { seoFields } from './fields.js'
export { metaFields } from './metaFields.js'
export type { MetaFieldsConfig } from './metaFields.js'

// Re-export helpers
export { resolveAnalysisLocale } from './helpers/resolveLocale.js'
export type { ResolveLocaleArgs } from './helpers/resolveLocale.js'
export { fetchAllDocs } from './helpers/fetchAllDocs.js'
export type { FetchedDoc, FetchAllDocsOptions, DocSourceType } from './helpers/fetchAllDocs.js'

// Re-export endpoint utilities
export { buildSeoInputFromDoc } from './endpoints/validate.js'

// Frontend SEO render helpers (SEO 2026) — produce the actual <head> metadata + JSON-LD,
// not just analyze it. Pure functions, safe to call in Next.js generateMetadata / Server Components.
export { buildSeoMetadata } from './helpers/buildMetadata.js'
// Public URL construction — exported so a host can build the same URLs the
// sitemap, the canonical and the JSON-LD use.
export { buildDocPath, buildDocUrl, DEFAULT_COLLECTION_ROUTES, getCollectionRoute } from './helpers/docUrl.js'
export type { CollectionRoutes } from './helpers/docUrl.js'
export {
  createSiteModel,
  matchDocumentIdentityFromPath,
  normalizeSiteOrigin,
  resolveCanonicalUrl,
  resolveDocumentPath,
  resolveDocumentUrl,
} from './core/urls/index.js'
export type {
  CanonicalUrlInput,
  CreateSiteModelOptions,
  DocumentUrlIdentity,
  SiteCollectionModel,
  SiteLocaleModel,
  SiteModel,
} from './core/urls/index.js'
export type { SeoMetadata, SeoMetadataOptions } from './helpers/buildMetadata.js'
export {
  buildJsonLd,
  renderJsonLdScript,
  serializeJsonLd,
  detectSchemaType,
  getSchemaImageUrl,
  SCHEMA_TYPES,
} from './helpers/buildSchema.js'
export type { SchemaType, BuildJsonLdOptions } from './helpers/buildSchema.js'
export { createHistoryHandler } from './endpoints/history.js'
export { createSitemapAuditHandler } from './endpoints/sitemap-audit.js'
// Build-time audit cache: generate the site-wide audit JSON at CI time, hydrate it in prod.
export { buildAuditToFile } from './endpoints/audit.js'

// Re-export collection + hook for advanced consumers
export { createSeoScoreHistoryCollection } from './collections/SeoScoreHistory.js'
export { createSeoPerformanceCollection } from './collections/SeoPerformance.js'
export { createTrackSeoScoreHook } from './hooks/trackSeoScore.js'

// Re-export new endpoint creators
export { createPerformanceHandler } from './endpoints/performance.js'
export { createKeywordResearchHandler } from './endpoints/keywordResearch.js'
export { createGenerateHandler } from './endpoints/generate.js'
export { createSchemaGeneratorHandler } from './endpoints/schemaGenerator.js'
export { createRedirectChainsHandler } from './endpoints/redirectChains.js'
export { createDuplicateContentHandler } from './endpoints/duplicateContent.js'
export { createAiRewriteHandler } from './endpoints/aiRewrite.js'

// Retention — the purge helpers, for a host that would rather run the trim from
// its own cron than let the plugin schedule it.
export { purgeRetention, describeRetention, resolveRetention, RETENTION_TARGETS } from './retention.js'
export type { RetentionConfig, RetentionCollection, PurgeResult } from './retention.js'

// Re-export dashboard i18n for custom locale registration
export { registerDashboardTranslations, getDashboardT } from './dashboard-i18n.js'
export type { DashboardTranslations, DashboardLocale } from './dashboard-i18n.js'

// Re-export constants for consumers that need thresholds
export {
  TITLE_LENGTH_MIN,
  TITLE_LENGTH_MAX,
  META_DESC_LENGTH_MIN,
  META_DESC_LENGTH_MAX,
  MIN_WORDS_POST,
  MIN_WORDS_FORM,
  MIN_WORDS_LEGAL,
  MIN_WORDS_GENERIC,
  MIN_WORDS_THIN,
  KEYWORD_DENSITY_MAX,
  KEYWORD_DENSITY_WARN,
  KEYWORD_DENSITY_MIN,
  SCORE_EXCELLENT,
  SCORE_GOOD,
  SCORE_OK,
  WARNING_MULTIPLIER,
  MAX_RECURSION_DEPTH,
  POWER_WORDS_FR,
  POWER_WORDS,
  STOP_WORDS,
  ACTION_VERBS,
  GENERIC_ANCHORS,
  LEGAL_SLUGS_MAP,
  UTILITY_SLUGS,
  EVERGREEN_SLUGS,
  STOP_WORD_COMPOUNDS_MAP,
  FLESCH_THRESHOLDS,
  READABILITY_THRESHOLDS,
  getStopWords,
  getActionVerbs,
  getPowerWords,
  getGenericAnchors,
  getLegalSlugs,
  getUtilitySlugs,
  getEvergreenSlugs,
  getStopWordCompounds,
} from './constants'

export { analyzeSeo } from './core/analyzer/analyzeSeo.js'
