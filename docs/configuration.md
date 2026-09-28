# Configuration reference

All options are passed to `seoPlugin()` and require an application restart because they shape the
Payload configuration. Runtime technical SEO policy is edited through the `seo-settings` Admin UI.

## Core options

| Option | Type | Default | Runtime effect |
|---|---|---|---|
| `collections` | `string[]` | `['pages', 'posts']` | Adds core SEO fields and includes collections in policy/output discovery. |
| `globals` | `string[]` | `[]` | Adds SEO fields to selected globals. |
| `siteUrl` | `string` | environment precedence | Supplies the absolute HTTP(S) site origin. |
| `collectionRoutes` | `Record<string, string>` | `{ posts: 'posts' }` | Maps collection identity to its public route. |
| `uploadsCollection` | `string` | `'media'` | Relationship target for SEO images. |
| `endpointBasePath` | `string` | `'/seo-plugin'` | Payload API endpoint prefix. Keep the default for existing Admin clients. |
| `autoCreateMetaFields` | `boolean` | `true` | Creates compatible `meta` fields when none exist. |
| `locale` | `'fr' \| 'en'` | `'fr'` | Default analysis language. |
| `localeMapping` | record | — | Maps Payload locales to supported analysis languages. |
| `siteName` | `string` | — | Site identity and analyzer context. |
| `tabbedUI` | `boolean` | `false` | Places injected fields in Content/SEO tabs. |

Analyzer configuration includes `disabledRules`, `overrideWeights`, `thresholds`, and
`localSeoSlugs`. Generator callbacks (`generateTitle`, `generateDescription`, `generateImage`, and
`generateURL`) execute on the server and receive the caller request.

## Capability configuration

Every optional capability defaults to `false`:

```ts
seoPlugin({
  collections: ['pages', 'posts'],
  modules: { redirects: true, linkGraph: true },
  integrations: { ai: true },
  backgroundServices: { warmCache: true },
})
```

See [modules.md](modules.md) and [integrations.md](integrations.md). `features` is deprecated; see
[migration.md](migration.md).

## Collection assumptions

- A configured collection slug must exist in the host Payload configuration.
- A `slug` value is optional at the type boundary, but public document URLs require a usable slug or
  root/home identity. `home` and an empty slug resolve to the collection root.
- Draft/version state is used when present. Public output also requires anonymous read access;
  publication state alone does not grant public eligibility.
- `title`, content, Lexical data, headings, links, and images are optional analyzer inputs. Missing
  optional content produces applicable findings rather than a schema requirement.
- The upload collection is configurable through `uploadsCollection`.
- Existing `meta` structures are auto-detected. Custom field extraction can use the existing
  callbacks and document adapters; the plugin does not require every collection to share one content
  schema.

## Official Payload SEO compatibility

Standalone mode creates a `meta` group containing title, description, image, and preview fields.

Compatibility mode detects a `meta` group or named `meta` tab. When both `title` and `description`
exist, automatic meta-field creation is skipped, preventing a duplicate group. Detection also
recognizes `image`, `canonical`/`canonicalUrl`, `noindex`, `nofollow`, and `robots` when present.

This is structural compatibility only:

- `@payloadcms/plugin-seo` is not installed or imported by this package.
- Arrange plugin order so the official fields exist before this plugin inspects the collection.
- Custom shapes outside the detected group/tab contract are not claimed as compatible.
- Analyzer-specific fields are still added.

```ts
import { seoPlugin as officialSeoPlugin } from '@payloadcms/plugin-seo'
import { seoPlugin as seoToolkit } from '@consilioweb/payload-seo-analyzer'

plugins: [
  officialSeoPlugin({ collections: ['pages', 'posts'] }),
  seoToolkit({ collections: ['pages', 'posts'] }),
]
```

## Boot versus Admin settings

Collection registration, routes, endpoint prefix, enabled capabilities, provider enablement, and
background services are boot configuration. Indexation, sitemap policy, robots rules, and supported
schema defaults for already configured collections are Admin-editable `seo-settings` state.

## Environment variables

Public supported runtime configuration:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SERVER_URL`, `PAYLOAD_PUBLIC_SERVER_URL`, `SERVER_URL` | Site-origin fallbacks, in precedence order. |
| `ANTHROPIC_API_KEY`, `SEO_AI_MODEL`, `SEO_MEDIA_ORIGIN` | Anthropic credential/model and trusted media origin. |
| `GSC_OAUTH_CLIENT_ID`, `GSC_OAUTH_CLIENT_SECRET`, `SEO_GSC_ENCRYPTION_KEY` | GSC OAuth and token encryption. |
| `PAGESPEED_API_KEY`, `GOOGLE_PAGESPEED_API_KEY` | PageSpeed API key and compatibility alias. |
| `SEO_INDEXNOW_KEY` | IndexNow verification/submission key. |
| `SEO_ALERT_WEBHOOK_URL`, `SEO_ALERT_EMAIL` | Alert delivery destinations. |
| `SEO_ALERT_INTERVAL_HOURS`, `SEO_ALERT_WINDOW_HOURS` | Alert cadence and lookback window. |
| `SEO_ALERT_SCORE_DROP`, `SEO_ALERT_POSITION_DROP` | Alert thresholds. |
| `SEO_ADMIN_USER_COLLECTIONS`, `SEO_REQUIRE_ADMIN_ROLE` | Host authorization compatibility controls. |
| `SEO_FETCH_MAX_DOCS`, `SEO_SITEMAP_MAX_DOCS`, `SEO_SITEMAP_BATCH_SIZE` | Collection/sitemap bounds. |
| `SEO_LOGS_MAX_ROWS` | Bound for SEO log retrieval/storage behavior. |
| `SEO_LLMS_TXT` | Must be `1` in addition to enabling the `llmsTxt` module. |
| `SEO_AUDIT_BATCH_SIZE`, `SEO_AUDIT_MAX_DOCS`, `SEO_AUDIT_DEPTH` | Audit resource bounds. |
| `SEO_AUDIT_BATCH_DELAY_MS`, `SEO_AUDIT_DOC_DELAY_MS`, `SEO_AUDIT_THROTTLE_RATIO` | Audit throttling. |
| `SEO_AUDIT_MIN_REFRESH_MS`, `SEO_AUDIT_FILE_CACHE`, `SEO_AUDIT_TRUST_FILE` | Audit cache behavior. |

`SEO_STRICT_READ_ACCESS` is a legacy/test-only name and no longer changes behavior: caller-scoped
reads are always access-respecting. `BASE_URL`, `CI`, `DATABASE_URI`, `PAYLOAD_SECRET`,
`E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, and `PW_CHANNEL` belong to test/development harnesses, not
the package runtime. `INIT_CWD` is used only by the unpublished legacy uninstall script.
