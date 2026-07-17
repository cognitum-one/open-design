# 0002. Integrate Cognitum Meta-LLM through daemon-owned Meta-Proxy OAuth

## Status

Accepted

## Context

Cognitum Media Factory needs the Open Design authoring experience while routing
agent inference through the multi-tenant Meta-LLM service on GCP. Cognitum
Identity and Meta-Proxy already own OAuth 2.1 Authorization Code + PKCE, refresh
rotation, and cloud data-plane selection. Reimplementing that flow in the web UI
would create a second token store and expose provider credentials to browser
state. Treating Meta-LLM as generic BYOK would have the same flaw and would not
provide a coherent Cognitum sign-in, tenant status, or CLI lifecycle.

## Decision

Add a native `cognitum-meta-llm` runtime and a daemon-owned Cognitum integration.

- The daemon launches Meta-Proxy's browser OAuth command and polls only its
  redacted `auth-status --json` contract.
- Meta-Proxy remains the sole owner of OAuth access/refresh tokens and its local
  proxy credential. Open Design does not persist or return them.
- For a run, the daemon builds an ephemeral OpenAI-compatible provider config
  targeting Meta-Proxy's loopback `/v1` endpoint and injects it only into the
  OpenCode child process.
- The web, daemon HTTP API, and `od cognitum` CLI expose equivalent login, status,
  and logout capabilities.
- The runtime advertises only Cognitum's governed aliases and defaults to
  `cognitum-auto`.
- Meta-LLM derives tenancy from the verified Cognitum credential. The authenticated
  `/v1/whoami` bridge is display/diagnostic data only; no browser-provided tenant
  value participates in authorization, routing, metering, or storage.
- Generic upstream Open Design keeps its existing cloud onboarding and copy. The
  Cognitum behavior is gated by the `cognitum-media-factory` distribution profile.

## Consequences

Users get one Cognitum sign-in across Media Factory, Meta-Proxy, and Meta-LLM,
with automatic refresh and explicit cloud routing. Credentials stay behind the
daemon boundary, and every model request retains Meta-LLM's tenant-isolated
metering and learning behavior. The desktop/container distribution must bundle a
compatible Meta-Proxy binary and keep its loopback service reachable by the
daemon. A browser-only static deployment cannot provide this runtime by itself.
