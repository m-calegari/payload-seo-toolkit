# Migration to explicit capabilities

The inherited `features` object remains accepted in M7, but it is deprecated. Its presence opts into
historical defaults, where many advanced capabilities were enabled. A stable warning is emitted once
per process:

```text
[seo-analyzer] `features` is deprecated; use `modules`, `integrations`, and `backgroundServices`.
```

Do not mechanically enable everything. Select what the deployment actually uses.

```ts
// Before
seoPlugin({
  collections: ['pages', 'posts'],
  features: { redirects: true, aiFeatures: false, warmCache: false },
})

// After
seoPlugin({
  collections: ['pages', 'posts'],
  modules: { redirects: true },
})
```

Common mappings:

| Legacy flag | Replacement |
|---|---|
| `redirects` | `modules.redirects` |
| `schemaBuilder` | `modules.advancedSchema` |
| `linkGraph` | `modules.linkGraph` |
| `performance` | `modules.performance` plus `integrations.pageSpeed` for Core Web Vitals |
| `aiFeatures` | `integrations.ai` |
| `gscApi` | `integrations.googleSearchConsole`; add `backgroundServices.rankTracking` if desired |
| `indexNow` | `integrations.indexNow` |
| `warmCache` | `backgroundServices.warmCache` |
| `alerts` | `backgroundServices.alerts` |

Specialized sitemaps and `llms.txt` now require `modules.specializedSitemaps` and `modules.llmsTxt`.
Score history, SEO logs, sitemap audit, external links, duplicate content, keyword research, and
cannibalization are also explicit modules.

`retentionDays` remains a compatibility activation for retention; prefer also declaring
`backgroundServices.retention: true` for clarity. In-process schedulers do not coordinate across
multiple application instances.

The aliases `seoAnalyzerPlugin` and `seoPlugin` are both retained. The inherited uninstall binary is
no longer published because it rewrote consumer source files; remove configuration and the dependency
through normal reviewed changes.

