# Contributing

Thank you for contributing. The canonical repository URL for this fork has not yet been recorded in
package metadata, so this document deliberately does not direct contributors to the inherited
upstream issue tracker.

## Setup and validation

Use Node `^20.19.0 || >=22.12.0` and pnpm 11.25.0.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
npm pack --dry-run
```

The build produces ESM, CommonJS, and declaration outputs for the root, client, and views entrypoints.
The final build step verifies emitted relative imports.

## Architecture

```text
src/core/          framework-independent URL, policy, security, and analyzer logic
src/modules/       local SEO capabilities
src/integrations/  external provider boundaries
src/payload/       Payload-specific adapters
src/plugin/        configuration, capability registry, and composition
src/components/    browser-side Payload Admin components
src/views/         Payload Admin server-view wrappers
```

- Keep core independent of Payload runtime, React, network providers, and schedulers.
- Keep optional capability ownership explicit.
- Do not add runtime dependencies without a demonstrated need.
- Preserve server/client separation and the security regression suite.
- Add focused tests for behavior or public contracts changed.

Do not run `scripts/uninstall.mjs`; it is a retained, unpublished historical artifact that rewrites
source files. Release publication, Git tags, and repository writes are handled separately by the
release owner.

Contributions are licensed under the repository's MIT license.
