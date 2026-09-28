# Routing and site identity

Public URLs are resolved from collection identity plus document slug; a bare slug is never the
identity.

```ts
seoPlugin({
  collections: ['pages', 'posts', 'projects'],
  siteUrl: 'https://example.com/',
  collectionRoutes: {
    pages: '',
    posts: 'blog',
    projects: 'work',
  },
})
```

This resolves `posts/example` to `/blog/example` and `projects/example` to `/work/example`, avoiding
same-slug collisions. Route values are normalized without surrounding or duplicate slashes. A slug
that already contains its configured route prefix is not double-prefixed. Empty and `home` slugs
represent the collection root. The current locale strategy preserves locale-neutral URLs; locale is
carried in document identity for future routing strategies.

The route map affects canonical URLs, document sitemap locations, Open Graph identity, JSON-LD,
IndexNow, `llms.txt`, breadcrumbs, previews, and GSC document matching.

## Site-origin precedence

The first valid HTTP(S) origin wins:

1. `siteUrl`
2. `NEXT_PUBLIC_SERVER_URL`
3. `PAYLOAD_PUBLIC_SERVER_URL`
4. `SERVER_URL`

Credentials in origins and non-HTTP schemes are rejected. Origins are normalized without a trailing
slash or path. When no valid origin exists, relative paths can still resolve, but absolute canonical,
site identity, sitemap advertisement, and integration behavior that requires an origin fail safely or
report unavailable configuration. Site origin is boot configuration, not runtime-editable Admin state.

