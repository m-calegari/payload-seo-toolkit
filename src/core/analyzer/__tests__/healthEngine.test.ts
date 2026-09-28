import { describe, expect, it } from 'vitest'
import { analyzeSeo } from '../analyzeSeo.js'
import { analyzeSeoHealth, SEO_HEALTH_CATEGORIES } from '../analyzeSeoHealth.js'
import type { SeoRule } from '../healthTypes.js'
import { groupHealthFindings } from '../../../components/SeoHealthPanel.js'
import { validateAnalyzerSettings } from '../config.js'
import type { EffectiveTechnicalSeo } from '../../technicalSeo/index.js'

function lexical(text: string) {
  return { root: { children: [{ type: 'paragraph', children: [{ type: 'text', text }] }] } }
}

const input = {
  metaTitle: 'A useful and descriptive title for this example page',
  metaDescription: 'A concise description explaining this example page and its useful content to prospective readers in clear language.',
  slug: 'example',
  heroTitle: 'Example page',
  heroRichText: lexical(Array(80).fill('Useful content for readers with clear explanations and practical details.').join(' ')),
}

function technical(overrides: Partial<EffectiveTechnicalSeo> = {}): EffectiveTechnicalSeo {
  return {
    canonicalUrl: 'https://example.com/example', index: true, follow: true,
    sitemap: { include: true, priority: 0.8, changeFrequency: 'monthly' },
    schema: { defaultType: 'WebPage' }, ...overrides,
  }
}

describe('normalized SEO health engine', () => {
  it('exposes stable categories, findings and explainable counts', () => {
    const result = analyzeSeoHealth(input)
    expect(SEO_HEALTH_CATEGORIES).toEqual(['CONTENT', 'METADATA', 'INDEXABILITY', 'DISCOVERABILITY', 'STRUCTURED_DATA', 'LINKS', 'PERFORMANCE'])
    expect(result.applicableRuleCount).toBe(result.passedCount + result.errorCount + result.warningCount + result.suggestionCount)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(new Set(result.findings.map((finding) => finding.id)).size).toBeGreaterThan(20)
  })

  it('preserves legacy analyzeSeo output through the compatibility result', () => {
    expect(analyzeSeoHealth(input).legacy).toEqual(analyzeSeo(input))
  })

  it('is deterministic for identical input and configuration', () => {
    expect(analyzeSeoHealth(input)).toEqual(analyzeSeoHealth(input))
  })

  it('does not score not-applicable keyword, image, performance or integration checks', () => {
    const result = analyzeSeoHealth(input)
    expect(result.findings.filter((finding) => finding.severity === 'NOT_APPLICABLE').map((finding) => finding.id)).toEqual(expect.arrayContaining([
      'performance.data', 'discoverability.robots', 'structured_data.expected_type',
    ]))
    expect(result.categories.find((category) => category.category === 'PERFORMANCE')?.score).toBeNull()
    expect(result.notApplicableCount).toBeGreaterThan(0)
  })

  it('isolates a failed rule without leaking its exception or stopping other rules', () => {
    const broken: SeoRule = {
      id: 'test.rule.failure', category: 'CONTENT', defaultSeverity: 'WARNING', weight: 2,
      applies: () => true, evaluate: () => { throw new Error('secret implementation detail') },
    }
    const after: SeoRule = {
      id: 'test.rule.after', category: 'CONTENT', defaultSeverity: 'PASSED', weight: 1,
      applies: () => true, evaluate: () => ({ severity: 'PASSED', title: 'Continued', description: 'Independent evaluation continued.', source: 'engine' }),
    }
    const result = analyzeSeoHealth(input, { additionalRules: [broken, after] })
    expect(result.findings.find((finding) => finding.id === broken.id)).toMatchObject({ severity: 'WARNING', source: 'engine', weight: 0 })
    expect(result.findings.find((finding) => finding.id === broken.id)?.description).not.toContain('secret')
    expect(result.findings.find((finding) => finding.id === after.id)?.severity).toBe('PASSED')
  })

  it('uses stable machine IDs independent of display text', () => {
    const result = analyzeSeoHealth(input, { effectiveTechnicalSeo: technical(), publicEligible: true })
    expect(result.findings.map((finding) => finding.id)).toEqual(expect.arrayContaining([
      'indexability.public_eligibility', 'indexability.effective_noindex', 'canonical.effective', 'discoverability.sitemap',
    ]))
  })
})

