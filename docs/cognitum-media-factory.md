# Cognitum Media Factory distribution

This repository is the embedded authoring engine used by Cognitum Media Factory.
Internal package names and protocol identifiers remain `open-design` for upstream
compatibility; users see the Media Factory product identity.

## Web profile

Run the branded studio with:

```bash
pnpm --filter @open-design/web dev:media-factory
pnpm --filter @open-design/web build:media-factory
```

The profile in `apps/web/.env.cognitum-media-factory` sets the product name,
tagline, Cognitum cyan/green palette, and dark website visual language. The same
generic `NEXT_PUBLIC_OD_*` contract can render tenant-specific names and palettes
at build time without changing authoring APIs.

## Service identity

Media Factory deployments set these runtime values on the daemon:

```dotenv
OD_DISTRIBUTION_ID=cognitum-media-factory
OD_PRODUCT_NAME=Cognitum Media Factory
OD_BRAND_PROFILE=cognitum-media-factory
```

`GET /api/health` publishes this non-secret identity. The Media Factory Design
Gateway verifies it before creating projects, preventing an unapproved upstream
or mismatched fork from being used accidentally.

Open Design remains the engine identifier in source-package provenance. Cognitum
Media Factory remains the product, tenant boundary, model-routing authority, and
publication boundary.

## Meta-LLM and Cognitum OAuth

The Cognitum profile includes a native `cognitum-meta-llm` runtime with four
governed model aliases: `cognitum-auto`, `cognitum-low`, `cognitum-mid`, and
`cognitum-high`. It uses the OpenCode agent adapter, but provider configuration is
assembled only for the spawned daemon-side process.

The trust boundary is deliberate:

1. The web UI calls `/api/cognitum/login` on the Open Design daemon.
2. The daemon launches `meta-proxy login --browser --cloud`.
3. Meta-Proxy performs OAuth 2.1 Authorization Code + PKCE against Cognitum
   Identity, persists/refreshes its own tokens, and exposes a loopback-only API.
4. The daemon reads Meta-Proxy's local client token and injects it into the
   OpenCode child process. It returns only redacted status to the web UI.
5. Meta-Proxy forwards the OAuth access token to Meta-LLM on GCP. Meta-LLM
   verifies the token against Cognitum JWKS and derives `account_id` from the
   signed claim.

`GET /api/cognitum/status` may include an abbreviated tenant label obtained
through the authenticated Meta-Proxy `/v1/whoami` bridge. It never includes an
OAuth token, refresh token, proxy client token, API key, or full provider config.

The same lifecycle is available without the web UI:

```bash
od cognitum login
od cognitum status --json
od cognitum logout
```

Deployment variables:

```dotenv
COGNITUM_META_PROXY_BIN=/usr/local/bin/meta-proxy
COGNITUM_META_PROXY_URL=http://127.0.0.1:11435
# Optional: shared state location for a managed desktop/container deployment.
RUFLO_STATE_DIR=/var/lib/cognitum/meta-proxy
```

The daemon and Meta-Proxy must share the state directory. Never publish the
loopback proxy port through a GCP load balancer; only the Meta-LLM and Identity
services are public cloud services.
