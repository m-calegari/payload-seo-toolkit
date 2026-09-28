import type { RuleGroup, SeoThresholds } from '../../types.js'

const RULE_GROUPS = new Set<RuleGroup>([
  'title', 'meta-description', 'url', 'headings', 'content', 'images', 'linking', 'social', 'schema', 'readability',
  'quality', 'secondary-keywords', 'cornerstone', 'freshness', 'technical', 'accessibility', 'ecommerce', 'eeat', 'geo', 'hreflang',
])

export function validateAnalyzerSettings(input: { disabledRules?: unknown; thresholds?: unknown }): string[] {
  const errors: string[] = []
  if (input.disabledRules !== undefined && !Array.isArray(input.disabledRules)) errors.push('disabledRules must be an array.')
  for (const value of Array.isArray(input.disabledRules) ? input.disabledRules : []) {
    if (typeof value !== 'string' || !RULE_GROUPS.has(value as RuleGroup)) errors.push(`Unknown analyzer rule group: ${String(value)}`)
  }
  if (input.thresholds !== undefined && (!input.thresholds || typeof input.thresholds !== 'object' || Array.isArray(input.thresholds))) {
    errors.push('thresholds must be an object.')
  }
  const thresholds = input.thresholds as SeoThresholds | undefined
  for (const [name, value] of Object.entries(thresholds ?? {})) {
    if (value !== null && value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
      errors.push(`${name} must be a non-negative finite number.`)
    }
  }
  if (typeof thresholds?.titleLengthMin === 'number' && typeof thresholds.titleLengthMax === 'number' && thresholds.titleLengthMin > thresholds.titleLengthMax) {
    errors.push('Title minimum length cannot exceed its maximum.')
  }
  if (typeof thresholds?.metaDescLengthMin === 'number' && typeof thresholds.metaDescLengthMax === 'number' && thresholds.metaDescLengthMin > thresholds.metaDescLengthMax) {
    errors.push('Meta-description minimum length cannot exceed its maximum.')
  }
  if (typeof thresholds?.keywordDensityMin === 'number' && typeof thresholds.keywordDensityMax === 'number' && thresholds.keywordDensityMin > thresholds.keywordDensityMax) {
    errors.push('Keyword-density minimum cannot exceed its maximum.')
  }
  return errors
}