describe('effective technical SEO findings', () => {
  it('passes an indexable public document using only effective M3 state', () => {
    const result = analyzeSeoHealth(input, {
      effectiveTechnicalSeo: technical(), publicEligible: true,
      computedCanonicalUrl: 'https://example.com/example', actualSchemaType: 'WebPage', robotsRestricted: false,
    })
    expect(result.findings.find((finding) => finding.id === 'indexability.effective_noindex')?.severity).toBe('PASSED')
    expect(result.findings.find((finding) => finding.id === 'discoverability.sitemap')?.severity).toBe('PASSED')
    expect(result.findings.find((finding) => finding.id === 'structured_data.expected_type')?.severity).toBe('PASSED')
    expect(result.findings.some((finding) => finding.id.startsWith('robots-') || finding.id.startsWith('canonical-ok'))).toBe(false)
  })

  it('reports intentional effective noindex as a configuration warning, not an error', () => {
    const result = analyzeSeoHealth(input, { effectiveTechnicalSeo: technical({ index: false, sitemap: { include: false, priority: 0.8, changeFrequency: 'monthly' } }), publicEligible: true })
    expect(result.findings.find((finding) => finding.id === 'indexability.effective_noindex')).toMatchObject({ severity: 'WARNING', source: 'configuration', configurationPath: '/seo-search-appearance' })
  })

  it('reports private/inaccessible content as an error regardless of SEO preference', () => {
    const result = analyzeSeoHealth(input, { effectiveTechnicalSeo: technical({ index: false }), publicEligible: false })
    expect(result.findings.find((finding) => finding.id === 'indexability.public_eligibility')?.severity).toBe('ERROR')
  })

  it('distinguishes sitemap configuration exclusion from document content', () => {
    const result = analyzeSeoHealth(input, { effectiveTechnicalSeo: technical({ sitemap: { include: false, priority: 0.5, changeFrequency: 'weekly' } }), publicEligible: true })
    expect(result.findings.find((finding) => finding.id === 'discoverability.sitemap')).toMatchObject({ severity: 'SUGGESTION', source: 'configuration', configurationPath: '/seo-sitemap' })
  })

  it('reports computed, external and unavailable canonical states', () => {
    const computed = analyzeSeoHealth(input, { effectiveTechnicalSeo: technical(), publicEligible: true, computedCanonicalUrl: 'https://example.com/example' })
    expect(computed.findings.find((finding) => finding.id === 'canonical.external_override')?.severity).toBe('PASSED')
    const external = analyzeSeoHealth(input, { effectiveTechnicalSeo: technical({ canonicalUrl: 'https://other.example/page' }), publicEligible: true, computedCanonicalUrl: 'https://example.com/example' })
    expect(external.findings.find((finding) => finding.id === 'canonical.external_override')?.severity).toBe('WARNING')
    const missing = analyzeSeoHealth(input, { effectiveTechnicalSeo: technical({ canonicalUrl: null }), publicEligible: true })
    expect(missing.findings.find((finding) => finding.id === 'canonical.effective')?.severity).toBe('ERROR')
  })

  it('degrades robots, schema and performance diagnostics gracefully without context', () => {
    const result = analyzeSeoHealth(input, { effectiveTechnicalSeo: technical(), publicEligible: true })
    for (const id of ['discoverability.robots', 'structured_data.expected_type', 'performance.data']) {
      expect(result.findings.find((finding) => finding.id === id)?.severity).toBe('NOT_APPLICABLE')
    }
  })
})

describe('admin finding presentation helpers', () => {
  it('groups errors/warnings, suggestions and passed findings without hiding successes', () => {
    const result = analyzeSeoHealth(input, { effectiveTechnicalSeo: technical({ index: false }), publicEligible: true })
    const grouped = groupHealthFindings(result.findings)
    expect(grouped.issues.length).toBeGreaterThan(0)
    expect(grouped.suggestions.length).toBeGreaterThan(0)
    expect(grouped.passed.length).toBeGreaterThan(0)
    expect(grouped.issues[0].severity === 'ERROR' || grouped.issues[0].severity === 'WARNING').toBe(true)
  })
})

describe('normalized content diagnostics', () => {
  it('classifies missing essential metadata more strongly than heuristic guidance', () => {
    const result = analyzeSeoHealth({ slug: 'empty', metaTitle: '', metaDescription: '' })
    expect(result.findings.find((finding) => finding.id === 'title-missing')?.severity).toBe('ERROR')
    expect(result.findings.find((finding) => finding.id === 'meta-desc-missing')?.severity).toBe('ERROR')
    const wordCount = result.findings.find((finding) => finding.id === 'content-wordcount')
    expect(['WARNING', 'SUGGESTION']).toContain(wordCount?.severity)
  })

  it('treats keyword-density and readability advice as non-error guidance', () => {
    const result = analyzeSeoHealth({ ...input, focusKeyword: 'example' })
    for (const finding of result.findings.filter((item) => /density|readability|flesch/i.test(item.id))) {
      expect(finding.severity).not.toBe('ERROR')
    }
  })

  it('reports headings and links in their normalized primary categories', () => {
    const result = analyzeSeoHealth(input)
    expect(result.findings.find((finding) => finding.id === 'h1-missing')?.category).toBe('CONTENT')
    expect(result.findings.find((finding) => finding.id === 'linking-internal')?.category).toBe('LINKS')
  })

  it('validates persisted analyzer groups and heuristic threshold ranges', () => {
    expect(validateAnalyzerSettings({ disabledRules: ['unknown'], thresholds: { titleLengthMin: 70, titleLengthMax: 20, keywordDensityMin: -1 } })).toEqual(expect.arrayContaining([
      'Unknown analyzer rule group: unknown',
      'Title minimum length cannot exceed its maximum.',
      'keywordDensityMin must be a non-negative finite number.',
    ]))
  })
})
