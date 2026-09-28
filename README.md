# Payload SEO Analyzer

A modular SEO toolkit for Payload CMS 3. The core package provides metadata fields, canonical URL
resolution, indexation policy, standard sitemap and robots output, structured-data defaults, an SEO
health analyzer, and a Payload-native administration workspace. Advanced modules, external
integrations, and background services are disabled by default.

The published package name is currently `@consilioweb/payload-seo-analyzer`. The legacy
`seoAnalyzerPlugin` name remains available; `seoPlugin` is the concise alias used below.

## Features

- Collection-aware public URL and canonical resolution
- Access-aware sitemap and public SEO output
- Technical SEO policy for indexation, robots, sitemap, and structured data
- Deterministic, network-independent SEO health analysis
- Payload Admin configuration and document sidebar
- Optional redirects, link graph, schema builder, audits, and discovery outputs
- Optional Anthropic, Google Search Console, PageSpeed, and IndexNow integrations
- Explicit, opt-in cache, rank-tracking, alerts, and retention services

## Installation

```bash
pnpm add @consilioweb/payload-seo-analyzer
```

Payload and the Admin UI peers used by your application must satisfy the ranges in `package.json`:
Payload 3.79.1–3.x, Node `^20.19.0 || >=22.12.0`, React 18/19, and Next.js 15.2/16 where those
optional peers are used.

## Quickstart

```ts
// payload.config.ts
import { buildConfig } from 'payload'
import { seoPlugin } from '@consilioweb/payload-seo-analyzer'

export default buildConfig({
  collections: [Pages, Posts, Media, Users],
  plugins: [
    seoPlugin({
      collections: ['pages', 'posts'],
    }),
  ],
})
```

This core-only setup starts no timers, makes no external requests, requires no provider credentials,
and creates only the core `seo-settings` storage. Target collections receive analyzer fields and,
unless compatible `meta` fields already exist, title/description/image fields.

After generating Payload's import map, open `/admin/seo-overview`. Verify the public outputs at:

```text
/api/seo-plugin/sitemap.xml
/api/seo-plugin/robots.txt
```

Set `siteUrl` when absolute public URLs are required:

```ts
seoPlugin({
  collections: ['pages', 'posts'],
  siteUrl: 'https://example.com',
})
```

## Optional capabilities

```ts
seoPlugin({
  collections: ['pages', 'posts'],
  collectionRoutes: { posts: 'blog' },
  modules: {
    redirects: true,
    advancedSchema: true,
    linkGraph: true,
  },
  integrations: {
    ai: true,
  },
  backgroundServices: {
    warmCache: true,
  },
})
```

Capability IDs are typed. Unknown IDs and invalid dependencies fail during plugin configuration.
Disabled capabilities register no endpoints, views, hooks, storage, jobs, or provider behavior.

Detailed documentation:

- [Configuration](docs/configuration.md)
- [Routing and site origin](docs/routing.md)
- [Optional modules](docs/modules.md)
- [External integrations](docs/integrations.md)
- [Background services](docs/background-services.md)
- [Security architecture](docs/security.md)
- [Legacy migration](docs/migration.md)
- [Development and packaging](docs/development.md)
- [Public API surfaces](docs/public-api.md)

## Official Payload SEO compatibility

The plugin works standalone. If a target collection already contains a compatible `meta` group or
tab with `title` and `description` fields—such as one created by `@payloadcms/plugin-seo`—it reuses
that structure and does not create a duplicate meta group. Image, canonical, noindex, nofollow, and
robots fields are detected structurally where present. Install/order the official plugin so its
fields are present before this plugin transforms the collection.

Compatibility is structural and does not require `@payloadcms/plugin-seo` as a dependency. See the
[configuration reference](docs/configuration.md#official-payload-seo-compatibility) for tested limits.

## Package exports

- `@consilioweb/payload-seo-analyzer`: server/plugin APIs, pure core APIs, and public types
- `@consilioweb/payload-seo-analyzer/client`: browser-safe Admin components
- `@consilioweb/payload-seo-analyzer/views`: Payload Admin server-view wrappers

Do not import files from `dist/`, `src/`, or undocumented internal paths.

## Security

Caller-triggered reads respect Payload ACLs. Public SEO output uses anonymous-access eligibility.
AI authorization occurs before document extraction and provider calls. External URL checks use the
hardened, address-pinned transport and revalidate redirects. Credentials remain server-only.

Enabling an integration changes the data boundary. User-invoked AI operations may send authorized
document metadata/content or image bytes to Anthropic for the requested operation. See
[security.md](docs/security.md) and [integrations.md](docs/integrations.md).

## Migration

The legacy `features` object remains supported but opts into historical default-on behavior and
emits one deprecation warning per process. New installations should use `modules`, `integrations`,
and `backgroundServices`. See [migration.md](docs/migration.md).

## Development

See [development.md](docs/development.md). The package has no install lifecycle script and does not
rewrite consumer projects during installation. It no longer publishes the inherited destructive
uninstall binary; remove the plugin call and dependency explicitly under normal source-control review.

## License

MIT. See [LICENSE](LICENSE). The license notice is shipped in the package and must be preserved as
required by its text.
