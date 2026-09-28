import type { AnalysisContext, RuleGroup, SeoCheck, SeoConfig, SeoInput } from '../../types.js'
import { MAX_RECURSION_DEPTH } from '../../constants.js'
import { analyzeSeoWithContext, buildAnalyzerContext } from './analyzeSeo.js'
import { TECHNICAL_HEALTH_RULES } from './healthRegistry.js'
import type { AnalyzerContext, AnalyzeSeoHealthOptions, SeoFinding, SeoHealthCategory, SeoHealthResult, SeoRule } from './healthTypes.js'

export const SEO_HEALTH_CATEGORIES: readonly SeoHealthCategory[] = ['CONTENT', 'METADATA', 'INDEXABILITY', 'DISCOVERABILITY', 'STRUCTURED_DATA', 'LINKS', 'PERFORMANCE']

const GROUP_CATEGORY: Record<RuleGroup, SeoHealthCategory> = {
  title: 'METADATA', 'meta-description': 'METADATA', url: 'INDEXABILITY', headings: 'CONTENT', content: 'CONTENT', images: 'CONTENT',
  linking: 'LINKS', social: 'METADATA', schema: 'STRUCTURED_DATA', readability: 'CONTENT', quality: 'CONTENT',
  'secondary-keywords': 'CONTENT', cornerstone: 'CONTENT', freshness: 'CONTENT', technical: 'INDEXABILITY', accessibility: 'CONTENT',
  ecommerce: 'CONTENT', eeat: 'CONTENT', geo: 'CONTENT', hreflang: 'DISCOVERABILITY',
}
const objectiveErrorGroups = new Set<RuleGroup>(['title', 'meta-description', 'url', 'headings', 'technical'])

function recommendation(check: SeoCheck): string | undefined {
  if (check.status === 'pass') return undefined
  const recommendations: Partial<Record<RuleGroup, string>> = {
    title: 'Add or revise the SEO title so it clearly identifies this page.',
    'meta-description': 'Add a concise meta description describing the page’s primary purpose.',
    headings: 'Use a clear H1 and a logical heading hierarchy.',
    content: 'Review this guidance for the intended audience; avoid adding text or keywords only to satisfy a score.',
    images: 'Add meaningful alternative text to content images where applicable.',
    linking: 'Add useful, descriptive links when they help readers discover related content.',
    readability: 'Treat readability as audience-dependent guidance and revise only where clarity improves.',
    schema: 'Review structured data against the effective collection schema policy.',
    technical: 'Review the effective technical SEO configuration and emitted metadata.',
  }
  return recommendations[check.group]
}

function legacySeverity(check: SeoCheck): SeoFinding['severity'] {
  if (check.status === 'pass') return 'PASSED'
  if (check.id.startsWith('engine-')) return 'WARNING'
  if (check.status === 'fail' && check.category === 'critical' && objectiveErrorGroups.has(check.group)) return 'ERROR'
  if (check.category === 'bonus') return 'SUGGESTION'
  return 'WARNING'
}

function isNotApplicable(check: SeoCheck, context: AnalysisContext): boolean {
  if (!context.normalizedKeyword && /keyword|kw-|keyphrase/i.test(check.id)) return true
  if (context.imageStats.total === 0 && /^(image|images|a11y-image)/.test(check.id)) return true
  return false
}

function fromLegacy(check: SeoCheck, context: AnalysisContext): SeoFinding {
  if (isNotApplicable(check, context)) return {
    id: check.id, category: GROUP_CATEGORY[check.group], severity: 'NOT_APPLICABLE', title: check.label,
    description: 'This check does not apply to the available document content.', source: 'document', weight: check.weight,
  }
  return {
    id: check.id, category: GROUP_CATEGORY[check.group], severity: legacySeverity(check), title: check.label,
    description: check.message, recommendation: recommendation(check),
    source: check.id.startsWith('engine-') ? 'engine' : 'document', weight: check.weight,
  }
}

