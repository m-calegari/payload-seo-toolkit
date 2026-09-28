import type { AnalyzerContext, SeoRule } from './healthTypes.js'

const technical = (context: AnalyzerContext) => context.effectiveTechnicalSeo

export const TECHNICAL_HEALTH_RULES: readonly SeoRule[] = [
  {
    id: 'indexability.public_eligibility', category: 'INDEXABILITY', defaultSeverity: 'ERROR', weight: 4,
    applies: (ctx) => !!technical(ctx) && ctx.publicEligible !== undefined,
    evaluate: (ctx) => ctx.publicEligible
      ? { severity: 'PASSED', title: 'Public eligibility evaluated', description: 'Public access eligibility was included in the effective policy.', source: 'configuration' }
      : { severity: 'ERROR', title: 'Document is not publicly eligible', description: 'The effective public-access boundary prevents this document from being indexed.', recommendation: 'Review document publication state and Payload collection access. SEO settings cannot override access control.', source: 'configuration', configurationPath: '/seo-search-appearance' },
  },
  {
    id: 'indexability.effective_noindex', category: 'INDEXABILITY', defaultSeverity: 'WARNING', weight: 3,
    applies: (ctx) => !!technical(ctx),
    evaluate: (ctx) => technical(ctx)!.index
      ? { severity: 'PASSED', title: 'Indexing is allowed', description: 'The effective technical policy allows indexing.', source: 'configuration' }
      : { severity: 'WARNING', title: 'Indexing is disabled', description: 'The effective policy resolves this document to noindex. This can be intentional.', recommendation: 'If this page should appear in search, review its document and collection indexation settings.', source: 'configuration', configurationPath: '/seo-search-appearance', evidence: { current: 'noindex', expected: 'index' } },
  },
  {
    id: 'indexability.effective_nofollow', category: 'INDEXABILITY', defaultSeverity: 'SUGGESTION', weight: 1,
    applies: (ctx) => !!technical(ctx),
    evaluate: (ctx) => technical(ctx)!.follow
      ? { severity: 'PASSED', title: 'Link following is allowed', description: 'The effective policy allows crawlers to follow links.', source: 'configuration' }
      : { severity: 'SUGGESTION', title: 'Link following is disabled', description: 'The effective policy resolves this document to nofollow.', recommendation: 'Review the collection or document follow policy if links should be discoverable.', source: 'configuration', configurationPath: '/seo-search-appearance' },
  },
  {
    id: 'canonical.effective', category: 'INDEXABILITY', defaultSeverity: 'ERROR', weight: 4,
    applies: (ctx) => !!technical(ctx),
    evaluate: (ctx) => technical(ctx)!.canonicalUrl
      ? { severity: 'PASSED', title: 'Canonical URL is available', description: 'The canonical URL was resolved by the Site Model and technical policy.', source: 'configuration', evidence: { current: technical(ctx)!.canonicalUrl } }
      : { severity: 'ERROR', title: 'Canonical URL is unavailable', description: 'No safe canonical URL can be emitted, usually because the public origin is unavailable.', recommendation: 'Configure a valid HTTP(S) public site origin.', source: 'configuration', configurationPath: '/seo-search-appearance' },
  },
  {
    id: 'canonical.external_override', category: 'INDEXABILITY', defaultSeverity: 'WARNING', weight: 1,
    applies: (ctx) => !!technical(ctx) && !!ctx.computedCanonicalUrl && !!technical(ctx)!.canonicalUrl,
    evaluate: (ctx) => technical(ctx)!.canonicalUrl === ctx.computedCanonicalUrl
      ? { severity: 'PASSED', title: 'Canonical matches the document URL', description: 'No differing canonical override is active.', source: 'document' }
      : { severity: 'WARNING', title: 'Canonical points elsewhere', description: 'The effective canonical differs from the computed public document URL.', recommendation: 'Confirm that the alternate canonical resource is intentional.', source: 'document', evidence: { current: technical(ctx)!.canonicalUrl, expected: ctx.computedCanonicalUrl } },
  },
  {
    id: 'discoverability.sitemap', category: 'DISCOVERABILITY', defaultSeverity: 'SUGGESTION', weight: 2,
    applies: (ctx) => !!technical(ctx),
    evaluate: (ctx) => technical(ctx)!.sitemap.include
      ? { severity: 'PASSED', title: 'Included in sitemap policy', description: 'The effective sitemap policy includes this document.', source: 'configuration' }
      : { severity: 'SUGGESTION', title: 'Excluded from the sitemap', description: 'The effective sitemap policy excludes this document. This may be intentional.', recommendation: 'Review collection and document sitemap settings if discovery is expected.', source: 'configuration', configurationPath: '/seo-sitemap' },
  },
  {
    id: 'discoverability.robots', category: 'DISCOVERABILITY', defaultSeverity: 'WARNING', weight: 2,
    applies: (ctx) => ctx.robotsRestricted !== undefined,
    evaluate: (ctx) => ctx.robotsRestricted
      ? { severity: 'WARNING', title: 'Robots policy may restrict crawling', description: 'The supplied effective robots context marks this path as restricted.', recommendation: 'Review the saved robots policy.', source: 'configuration', configurationPath: '/seo-robots' }
      : { severity: 'PASSED', title: 'No robots restriction supplied', description: 'The supplied robots context does not restrict this path.', source: 'configuration' },
  },
  {
    id: 'structured_data.expected_type', category: 'STRUCTURED_DATA', defaultSeverity: 'WARNING', weight: 2,
    applies: (ctx) => !!technical(ctx) && ctx.actualSchemaType !== undefined,
    evaluate: (ctx) => ctx.actualSchemaType === null
      ? { severity: 'WARNING', title: 'Expected structured data is missing', description: `The effective collection default is ${technical(ctx)!.schema.defaultType}.`, recommendation: 'Generate structured data using the configured collection default.', source: 'document', configurationPath: '/seo-structured-data', evidence: { current: null, expected: technical(ctx)!.schema.defaultType } }
      : ctx.actualSchemaType === technical(ctx)!.schema.defaultType
        ? { severity: 'PASSED', title: 'Structured-data type matches policy', description: `The document uses ${ctx.actualSchemaType}.`, source: 'document' }
        : { severity: 'SUGGESTION', title: 'Structured-data type differs from the default', description: 'A document-specific schema type is active.', recommendation: 'Confirm that the override accurately describes this document.', source: 'document', evidence: { current: ctx.actualSchemaType, expected: technical(ctx)!.schema.defaultType } },
  },
  {
    id: 'performance.data', category: 'PERFORMANCE', defaultSeverity: 'SUGGESTION', weight: 1,
    applies: (ctx) => ctx.performance?.available === true,
    evaluate: (ctx) => ({ severity: 'PASSED', title: 'Performance data is available', description: 'Optional performance data is available for separate interpretation.', source: 'integration', evidence: { current: ctx.performance?.score ?? null } }),
  },
]
