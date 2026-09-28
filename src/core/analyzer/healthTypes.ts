import type { EffectiveTechnicalSeo } from '../technicalSeo/index.js'
import type { AnalysisContext, SeoConfig, SeoInput } from '../../types.js'

export type SeoHealthCategory = 'CONTENT' | 'METADATA' | 'INDEXABILITY' | 'DISCOVERABILITY' | 'STRUCTURED_DATA' | 'LINKS' | 'PERFORMANCE'
export type SeoFindingSeverity = 'ERROR' | 'WARNING' | 'SUGGESTION' | 'PASSED' | 'NOT_APPLICABLE'

export interface SeoFindingEvidence {
  current?: string | number | boolean | null
  expected?: string | number | boolean | null
}

export interface SeoFinding {
  id: string
  category: SeoHealthCategory
  severity: SeoFindingSeverity
  title: string
  description: string
  recommendation?: string
  evidence?: SeoFindingEvidence
  source: 'document' | 'configuration' | 'integration' | 'engine'
  configurationPath?: '/seo-search-appearance' | '/seo-sitemap' | '/seo-robots' | '/seo-structured-data'
  weight: number
}

export interface AnalyzerContext {
  input: SeoInput
  extracted: AnalysisContext
  effectiveTechnicalSeo?: EffectiveTechnicalSeo
  publicEligible?: boolean
  identity?: { collection: string; slug?: string | null; locale?: string | null }
  computedCanonicalUrl?: string | null
  actualSchemaType?: string | null
  robotsRestricted?: boolean
  performance?: { score?: number; available: boolean }
}

export interface SeoRule {
  id: string
  category: SeoHealthCategory
  defaultSeverity: SeoFindingSeverity
  weight: number
  applies(context: AnalyzerContext): boolean
  evaluate(context: AnalyzerContext): Omit<SeoFinding, 'id' | 'category' | 'weight'>
}

export interface SeoCategoryHealth {
  category: SeoHealthCategory
  score: number | null
  applicable: number
  passed: number
  errors: number
  warnings: number
  suggestions: number
}

export interface SeoHealthResult {
  score: number
  applicableRuleCount: number
  passedCount: number
  errorCount: number
  warningCount: number
  suggestionCount: number
  notApplicableCount: number
  categories: SeoCategoryHealth[]
  findings: SeoFinding[]
  legacy: ReturnType<typeof import('./analyzeSeo.js')['analyzeSeo']>
}

export interface AnalyzeSeoHealthOptions {
  config?: SeoConfig
  effectiveTechnicalSeo?: EffectiveTechnicalSeo
  publicEligible?: boolean
  identity?: AnalyzerContext['identity']
  computedCanonicalUrl?: string | null
  actualSchemaType?: string | null
  robotsRestricted?: boolean
  performance?: AnalyzerContext['performance']
  additionalRules?: SeoRule[]
}
