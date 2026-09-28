/** Security boundary shared by anonymous SEO outputs. */
export function isPublicSeoDocument(doc: Record<string, unknown>): boolean {
  if (!isPubliclyReadableDocument(doc)) return false
  const meta = doc.meta as Record<string, unknown> | undefined
  return doc.noindex !== true && meta?.noindex !== true
}

/** Publication state only. Collection ACLs are enforced by the anonymous Payload read. */
export function isPubliclyReadableDocument(doc: Record<string, unknown>): boolean {
  const status = doc._status
  if (status !== undefined && status !== 'published') return false
  return true
}
