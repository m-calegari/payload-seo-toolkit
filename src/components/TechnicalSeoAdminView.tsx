'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
// @ts-ignore — next is a peer dependency
import Link from 'next/link'
// @ts-ignore — next is a peer dependency
import { usePathname } from 'next/navigation'

type Section = 'overview' | 'search' | 'sitemap' | 'robots' | 'structured' | 'settings'
type CollectionSummary = {
  slug: string; label: string; route: string; examplePath: string; index: boolean; follow: boolean
  sitemapEnabled: boolean; sitemapPriority: number; sitemapChangeFrequency: string; schemaType: string
  source: 'stored' | 'compatibility default'
}
type Effective = {
  site: { name: string; origin: string | null; root: string | null; organizationId: string | null; websiteId: string | null; originSource: string }
  defaults: { index: boolean; follow: boolean; schemaType: string }
  collections: CollectionSummary[]
  sitemap: { endpoint: string; url: string | null; enabledCount: number; disabledCount: number }
  robots: { endpoint: string; url: string | null; builtInDisallow: string[]; preview: string; policy: { userAgent: string; allow: string[]; disallow: string[]; advertiseSitemap: boolean; customRules: string } }
  health: Array<{ code: string; status: string; message: string }>
  application: { targetCollections: string[]; collectionRoutes: Record<string, string>; siteOriginEditable: false }
}
type Settings = Record<string, unknown> & {
  siteName?: string
  technicalSeo?: { collections?: Array<Record<string, unknown>> }
  robots?: { userAgent?: string; allow?: Array<{ path: string } | string>; disallow?: Array<{ path: string } | string>; advertiseSitemap?: boolean }
  robotsCustomRules?: string
  sitemap?: { excludedSlugs?: Array<{ slug: string }>; defaultPriority?: number; defaultChangefreq?: string; priorityOverrides?: unknown[] }
}
type Preview = { preview: Array<{ url: string; collection: string; title: string; priority: number; changefreq: string }>; stats: { totalPages: number; includedCount: number; excludedCount: number; previewLimit: number } }

const schemaHelp: Record<string, string> = {
  WebPage: 'General page content.', Article: 'Editorial or article-style content.', Product: 'A product or purchasable item.',
  Event: 'An event with date or location information.', LocalBusiness: 'A location-based organization.', FAQPage: 'A page containing questions and answers.',
  Organization: 'An organization identity.', Person: 'A person or author profile.', Recipe: 'Recipe content.', Video: 'Video-led content.', BreadcrumbList: 'A navigational breadcrumb trail.',
}
const schemaTypes = Object.keys(schemaHelp)
const frequencies = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']
const V = { text: 'var(--theme-text)', muted: 'var(--theme-elevation-600)', card: 'var(--theme-elevation-50)', bg: 'var(--theme-elevation-0)', border: 'var(--theme-elevation-200)', accent: 'var(--theme-success-500, #16a34a)', warning: 'var(--theme-warning-500, #b45309)' }
const card: React.CSSProperties = { background: V.card, border: `1px solid ${V.border}`, borderRadius: 8, padding: 18 }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 5, border: `1px solid ${V.border}`, background: V.bg, color: V.text }
const label: React.CSSProperties = { display: 'block', fontWeight: 600, marginBottom: 5 }

function sectionFor(pathname: string): Section {
  if (pathname.endsWith('/seo-overview')) return 'overview'
  if (pathname.endsWith('/seo-search-appearance')) return 'search'
  if (pathname.endsWith('/seo-sitemap')) return 'sitemap'
  if (pathname.endsWith('/seo-robots')) return 'robots'
  if (pathname.endsWith('/seo-structured-data')) return 'structured'
  return 'settings'
}

function paths(value: Array<{ path: string } | string> | undefined): string {
  return (value ?? []).map((entry) => typeof entry === 'string' ? entry : entry.path).filter(Boolean).join('\n')
}

function Status({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'attention' }) {
  const colors = tone === 'good' ? ['#dcfce7', '#166534'] : tone === 'attention' ? ['#fef3c7', '#92400e'] : ['var(--theme-elevation-100)', V.text]
  return <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: colors[0], color: colors[1] }}>{children}</span>
}

