/**
 * Read-access options for SINGLE-DOCUMENT, user-facing reads (validate, generate,
 * breadcrumb, schema-generator, ai-rewrite).
 *
 * These reads are initiated by a user, so the user's collection and field access
 * must be applied. Internal/background work that intentionally elevates access
 * must spell out `overrideAccess: true` at its call site.
 *
 * NOTE: site-wide AGGREGATION endpoints (audit, sitemap-audit, link-graph, …) keep
 * `overrideAccess: true` unconditionally — they must see every document to be
 * correct (otherwise they produce false orphans/broken links). See docs/THREAT-MODEL.md.
 */
import type { PayloadRequest } from 'payload'

export function readAccessOpts(req: PayloadRequest): {
  overrideAccess: boolean
  user?: PayloadRequest['user']
} {
  return { overrideAccess: false, user: req.user }
}
