# Optional modules

All modules default to disabled and require an application restart. Modules are local capabilities;
only `externalLinks` performs network requests, through the hardened outbound transport.

| ID | Purpose | Storage / endpoint / Admin surface | Dependencies |
|---|---|---|---|
| `redirects` | Redirect management and slug-change redirects | `seo-redirects`; redirect CRUD/chains; Redirect Manager; collection hook | none |
| `advancedSchema` | Custom/per-document schema workflow | schema-generator endpoint; Schema Builder | none |
| `linkGraph` | Site link graph | link-graph endpoint and view | none |
| `cannibalization` | Keyword/content overlap diagnostics | cannibalization endpoint and view | none |
| `keywordResearch` | Local keyword research tooling | keyword-research endpoint and view | none |
| `performance` | Performance data storage/presentation | `seo-performance`; performance endpoint and view | none |
| `duplicateContent` | On-demand duplicate-content diagnostics | duplicate-content endpoint | none |
| `externalLinks` | On-demand external link validation | external-links endpoint; outbound HTTP when invoked | none |
| `sitemapAudit` | Sitemap diagnostics | sitemap-audit/config endpoints and view | none |
| `scoreHistory` | Store scores after document changes | `seo-score-history`; history endpoint; save hook | none |
| `seoLogs` | Bounded 404/request diagnostics | `seo-logs` and log endpoints | none |
| `specializedSitemaps` | News, image, and video sitemap endpoints | three public endpoints | none |
| `llmsTxt` | Optional public `llms.txt` output | public endpoint; also requires `SEO_LLMS_TXT=1` | none |

Example:

```ts
seoPlugin({
  collections: ['pages', 'posts'],
  modules: {
    redirects: true,
    sitemapAudit: true,
    specializedSitemaps: true,
  },
})
```

Specialized public output continues to use anonymous Payload access, public eligibility, technical
SEO policy, and the canonical URL resolver.

