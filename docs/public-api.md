# Public API surfaces

## Root export

Recommended supported groups:

- `seoPlugin`, `seoAnalyzerPlugin`, `SeoPluginConfig`, and capability ID/status types
- `analyzeSeo`, `analyzeSeoHealth`, analyzer inputs/results, and health categories
- Site Model, route, canonical, and document URL resolver APIs
- Technical SEO, robots, sitemap-policy, schema, and metadata builders/types
- `seoFields`, `metaFields`, and documented extraction helpers/constants
- Build-time audit and explicit retention helpers for hosts that schedule those operations themselves

Several endpoint creators, collection factories, and score-history hooks remain exported for existing
consumers. They are classified as **legacy compatibility**, not recommended extension points. New code
should not build against raw endpoint handlers, storage factories, plugin registrars, provider
adapters, or background-service internals.

## Client export

`./client` is the Payload import-map surface for browser-safe React components. It contains Admin
views, fields, previews, navigation, and error-boundary components. It must not import Payload local
API, Node networking, filesystem, crypto, provider adapters, credentials, or schedulers.

## Views export

`./views` contains the Payload Admin server-view wrappers for the supported routes. These wrappers
bridge to the client components without importing optional providers or background services.

Only the three paths declared in `package.json#exports` are supported. Deep imports from `dist` or
`src` are internal even when a file is present in a development checkout.
