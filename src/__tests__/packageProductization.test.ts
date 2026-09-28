import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import * as root from '../index.js'
import type {
  SeoBackgroundServiceId,
  SeoIntegrationId,
  SeoModuleId,
  SeoPluginConfig,
} from '../index.js'
import { seoPlugin, validateTechnicalSeoSettings } from '../index.js'

const ROOT_EXPORTS = [
  'ACTION_VERBS', 'DEFAULT_COLLECTION_ROUTES', 'EVERGREEN_SLUGS', 'FLESCH_THRESHOLDS',
  'GENERIC_ANCHORS', 'KEYWORD_DENSITY_MAX', 'KEYWORD_DENSITY_MIN', 'KEYWORD_DENSITY_WARN',
  'LEGAL_SLUGS_MAP', 'MAX_RECURSION_DEPTH', 'META_DESC_LENGTH_MAX', 'META_DESC_LENGTH_MIN',
  'MIN_WORDS_FORM', 'MIN_WORDS_GENERIC', 'MIN_WORDS_LEGAL', 'MIN_WORDS_POST', 'MIN_WORDS_THIN',
  'POWER_WORDS', 'POWER_WORDS_FR', 'READABILITY_THRESHOLDS', 'RETENTION_TARGETS', 'SCHEMA_TYPES',
  'SCORE_EXCELLENT', 'SCORE_GOOD', 'SCORE_OK', 'SEO_HEALTH_CATEGORIES',
  'SITEMAP_CHANGE_FREQUENCIES', 'STOP_WORDS', 'STOP_WORD_COMPOUNDS_MAP', 'TECHNICAL_SCHEMA_TYPES',
  'TITLE_LENGTH_MAX', 'TITLE_LENGTH_MIN', 'UTILITY_SLUGS', 'WARNING_MULTIPLIER', 'analyzeSeo',
  'analyzeSeoHealth', 'buildAuditToFile', 'buildDocPath', 'buildDocUrl', 'buildJsonLd',
  'buildRobotsTxt', 'buildSeoInputFromDoc', 'buildSeoMetadata', 'calculateFlesch',
  'calculateFleschFR', 'checkHeadingHierarchy', 'checkImagesInBlocks', 'countKeywordOccurrences',
  'countLongSections', 'countSentences', 'countSyllablesEN', 'countSyllablesFR', 'countWords',
  'createAiRewriteHandler', 'createDuplicateContentHandler', 'createGenerateHandler',
  'createHistoryHandler', 'createKeywordResearchHandler', 'createPerformanceHandler',
  'createRedirectChainsHandler', 'createSchemaGeneratorHandler', 'createSeoPerformanceCollection',
  'createSeoScoreHistoryCollection', 'createSiteModel', 'createSitemapAuditHandler',
  'createTrackSeoScoreHook', 'describeRetention', 'detectPageType', 'detectPassiveVoice',
  'detectSchemaType', 'extractHeadingsFromLexical', 'extractImagesFromLexical',
  'extractLinkUrlsFromLexical', 'extractLinksFromLexical', 'extractListsFromLexical',
  'extractTextFromLexical', 'fetchAllDocs', 'getActionVerbs', 'getActionVerbsFR',
  'getCollectionRoute', 'getDashboardT', 'getEvergreenSlugs', 'getGenericAnchors', 'getLegalSlugs',
  'getPowerWords', 'getSchemaImageUrl', 'getStopWordCompounds', 'getStopWords', 'getStopWordsFR',
  'getUtilitySlugs', 'hasTransitionWord', 'isStopWordInCompoundExpression', 'keywordMatchesText',
  'matchDocumentIdentityFromPath', 'metaFields', 'normalizeForComparison', 'normalizeRobotsPolicy',
  'normalizeSiteOrigin', 'normalizeTechnicalSeoPolicy', 'purgeRetention',
  'registerDashboardTranslations', 'renderJsonLdScript', 'resolveAnalysisLocale',
  'resolveCanonicalUrl', 'resolveDocumentPath', 'resolveDocumentUrl', 'resolveRetention',
  'resolveSiteIdentity', 'resolveTechnicalSeo', 'seoAnalyzerPlugin', 'seoFields', 'seoPlugin',
  'serializeJsonLd', 'slugifyKeyword', 'validateAnalyzerSettings', 'validateTechnicalSeoSettings',
] as const

