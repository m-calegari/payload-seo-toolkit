import type { AdminViewServerProps } from 'payload'
// @ts-ignore — @payloadcms/next is a peer dependency
import { DefaultTemplate } from '@payloadcms/next/templates'
import React from 'react'
// @ts-ignore — next is a peer dependency
import { redirect } from 'next/navigation'
import { LegacySeoConfigViewClient } from './LegacySeoConfigViewClient.js'
import { ViewErrorBoundary } from './ErrorBoundaryClient.js'
import { seoViewRedirectTarget } from '../helpers/viewAccess.js'

export const LegacySeoConfigView: React.FC<AdminViewServerProps> = ({ initPageResult }) => {
  const denied = seoViewRedirectTarget(initPageResult)
  if (denied) redirect(denied)
  const { req, visibleEntities, permissions, locale } = initPageResult
  return <DefaultTemplate i18n={req.i18n} locale={locale} params={{}} payload={req.payload} permissions={permissions} req={req} searchParams={{}} user={req.user!} visibleEntities={visibleEntities}>
    <ViewErrorBoundary viewName="LegacySeoConfigView"><LegacySeoConfigViewClient /></ViewErrorBoundary>
  </DefaultTemplate>
}

export default LegacySeoConfigView
