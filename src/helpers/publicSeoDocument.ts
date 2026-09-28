/** Security boundary shared by anonymous SEO outputs. */
export function isPublicSeoDocument(doc: Record<string, unknown>): boolean {
  const status = doc._status
  if (status !== undefined && status !== 'published') return false
  const meta = doc.meta as Record<string, unknown> | undefined
  return doc.noindex !== true && meta?.noindex !== true
}

/** Payload local-API options for an anonymous, access-controlled read. */
export const publicSeoReadAccess = { overrideAccess: false } as const
