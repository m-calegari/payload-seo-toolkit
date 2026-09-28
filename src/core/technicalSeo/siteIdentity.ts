import type { SiteModel } from '../urls/siteModel.js'

export interface SiteIdentity {
  root: string | null
  organizationId: string | null
  websiteId: string | null
}

export function resolveSiteIdentity(siteModel: SiteModel): SiteIdentity {
  const root = siteModel.origin
  return {
    root,
    organizationId: root ? `${root}/#organization` : null,
    websiteId: root ? `${root}/#website` : null,
  }
}