export function TechnicalSeoAdminView() {
  const pathname = usePathname() || '/admin/seo-config'
  const section = sectionFor(pathname)
  const adminPrefix = pathname.match(/^(\/[^/]+)\//)?.[1] || '/admin'
  const [settings, setSettings] = useState<Settings>({})
  const [saved, setSaved] = useState('{}')
  const [effective, setEffective] = useState<Effective | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'good' | 'attention'; text: string } | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const dirty = useMemo(() => JSON.stringify(settings) !== saved, [settings, saved])

  const load = useCallback(async () => {
    setLoading(true); setMessage(null)
    try {
      const response = await fetch('/api/seo-plugin/settings', { credentials: 'include', cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || `Unable to load settings (${response.status}).`)
      const next = data.settings || {}
      setSettings(next); setSaved(JSON.stringify(next)); setEffective(data.effective)
    } catch (error) {
      setMessage({ tone: 'attention', text: error instanceof Error ? error.message : 'Unable to load SEO settings.' })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])
  useEffect(() => {
    const guardLinks = (event: MouseEvent) => {
      if (!dirty || event.defaultPrevented) return
      const anchor = (event.target as Element | null)?.closest('a[href]')
      if (anchor && !window.confirm('Discard unsaved SEO changes?')) event.preventDefault()
    }
    document.addEventListener('click', guardLinks, true)
    return () => document.removeEventListener('click', guardLinks, true)
  }, [dirty])

  const save = useCallback(async () => {
    setSaving(true); setMessage(null)
    try {
      const response = await fetch('/api/seo-plugin/settings', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
      const data = await response.json()
      if (!response.ok) {
        const details = Array.isArray(data.details) ? ` ${data.details.join(' ')}` : ''
        throw new Error(`${data.error || `Save failed (${response.status}).`}${details}`)
      }
      const next = data.settings || settings
      setSettings(next); setSaved(JSON.stringify(next)); setEffective(data.effective); setPreview(null)
      setMessage({ tone: 'good', text: 'SEO settings saved. Effective previews have been refreshed.' })
    } catch (error) {
      setMessage({ tone: 'attention', text: error instanceof Error ? error.message : 'Unable to save SEO settings.' })
    } finally { setSaving(false) }
  }, [settings])

  const rows = effective?.collections ?? []
  const storedRows = (settings.technicalSeo?.collections ?? []) as Array<Record<string, unknown>>
  const updateCollection = (slug: string, key: string, value: unknown) => {
    const base = rows.find((row) => row.slug === slug)
    const index = storedRows.findIndex((row) => row.collection === slug)
    const fallback: Record<string, unknown> = base ? {
      collection: slug, index: base.index, follow: base.follow, sitemapEnabled: base.sitemapEnabled,
      sitemapPriority: base.sitemapPriority, sitemapChangeFrequency: base.sitemapChangeFrequency, defaultSchemaType: base.schemaType,
    } : { collection: slug }
    const next = [...storedRows]
    if (index >= 0) next[index] = { ...next[index], [key]: value }
    else next.push({ ...fallback, [key]: value })
    setSettings((previous) => ({ ...previous, technicalSeo: { ...(previous.technicalSeo ?? {}), collections: next } }))
  }
  const storedValue = (row: CollectionSummary, key: string, fallback: unknown) => storedRows.find((item) => item.collection === row.slug)?.[key] ?? fallback
  const setRobots = (key: string, value: unknown) => setSettings((previous) => ({ ...previous, robots: { ...(previous.robots ?? {}), [key]: value } }))
  const loadPreview = async () => {
    setPreviewLoading(true); setMessage(null)
    try {
      const response = await fetch('/api/seo-plugin/sitemap-config', { credentials: 'include', cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load sitemap preview.')
      setPreview(data)
    } catch (error) { setMessage({ tone: 'attention', text: error instanceof Error ? error.message : 'Unable to load sitemap preview.' }) }
    finally { setPreviewLoading(false) }
  }

  const nav: Array<[Section, string, string]> = [
    ['overview', 'Overview', '/seo-overview'], ['search', 'Search Appearance', '/seo-search-appearance'], ['sitemap', 'Sitemap', '/seo-sitemap'],
    ['robots', 'Robots', '/seo-robots'], ['structured', 'Structured Data', '/seo-structured-data'], ['settings', 'Settings', '/seo-config'],
  ]
  if (loading) return <div style={{ padding: 32 }}>Loading SEO configuration…</div>

  return <main style={{ maxWidth: 1120, margin: '0 auto', padding: '20px 24px', color: V.text }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      <div><h1 style={{ margin: 0 }}>SEO</h1><p style={{ color: V.muted, margin: '5px 0 0' }}>Search appearance and technical configuration</p></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span role="status" aria-live="polite" style={{ color: V.muted }}>{dirty ? 'Unsaved changes' : 'Saved'}</span>
        <button type="button" onClick={() => void save()} disabled={!dirty || saving} style={{ padding: '9px 16px', border: 0, borderRadius: 5, background: V.accent, color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: !dirty || saving ? .55 : 1 }}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </header>
    <nav aria-label="SEO configuration" style={{ display: 'flex', gap: 4, overflowX: 'auto', borderBottom: `1px solid ${V.border}`, margin: '22px 0' }}>
      {nav.map(([key, text, href]) => <Link key={key} href={`${adminPrefix}${href}`} aria-current={section === key ? 'page' : undefined} style={{ whiteSpace: 'nowrap', padding: '10px 12px', color: section === key ? V.text : V.muted, textDecoration: 'none', fontWeight: section === key ? 700 : 500, borderBottom: section === key ? '2px solid currentColor' : '2px solid transparent' }}>{text}</Link>)}
    </nav>
    {message && <div role={message.tone === 'attention' ? 'alert' : 'status'} style={{ ...card, marginBottom: 16, borderColor: message.tone === 'attention' ? V.warning : V.accent }}>{message.text}</div>}

    {section === 'overview' && effective && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
        <section style={card}><h2 style={{ marginTop: 0, fontSize: 16 }}>Site identity</h2><strong>{effective.site.name || 'Unnamed site'}</strong><div style={{ color: V.muted, overflowWrap: 'anywhere' }}>{effective.site.origin || 'No valid public origin'}</div></section>
        <section style={card}><h2 style={{ marginTop: 0, fontSize: 16 }}>Indexation</h2><Status tone={rows.some((row) => row.index) ? 'good' : 'attention'}>{rows.filter((row) => row.index).length} of {rows.length} collections indexable</Status></section>
        <section style={card}><h2 style={{ marginTop: 0, fontSize: 16 }}>Sitemap</h2><Status tone={effective.sitemap.enabledCount ? 'good' : 'attention'}>{effective.sitemap.enabledCount} included</Status><div style={{ color: V.muted, marginTop: 7, overflowWrap: 'anywhere' }}>{effective.sitemap.url || 'Unavailable without an origin'}</div></section>
        <section style={card}><h2 style={{ marginTop: 0, fontSize: 16 }}>Robots</h2><Status tone="good">Configured</Status><div style={{ color: V.muted, marginTop: 7 }}>{effective.robots.policy.disallow.length} blocked paths</div></section>
      </div>
      <section style={{ ...card, marginTop: 16 }}><h2 style={{ marginTop: 0 }}>Configuration health</h2><ul>{effective.health.map((item) => <li key={item.code} style={{ marginBottom: 8 }}><Status tone={item.status === 'configured' ? 'good' : 'attention'}>{item.status.replace('-', ' ')}</Status> <span style={{ marginLeft: 7 }}>{item.message}</span></li>)}</ul></section>
      <section style={{ ...card, marginTop: 16 }}><h2 style={{ marginTop: 0 }}>Structured-data defaults</h2><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{rows.map((row) => <Status key={row.slug}>{row.label}: {row.schemaType}</Status>)}</div></section>
    </>}

    {section === 'search' && effective && <>
      <section style={card}><h2 style={{ marginTop: 0 }}>General defaults</h2><p>New configured collections default to <strong>{effective.defaults.index ? 'index' : 'noindex'}</strong>, <strong>{effective.defaults.follow ? 'follow' : 'nofollow'}</strong>, and <strong>{effective.defaults.schemaType}</strong>.</p><p style={{ color: V.muted }}>Canonical origin: {effective.site.origin || 'Unavailable — configure the application site origin.'}</p></section>
      <section style={{ ...card, marginTop: 16 }}><h2 style={{ marginTop: 0 }}>Collections</h2><p style={{ color: V.muted }}>Routing is application configuration. SEO policy below is saved in Payload.</p>
        {rows.map((row) => <fieldset key={row.slug} style={{ border: `1px solid ${V.border}`, borderRadius: 7, margin: '14px 0', padding: 14 }}><legend style={{ fontWeight: 700 }}>{row.label} <small style={{ color: V.muted }}>({row.slug})</small></legend>
          <div style={{ color: V.muted, marginBottom: 12 }}>Public route: <code>{row.route}</code> · Example: <code>{row.examplePath}</code></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 }}>
            <label><input type="checkbox" checked={Boolean(storedValue(row, 'index', row.index))} onChange={(event) => updateCollection(row.slug, 'index', event.target.checked)} /> Allow search engines to index this collection</label>
            <label><input type="checkbox" checked={Boolean(storedValue(row, 'follow', row.follow))} onChange={(event) => updateCollection(row.slug, 'follow', event.target.checked)} /> Allow search engines to follow links</label>
          </div>
          {!Boolean(storedValue(row, 'index', row.index)) && <p role="status" style={{ color: V.warning }}>Pages in this collection will be noindex by default and excluded from the sitemap.</p>}
          <small style={{ color: V.muted }}>Effective source: {row.source}</small>
        </fieldset>)}
      </section>
    </>}

    {section === 'sitemap' && effective && <>
      <section style={card}><h2 style={{ marginTop: 0 }}>Sitemap</h2><p>Endpoint: <code>{effective.sitemap.endpoint}</code></p><p style={{ overflowWrap: 'anywhere' }}>Effective URL: {effective.sitemap.url || 'Unavailable without a valid public origin'}</p></section>
      <section style={{ ...card, marginTop: 16, overflowX: 'auto' }}><h2 style={{ marginTop: 0 }}>Collection policy</h2><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}><thead><tr><th scope="col">Collection</th><th scope="col">Included</th><th scope="col">Priority</th><th scope="col">Change frequency</th></tr></thead><tbody>{rows.map((row) => <tr key={row.slug}><th scope="row" style={{ textAlign: 'left', padding: 8 }}>{row.label}</th><td><input aria-label={`Include ${row.label} in sitemap`} type="checkbox" checked={Boolean(storedValue(row, 'sitemapEnabled', row.sitemapEnabled))} onChange={(event) => updateCollection(row.slug, 'sitemapEnabled', event.target.checked)} /></td><td><input aria-label={`${row.label} sitemap priority`} type="number" min="0" max="1" step="0.1" value={Number(storedValue(row, 'sitemapPriority', row.sitemapPriority))} onChange={(event) => updateCollection(row.slug, 'sitemapPriority', Number(event.target.value))} style={{ ...input, width: 85 }} /></td><td><select aria-label={`${row.label} change frequency`} value={String(storedValue(row, 'sitemapChangeFrequency', row.sitemapChangeFrequency))} onChange={(event) => updateCollection(row.slug, 'sitemapChangeFrequency', event.target.value)} style={{ ...input, width: 140 }}>{frequencies.map((value) => <option key={value}>{value}</option>)}</select></td></tr>)}</tbody></table></section>
      <details style={{ ...card, marginTop: 16 }}><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Advanced legacy settings</summary><p style={{ color: V.muted }}>Collection policies are preferred. Existing pattern overrides are preserved.</p><label style={label}>Excluded slug patterns<textarea value={(settings.sitemap?.excludedSlugs ?? []).map((item) => item.slug).join('\n')} onChange={(event) => setSettings((previous) => ({ ...previous, sitemap: { ...(previous.sitemap ?? {}), excludedSlugs: event.target.value.split('\n').map((slug) => slug.trim()).filter(Boolean).map((slug) => ({ slug })) } }))} rows={5} style={input} /></label></details>
      <section style={{ ...card, marginTop: 16 }}><h2 style={{ marginTop: 0 }}>Bounded preview</h2><button type="button" onClick={() => void loadPreview()} disabled={previewLoading}>{previewLoading ? 'Loading…' : 'Load saved-policy preview'}</button>{preview && <><p>{preview.stats.includedCount} included · {preview.stats.excludedCount} excluded · showing at most {preview.stats.previewLimit}</p><ul>{preview.preview.map((item) => <li key={`${item.collection}:${item.url}`} style={{ marginBottom: 6 }}><code>{item.url}</code> — {item.priority}, {item.changefreq}</li>)}</ul></>}</section>
      <p><Link href={`${adminPrefix}/sitemap-audit`}>Open Sitemap Audit diagnostics →</Link></p>
    </>}

    {section === 'robots' && effective && <>
      <section style={card}><h2 style={{ marginTop: 0 }}>Built-in protection</h2><p>These application paths are protected by default and are not accidental custom entries.</p>{effective.robots.builtInDisallow.map((path) => <Status key={path}>{path}</Status>)}</section>
      <section style={{ ...card, marginTop: 16 }}><h2 style={{ marginTop: 0 }}>Robots policy</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}><label><span style={label}>User-agent</span><input value={settings.robots?.userAgent ?? effective.robots.policy.userAgent} onChange={(event) => setRobots('userAgent', event.target.value)} style={input} /></label><label><span style={label}>Sitemap advertisement</span><input type="checkbox" checked={settings.robots?.advertiseSitemap ?? effective.robots.policy.advertiseSitemap} onChange={(event) => setRobots('advertiseSitemap', event.target.checked)} /> Advertise the sitemap URL</label><label><span style={label}>Allowed paths</span><textarea rows={4} value={settings.robots?.allow === undefined ? effective.robots.policy.allow.join('\n') : paths(settings.robots.allow)} onChange={(event) => setRobots('allow', event.target.value.split('\n').filter(Boolean).map((path) => ({ path })))} style={input} /></label><label><span style={label}>Blocked paths</span><textarea rows={4} value={settings.robots?.disallow === undefined ? effective.robots.policy.disallow.join('\n') : paths(settings.robots.disallow)} onChange={(event) => setRobots('disallow', event.target.value.split('\n').filter(Boolean).map((path) => ({ path })))} style={input} /></label></div></section>
      <details style={{ ...card, marginTop: 16 }}><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Advanced custom directives</summary><p style={{ color: V.muted }}>Only supported robots directives are retained by the server sanitizer.</p><textarea aria-label="Custom robots directives" rows={7} value={settings.robotsCustomRules ?? ''} onChange={(event) => setSettings((previous) => ({ ...previous, robotsCustomRules: event.target.value }))} style={{ ...input, fontFamily: 'monospace' }} /></details>
      <section style={{ ...card, marginTop: 16 }}><h2 style={{ marginTop: 0 }}>Effective saved robots.txt</h2><p style={{ color: V.muted }}>{effective.robots.url || 'URL unavailable without a public origin'}</p><pre style={{ overflowX: 'auto', whiteSpace: 'pre-wrap', background: V.bg, padding: 14, borderRadius: 5 }}>{effective.robots.preview}</pre></section>
    </>}

    {section === 'structured' && effective && <>
      <section style={card}><h2 style={{ marginTop: 0 }}>Site schema identity</h2><p>Document schema references stable site identities.</p><dl><dt>Organization</dt><dd style={{ overflowWrap: 'anywhere' }}>{effective.site.organizationId || 'Unavailable'}</dd><dt>WebSite</dt><dd style={{ overflowWrap: 'anywhere' }}>{effective.site.websiteId || 'Unavailable'}</dd></dl></section>
      <section style={{ ...card, marginTop: 16 }}><h2 style={{ marginTop: 0 }}>Collection defaults</h2>{rows.map((row) => <label key={row.slug} style={{ display: 'grid', gridTemplateColumns: 'minmax(130px,1fr) minmax(180px,2fr)', gap: 12, alignItems: 'center', marginBottom: 12 }}><span><strong>{row.label}</strong><br/><small style={{ color: V.muted }}>{row.slug}</small></span><span><select aria-label={`${row.label} schema type`} value={String(storedValue(row, 'defaultSchemaType', row.schemaType))} onChange={(event) => updateCollection(row.slug, 'defaultSchemaType', event.target.value)} style={input}>{schemaTypes.map((type) => <option key={type}>{type}</option>)}</select><small style={{ color: V.muted }}>{schemaHelp[String(storedValue(row, 'defaultSchemaType', row.schemaType))]}</small></span></label>)}</section>
      <p><Link href={`${adminPrefix}/schema-builder`}>Open the advanced Schema Builder →</Link></p>
    </>}

    {section === 'settings' && effective && <>
      <section style={card}><h2 style={{ marginTop: 0 }}>SEO settings</h2><label><span style={label}>Site name</span><input value={settings.siteName ?? ''} onChange={(event) => setSettings((previous) => ({ ...previous, siteName: event.target.value }))} style={input} /></label></section>
      <section style={{ ...card, marginTop: 16 }}><h2 style={{ marginTop: 0 }}>Application configuration <Status>Read-only</Status></h2><p style={{ color: V.muted }}>These values come from application startup configuration and cannot be safely changed here.</p><dl><dt>Effective public origin</dt><dd>{effective.site.origin || 'Unavailable'}</dd><dt>Target collections</dt><dd>{effective.application.targetCollections.join(', ') || 'None'}</dd><dt>Collection routes</dt><dd><code>{JSON.stringify(effective.application.collectionRoutes)}</code></dd></dl></section>
      <section style={{ ...card, marginTop: 16 }}><h2 style={{ marginTop: 0 }}>Legacy analyzer settings</h2><p>The inherited analyzer thresholds, ignored pages, and breadcrumb settings remain stored and compatible. They are intentionally separate from technical SEO policy.</p><p><Link href={`${adminPrefix}/seo-legacy-config`}>Edit legacy analyzer settings →</Link></p><p><Link href={`${adminPrefix}/seo`}>Open the operational SEO dashboard →</Link></p></section>
    </>}
  </main>
}
