export interface RobotsPolicy {
  userAgent: string
  allow: string[]
  disallow: string[]
  advertiseSitemap: boolean
  customRules: string
}

export const DEFAULT_ROBOTS_POLICY: RobotsPolicy = {
  userAgent: '*',
  allow: ['/'],
  disallow: ['/admin/*', '/api/*'],
  advertiseSitemap: true,
  customRules: '',
}

function safeAgent(value: unknown): string {
  if (typeof value !== 'string') return '*'
  const trimmed = value.trim()
  return /^[A-Za-z0-9*._-]+$/.test(trimmed) ? trimmed : '*'
}

function paths(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback
  return value.flatMap((entry) => {
    const raw = typeof entry === 'string' ? entry : String((entry as { path?: unknown })?.path ?? '')
    const path = raw.trim()
    return path.startsWith('/') && !/[\r\n\0]/.test(path) ? [path] : []
  })
}

export function normalizeRobotsPolicy(input?: {
  userAgent?: unknown
  allow?: unknown
  disallow?: unknown
  advertiseSitemap?: unknown
  customRules?: unknown
}): RobotsPolicy {
  return {
    userAgent: safeAgent(input?.userAgent),
    allow: paths(input?.allow, ['/']),
    disallow: paths(input?.disallow, ['/admin/*', '/api/*']),
    advertiseSitemap: input?.advertiseSitemap !== false,
    customRules: typeof input?.customRules === 'string' ? input.customRules : '',
  }
}

export function buildRobotsTxt(policy: RobotsPolicy, sitemapUrl: string | null): string {
  const lines = [`User-agent: ${policy.userAgent}`]
  for (const path of policy.allow) lines.push(`Allow: ${path}`)
  for (const path of policy.disallow) lines.push(`Disallow: ${path}`)
  if (policy.customRules) lines.push(policy.customRules)
  if (policy.advertiseSitemap && sitemapUrl) lines.push('', `Sitemap: ${sitemapUrl}`)
  return `${lines.join('\n')}\n`
}