function executeRule(rule: SeoRule, context: AnalyzerContext): SeoFinding {
  if (!rule.applies(context)) return {
    id: rule.id, category: rule.category, severity: 'NOT_APPLICABLE', title: rule.id,
    description: 'Required context is not available for this check.', source: 'engine', weight: rule.weight,
  }
  try {
    return { id: rule.id, category: rule.category, weight: rule.weight, ...rule.evaluate(context) }
  } catch {
    return {
      id: rule.id, category: rule.category, severity: 'WARNING', title: 'Check unavailable',
      description: 'This diagnostic could not be evaluated. Other independent checks continued.',
      recommendation: 'Review server logs for the rule identifier if this persists.', source: 'engine', weight: 0,
    }
  }
}

function contribution(severity: SeoFinding['severity']): number {
  if (severity === 'PASSED') return 1
  if (severity === 'SUGGESTION') return 0.85
  if (severity === 'WARNING') return 0.5
  return 0
}

function calculateScore(findings: SeoFinding[]): number | null {
  const applicable = findings.filter((finding) => finding.severity !== 'NOT_APPLICABLE' && finding.weight > 0)
  const maximum = applicable.reduce((sum, finding) => sum + finding.weight, 0)
  if (maximum === 0) return null
  const earned = applicable.reduce((sum, finding) => sum + finding.weight * contribution(finding.severity), 0)
  return Math.round((earned / maximum) * 100)
}

export function analyzeSeoHealth(data: SeoInput, options: AnalyzeSeoHealthOptions = {}): SeoHealthResult {
  const config: SeoConfig = { maxRecursionDepth: MAX_RECURSION_DEPTH, ...(options.config ?? {}) }
  const extracted = buildAnalyzerContext(data, config)
  const legacy = analyzeSeoWithContext(data, config, extracted)
  const context: AnalyzerContext = {
    input: data, extracted, effectiveTechnicalSeo: options.effectiveTechnicalSeo, publicEligible: options.publicEligible,
    identity: options.identity, computedCanonicalUrl: options.computedCanonicalUrl, actualSchemaType: options.actualSchemaType,
    robotsRestricted: options.robotsRestricted, performance: options.performance,
  }
  const findings = [
    ...legacy.checks
      // M3 is authoritative for normalized technical findings; raw-field
      // technical checks remain only in the embedded legacy compatibility result.
      .filter((check) => !(options.effectiveTechnicalSeo && check.group === 'technical'))
      .map((check) => fromLegacy(check, extracted)),
    ...[...TECHNICAL_HEALTH_RULES, ...(options.additionalRules ?? [])].map((rule) => executeRule(rule, context)),
  ]
  const applicable = findings.filter((finding) => finding.severity !== 'NOT_APPLICABLE')
  const categories = SEO_HEALTH_CATEGORIES.map((category) => {
    const categoryFindings = findings.filter((finding) => finding.category === category)
    const categoryApplicable = categoryFindings.filter((finding) => finding.severity !== 'NOT_APPLICABLE')
    return {
      category, score: calculateScore(categoryFindings), applicable: categoryApplicable.length,
      passed: categoryApplicable.filter((finding) => finding.severity === 'PASSED').length,
      errors: categoryApplicable.filter((finding) => finding.severity === 'ERROR').length,
      warnings: categoryApplicable.filter((finding) => finding.severity === 'WARNING').length,
      suggestions: categoryApplicable.filter((finding) => finding.severity === 'SUGGESTION').length,
    }
  })
  return {
    score: calculateScore(findings) ?? 0, applicableRuleCount: applicable.length,
    passedCount: applicable.filter((finding) => finding.severity === 'PASSED').length,
    errorCount: applicable.filter((finding) => finding.severity === 'ERROR').length,
    warningCount: applicable.filter((finding) => finding.severity === 'WARNING').length,
    suggestionCount: applicable.filter((finding) => finding.severity === 'SUGGESTION').length,
    notApplicableCount: findings.length - applicable.length, categories, findings, legacy,
  }
}