const CLIENT_EXPORTS = [
  'CannibalizationView', 'ContentDecaySection', 'KeywordResearchView', 'LegacySeoConfigView',
  'LinkGraphView', 'LocalizedSeoErrorBoundary', 'MetaDescriptionField', 'MetaImageField',
  'MetaTitleField', 'OverviewField', 'PerformanceView', 'RedirectManagerView', 'SchemaBuilderView',
  'ScoreHistoryChart', 'SeoAnalyzerField', 'SeoConfigView', 'SeoErrorBoundary', 'SeoHealthPanel',
  'SeoNavLink', 'SeoSocialPreview', 'SeoView', 'SerpPreview', 'SerpPreviewField', 'SitemapAuditView',
  'withSeoErrorBoundary',
] as const

const VIEW_EXPORTS = [
  'CannibalizationView', 'KeywordResearchView', 'LegacySeoConfigView', 'LinkGraphView',
  'PerformanceView', 'RedirectManagerView', 'SchemaBuilderView', 'SeoConfigView', 'SeoView',
  'SitemapAuditView',
] as const

function runtimeExportsFromEntry(path: string): string[] {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const names: string[] = []
  for (const match of source.matchAll(/export\s+(?!type\b)\{([\s\S]*?)\}\s+from/g)) {
    for (const raw of match[1].split(',')) {
      const specifier = raw.replace(/\/\/.*$/gm, '').trim()
      if (!specifier) continue
      names.push((specifier.split(/\s+as\s+/)[1] ?? specifier).trim())
    }
  }
  return names.sort()
}

describe('published package contract', () => {
  it('keeps intentional root, client, and views runtime exports stable', () => {
    expect(Object.keys(root).sort()).toEqual([...ROOT_EXPORTS].sort())
    expect(runtimeExportsFromEntry('../client.ts')).toEqual([...CLIENT_EXPORTS].sort())
    expect(runtimeExportsFromEntry('../views.ts')).toEqual([...VIEW_EXPORTS].sort())
  })

  it('exports discoverable capability and plugin configuration types', () => {
    const moduleId: SeoModuleId = 'redirects'
    const integrationId: SeoIntegrationId = 'ai'
    const serviceId: SeoBackgroundServiceId = 'warmCache'
    const config: SeoPluginConfig = {
      collections: ['pages', 'posts'],
      modules: { [moduleId]: true },
      integrations: { [integrationId]: true },
      backgroundServices: { [serviceId]: true },
    }
    expect(config).toBeTruthy()
  })

  it('publishes only built entries and consumer documentation', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
    expect(pkg.files).toEqual([
      'dist', 'docs/background-services.md', 'docs/configuration.md', 'docs/development.md',
      'docs/integrations.md', 'docs/migration.md', 'docs/modules.md', 'docs/public-api.md',
      'docs/routing.md', 'docs/security.md', 'README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'LICENSE',
    ])
    expect(pkg.bin).toBeUndefined()
    for (const lifecycle of ['preinstall', 'install', 'postinstall', 'prepare']) {
      expect(pkg.scripts?.[lifecycle]).toBeUndefined()
    }
    expect(pkg.repository).toBeUndefined()
    expect(pkg.homepage).toBeUndefined()
    expect(pkg.bugs).toBeUndefined()
  })

  it('keeps critical documentation examples aligned with capability IDs', () => {
    const docs = ['README.md', 'docs/modules.md', 'docs/integrations.md', 'docs/migration.md']
      .map((path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')).join('\n')
    for (const id of ['redirects', 'advancedSchema', 'linkGraph', 'ai', 'googleSearchConsole', 'pageSpeed', 'indexNow', 'warmCache', 'rankTracking', 'alerts', 'retention']) {
      expect(docs).toContain(id)
    }
    expect(docs).not.toContain('integrations: { anthropic:')
  })

  it('returns actionable, secret-free configuration errors', () => {
    const apply = (options: SeoPluginConfig) => () => seoPlugin(options)({ collections: [], globals: [] } as never)
    expect(apply({ modules: { unknown: true } as never })).toThrow('Unknown module capability: unknown')
    expect(apply({ integrations: { pageSpeed: true } })).toThrow('requires "performance"')
    expect(apply({ siteUrl: 'file:///etc/passwd' })).toThrow('expected an absolute HTTP(S) origin')
    expect(apply({ collectionRoutes: { posts: 'https://secret.example/path' } })).toThrow('Invalid collection route for "posts"')
    expect(validateTechnicalSeoSettings({ collections: [{ collection: 'unknown' }] }, ['pages'])[0]).toMatch(/unknown/i)
  })
})
