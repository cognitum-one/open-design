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
