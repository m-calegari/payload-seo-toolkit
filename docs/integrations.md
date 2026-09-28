# External integrations

All integrations are disabled by default. Credentials belong in server environment variables and
are never returned through settings, health, Admin props, or logs.

## AI / Anthropic

```ts
seoPlugin({ collections: ['pages', 'posts'], integrations: { ai: true } })
```

Set `ANTHROPIC_API_KEY`; optionally set `SEO_AI_MODEL`. Requests go to Anthropic's Messages API.
Depending on the user-invoked operation, the provider may receive authorized document title,
description, extracted content, focus-keyword context, or image data needed for alt text. The endpoint
authenticates the user and verifies document read access before extraction or provider invocation.
Missing credentials mark the integration unavailable; normal analyzer behavior remains local.

`SEO_MEDIA_ORIGIN` can add one trusted image origin for alt-text retrieval. Redirects and every
destination remain protected by the hardened outbound request policy.

## Google Search Console

```ts
seoPlugin({
  collections: ['pages', 'posts'],
  siteUrl: 'https://example.com',
  integrations: { googleSearchConsole: true },
})
```

Set `GSC_OAUTH_CLIENT_ID`, `GSC_OAUTH_CLIENT_SECRET`, and preferably
`SEO_GSC_ENCRYPTION_KEY`. GSC owns OAuth endpoints, encrypted token storage (`seo-gsc-auth`), rank
history storage, query/page data, CTR opportunities, and content-grade endpoints. OAuth exchanges and
Search Console API requests send the normal OAuth credentials/token plus the configured site identity
and requested Search Console query parameters. Tokens never enter client contracts.

## PageSpeed

PageSpeed depends on the local Performance module:

```ts
seoPlugin({
  collections: ['pages'],
  modules: { performance: true },
  integrations: { pageSpeed: true },
})
```

`PAGESPEED_API_KEY` is supported; `GOOGLE_PAGESPEED_API_KEY` is a compatibility alias. The on-demand
request sends the analyzed public URL to Google PageSpeed Insights. Missing data never breaks core
analysis.

## IndexNow

```ts
seoPlugin({ collections: ['pages'], integrations: { indexNow: true } })
```

Set `SEO_INDEXNOW_KEY`. IndexNow owns its verification/submit endpoints and a publication hook. It
sends M2-resolved, publicly eligible document URLs and the key to the IndexNow endpoint. No hook or
submission exists while disabled.

## Failure behavior

Enabled integrations with missing credentials appear as unavailable in capability status without
exposing values. Provider errors are reduced to safe status/category information. Core SEO remains
usable without any integration.

