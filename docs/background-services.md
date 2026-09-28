# Background services

Background services are disabled by default and run inside the Payload server process.

```ts
seoPlugin({
  collections: ['pages', 'posts'],
  integrations: { googleSearchConsole: true },
  backgroundServices: {
    warmCache: true,
    rankTracking: true,
    alerts: true,
    retention: true,
  },
  retentionDays: {
    'seo-rank-history': 365,
    'seo-score-history': 180,
    'seo-performance': 400,
    'seo-logs': 90,
  },
})
```

| ID | Cadence and effects | Dependency |
|---|---|---|
| `warmCache` | Small Payload reads 10 seconds after initialization and hourly. | none |
| `rankTracking` | GSC snapshot after 30 seconds and every 24 hours. | `googleSearchConsole` |
| `alerts` | Digest after 60 seconds and every `SEO_ALERT_INTERVAL_HOURS` (minimum 1, default 24); may send webhook/email. | delivery config optional |
| `retention` | Purges configured time-series rows after 5 minutes and every 24 hours. | valid `retentionDays` |

Starts are idempotent within one process: reinitialization clears prior startup/interval timers before
creating replacements, and every service has a stop operation. Payload configuration does not provide
a distributed coordinator, so multiple server instances may each run a service. Use a host scheduler
or future worker adapter when distributed exactly-once execution is required.

Retention is destructive and only applies to explicitly named supported collections with a finite
window of at least one day. A zero/invalid window is ignored. `retentionDays` remains a compatibility
activation, but declaring `backgroundServices.retention` makes intent explicit.
