# Agent Avatars

A searchable library of deterministic, pre-generated agent avatars. The MVP
adds public download/open/copy actions, Supabase-backed accounts and favorites,
and user-owned Agent Teams, delivered as a React/Vite application on Cloudflare
Pages.

## Architecture baseline

Implementation starts from these approved documents:

- [`tasks/plan.md`](tasks/plan.md) — staged delivery plan and ownership
- [`docs/specs/mvp.md`](docs/specs/mvp.md) — product and engineering specification
- [`docs/decisions/0001-mvp-architecture.md`](docs/decisions/0001-mvp-architecture.md) — architecture decision record
- [`docs/decisions/0002-generator-adapters-and-provenance.md`](docs/decisions/0002-generator-adapters-and-provenance.md) — multi-generator and AI-ready boundary
- [`docs/decisions/0003-composable-avatar-part-packs.md`](docs/decisions/0003-composable-avatar-part-packs.md) — deterministic mix-and-match part packs
- [`docs/contracts/mvp-contracts.md`](docs/contracts/mvp-contracts.md) — avatar, data, client, environment, and licensing contracts
- [`docs/acceptance-test-matrix.md`](docs/acceptance-test-matrix.md) — executable release requirements

Local composable-part imports and preview generation are documented in
[`docs/avatar-parts.md`](docs/avatar-parts.md). Source-derived packs remain
outside the public catalog until their rights evidence is approved.

Stage 2 modules share the repository-root tooling. Documentation integrity can
always be checked with:

```sh
git diff --check
```

## Identity data development

The Supabase identity foundation is under `supabase/`; its browser-safe typed
entry point is `src/lib/supabase/index.ts`. Local database verification requires
Docker and the pinned Node/npm versions:

```sh
npm ci --ignore-scripts
npx supabase start
npm run test:db
npm run check:database-types
```

Copy `.env.example` to an ignored local environment file and replace only the
local public publishable key. Never place a service-role key or database secret
in a `VITE_*` variable.
