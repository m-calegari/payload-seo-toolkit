export interface PayloadSeoFieldCompatibility {
  container: 'group' | 'tab' | null
  title: boolean
  description: boolean
  image: boolean
  canonical: boolean
  noindex: boolean
  nofollow: boolean
  robots: boolean
}

/** Structural detection only; @payloadcms/plugin-seo remains optional. */
export function detectPayloadSeoFields(fields: unknown[]): PayloadSeoFieldCompatibility {
  let container: PayloadSeoFieldCompatibility['container'] = null
  let inner: Array<Record<string, unknown>> = []
  for (const value of fields) {
    const field = value as Record<string, unknown>
    if (field.name === 'meta' && field.type === 'group' && Array.isArray(field.fields)) {
      container = 'group'; inner = field.fields as Array<Record<string, unknown>>; break
    }
    if (field.type === 'tabs' && Array.isArray(field.tabs)) {
      const tab = (field.tabs as Array<Record<string, unknown>>).find((candidate) => candidate.name === 'meta')
      if (tab && Array.isArray(tab.fields)) { container = 'tab'; inner = tab.fields as Array<Record<string, unknown>>; break }
    }
  }
  const names = new Set(inner.map((field) => String(field.name ?? '')))
  return {
    container,
    title: names.has('title'), description: names.has('description'), image: names.has('image'),
    canonical: names.has('canonicalUrl') || names.has('canonical'),
    noindex: names.has('noindex'), nofollow: names.has('nofollow'), robots: names.has('robots'),
  }
}

export function hasCompatiblePayloadSeoMeta(fields: unknown[]): boolean {
  const detected = detectPayloadSeoFields(fields)
  return detected.title && detected.description
}
