# Development and release preparation

Supported toolchain: Node `^20.19.0 || >=22.12.0` and pnpm 11.25.0.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
npm pack --dry-run
```

The build emits ESM, CommonJS, and declarations for the root, client, and views entries, then verifies
all relative imports in `dist/`. No install lifecycle scripts run in consumer projects.

Do not run the E2E setup unless browser installation and the dedicated test harness are intended. Do
not run the historical `scripts/uninstall.mjs`; it is excluded from publication and rewrites source.

## Versioning

This project follows semantic-versioning intent:

- Removing/renaming public exports or changing configuration defaults/contracts is breaking.
- A new disabled-by-default module or integration is additive.
- Security and correctness fixes that preserve supported contracts are patches.
- Deprecations retain compatibility for an announced period and emit bounded, actionable warnings.

## Maintainer release checklist

1. Resolve package/repository identity and choose a version.
2. Run the validation and package dry-run above.
3. Inspect the tarball file list and consumer smoke test.
4. Update `CHANGELOG.md`'s Unreleased section.
5. Let the release owner perform Git, tag, registry, and publication operations separately.

`prepublishOnly` validates typecheck, tests, and build. It performs no Git operation and does not
rewrite a consumer project. This documentation does not authorize publication.
