'use client'

import React, { useMemo, useState } from 'react'
// @ts-ignore — next is a peer dependency
import Link from 'next/link'
import type { SeoFinding, SeoHealthResult } from '../core/analyzer/healthTypes.js'

const severityColor: Record<SeoFinding['severity'], string> = {
  ERROR: '#dc2626', WARNING: '#d97706', SUGGESTION: '#2563eb', PASSED: '#16a34a', NOT_APPLICABLE: '#6b7280',
}

export function groupHealthFindings(findings: SeoFinding[]) {
  const severityRank = (finding: SeoFinding) => finding.severity === 'ERROR' ? 0 : finding.severity === 'WARNING' ? 1 : 2
  return {
    issues: findings.filter((finding) => finding.severity === 'ERROR' || finding.severity === 'WARNING').sort((a, b) => severityRank(a) - severityRank(b) || b.weight - a.weight || a.id.localeCompare(b.id)),
    suggestions: findings.filter((finding) => finding.severity === 'SUGGESTION'),
    passed: findings.filter((finding) => finding.severity === 'PASSED'),
    notApplicable: findings.filter((finding) => finding.severity === 'NOT_APPLICABLE'),
  }
}

function Finding({ finding }: { finding: SeoFinding }) {
  const adminPrefix = typeof window !== 'undefined' ? window.location.pathname.match(/^(\/[^/]+)\//)?.[1] || '/admin' : '/admin'
  return <article style={{ borderLeft: `3px solid ${severityColor[finding.severity]}`, padding: '8px 10px', marginBottom: 8, background: 'var(--theme-elevation-50)' }}>
    <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}><strong>{finding.title}</strong><span style={{ color: severityColor[finding.severity], fontSize: 11, fontWeight: 700 }}>{finding.severity.replace('_', ' ')}</span><small style={{ color: 'var(--theme-elevation-600)' }}>{finding.source === 'configuration' ? 'Configuration' : finding.source === 'document' ? 'Document' : finding.source}</small></div>
    <p style={{ margin: '5px 0', fontSize: 12 }}>{finding.description}</p>
    {finding.recommendation && <p style={{ margin: '5px 0', fontSize: 12 }}><strong>Recommended:</strong> {finding.recommendation}</p>}
    {finding.evidence && <div style={{ fontSize: 11, color: 'var(--theme-elevation-600)', overflowWrap: 'anywhere' }}>Current: {String(finding.evidence.current ?? 'none')}{finding.evidence.expected !== undefined ? ` · Expected: ${String(finding.evidence.expected)}` : ''}</div>}
    {finding.configurationPath && <Link href={`${adminPrefix}${finding.configurationPath}`} style={{ display: 'inline-block', marginTop: 5, fontSize: 12 }}>Open relevant SEO configuration →</Link>}
  </article>
}

export function SeoHealthPanel({ health }: { health: SeoHealthResult }) {
  const grouped = useMemo(() => groupHealthFindings(health.findings), [health.findings])
  const [category, setCategory] = useState<string>('ALL')
  const visible = category === 'ALL' ? health.findings : health.findings.filter((finding) => finding.category === category)
  const visibleGroups = groupHealthFindings(visible)
  return <section aria-labelledby="seo-health-title" style={{ marginBottom: 16, border: '1px solid var(--theme-elevation-200)', borderRadius: 8, padding: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><h3 id="seo-health-title" style={{ margin: 0 }}>SEO Health</h3><p style={{ margin: '4px 0', fontSize: 12, color: 'var(--theme-elevation-600)' }}>{health.errorCount} errors · {health.warningCount} warnings · {health.suggestionCount} suggestions · {health.passedCount} passed</p></div><div style={{ fontSize: 14 }}><strong>{health.score} / 100</strong><br/><small>{health.applicableRuleCount} applicable checks</small></div></div>
    <div role="group" aria-label="Filter findings by category" style={{ display: 'flex', gap: 5, overflowX: 'auto', margin: '10px 0' }}>
      <button type="button" aria-pressed={category === 'ALL'} onClick={() => setCategory('ALL')}>All</button>
      {health.categories.map((item) => <button type="button" key={item.category} aria-pressed={category === item.category} onClick={() => setCategory(item.category)}>{item.category.replace('_', ' ')} {item.score === null ? 'N/A' : item.score}</button>)}
    </div>
    {visibleGroups.issues.length > 0 && <div><h4>Issues</h4>{visibleGroups.issues.slice(0, 5).map((finding) => <Finding key={finding.id} finding={finding} />)}</div>}
    {visibleGroups.suggestions.length > 0 && <details><summary>Suggestions ({visibleGroups.suggestions.length})</summary><div style={{ marginTop: 8 }}>{visibleGroups.suggestions.map((finding) => <Finding key={finding.id} finding={finding} />)}</div></details>}
    <details><summary>Passed checks ({visibleGroups.passed.length})</summary><div style={{ marginTop: 8 }}>{visibleGroups.passed.map((finding) => <Finding key={finding.id} finding={finding} />)}</div></details>
    {visibleGroups.notApplicable.length > 0 && <details><summary>Not applicable ({visibleGroups.notApplicable.length})</summary><div style={{ marginTop: 8 }}>{visibleGroups.notApplicable.map((finding) => <Finding key={finding.id} finding={finding} />)}</div></details>}
    {grouped.issues.length > 5 && category === 'ALL' && <p style={{ fontSize: 11, color: 'var(--theme-elevation-600)' }}>Showing the five highest-priority issues in the compact sidebar. Filter by category for detail.</p>}
  </section>
}
