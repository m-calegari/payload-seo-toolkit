# Security architecture

## Access boundaries

- Caller-triggered document reads use the caller's Payload user and do not elevate access by default.
- Public sitemap and discovery output use anonymous collection access plus draft/noindex eligibility.
- Admin UI visibility is not authorization; settings mutations enforce administrator access server-side.
- AI endpoints authenticate and authorize document access before extracting provider-bound data.

## External requests

The shared outbound transport accepts HTTP(S) only, rejects userinfo and private/reserved addresses,
resolves and validates destinations before connecting, pins the connection to validated addresses,
preserves Host/SNI, manually bounds redirects, and revalidates each redirect. TLS verification remains
enabled. Response time and consumed-body size are bounded where applicable.

External-link checks and AI image retrieval use this transport. Provider API calls use fixed provider
destinations. Enabling network capabilities may require outbound firewall allowances.

## Credentials

API keys, OAuth secrets, encryption keys, and tokens remain in server environment/storage. GSC tokens
are encrypted at rest; set a stable `SEO_GSC_ENCRYPTION_KEY` in production. Capability and health
contracts expose only booleans and safe issue descriptions. Provider bodies, prompts, document
excerpts, and image bytes are not written to provider-error logs.

## Redirects

Cross-origin redirect destinations are disabled unless `allowExternalRedirects: true`. URL schemes
and destinations are validated server-side. Enabling external redirects is a deliberate phishing and
origin-trust decision for the host application.

## Operational responsibility

Configure a valid site origin, protect environment variables, review target-collection access rules,
and apply rate limiting/reverse-proxy controls appropriate to deployment. Background services are
in-process and idempotent within one process, but provide no distributed exactly-once guarantee.

