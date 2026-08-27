# ADR-0001: Static catalog with Supabase data and Cloudflare Pages delivery

## Status

Accepted

## Date

2026-08-27

## Context

Agent Avatars needs a fast public catalog of at least 500 pre-generated avatar
assets, searchable trait metadata, stable asset links, and three per-avatar
actions. Signed-in users also need private favorites and ordered Agent Teams.
The project should start at approximately $0/month, support parallel frontend,
backend, platform, and QA work, and reserve DNS, production access, and spend for
an explicit owner-approved launch gate.

The catalog is read-heavy and changes only when a reviewed generation input
changes. The private data is small and relational. There is no MVP requirement
for server rendering, server-side business logic, user uploads, shared teams, or
runtime avatar generation.

## Decision

### Frontend and public catalog

Build a TypeScript React single-page application with Vite on Node.js 24 LTS.
The browser loads a generated, versioned JSON manifest and immutable image assets
from the same origin. Search and selected tag keys are encoded in the URL query
string. The catalog remains fully usable without an account or Supabase session.

Generate assets through the build-time registry in ADR-0002. DiceBear 10 is the
first adapter, not a catalog-level dependency. Published bytes produce a
content-addressed ID, while the manifest carries generator-neutral rights and
provenance references. Assets are never generated through a runtime HTTP service
in the MVP; metadata-only corrections may keep the ID.

### Data and authentication boundary

Use Supabase Auth and Postgres. The React app uses `supabase-js` directly with a
public publishable key. The browser never receives a secret or service-role key.
Postgres is the authorization boundary: grants and row-level security allow
public reads of catalog identity and restrict profiles, favorites, teams, and
team membership to the authenticated owner.

Static assets and the generated manifest are the display source of truth.
Postgres receives the same stable avatar IDs so foreign keys protect favorites
and team membership. Catalog synchronization is a privileged migration/seed
operation, not a browser operation. Multi-row team reorder is one transactional
database function so clients cannot expose a partially reordered team.

### Delivery

Build to `dist/` and deploy the static output to Cloudflare Pages. Preview
deployments use their own Pages URL and public Supabase development project.
Production uses `https://agent-avatars.dev`; binding the apex requires the zone
and nameserver/DNS work described by Cloudflare and remains a separate approval.

No Pages Functions or custom application API are required for the MVP. A static
SPA fallback serves the application routes, while `/avatars/*` remains ordinary
cacheable static content. Cloudflare's injected `CF_PAGES_URL` supplies preview
origin context to the build wrapper; production overrides the public site origin
with the canonical domain.

### Quality boundary

Vitest and Testing Library cover pure logic and components, pgTAP/Supabase CLI
cover constraints and RLS, and Playwright covers critical browser flows.
Formatting, lint, type-check, unit/component tests, database tests, and a
production build are required pull-request gates. The independent Stage 4 gate
adds cross-browser, accessibility, performance, privacy, and security evidence.

## Module boundaries and dependency direction

| Module | Owns | May depend on |
|---|---|---|
| `shared-scaffold` | root package/lockfile and Vite/TypeScript/test command configuration | approved contracts only |
| `avatar-catalog` | generator registry/adapters, rights/provenance, manifest, image assets, public browsing/actions | `shared-scaffold` |
| `identity-data` | Supabase migrations, Auth integration primitives, RLS, catalog-ID sync, typed data client | `shared-scaffold` |
| `delivery` | CI, build contract, preview Pages configuration and runbook | `shared-scaffold` |
| `authenticated-ui` | session UI, favorites, Agent Teams | `avatar-catalog`, `identity-data`, `delivery` |
| `release-gate` | independent functional, accessibility, performance, privacy, and security evidence | all product modules on a preview |

Dependencies point one way. In particular, `avatar-catalog` does not import the
authenticated client, and private data stores avatar IDs rather than copies of
manifest records. BD-12 owns the first `shared-scaffold` commit; BD-13 and BD-14
base their Stage 2 work on it, after which the three foundations proceed in
parallel. Shared command/config changes return to the scaffold owner and
Engineering Lead instead of being independently redefined.

## Alternatives considered

### Server-rendered React framework

Rejected for the MVP. The public data is generated and static, while authenticated
operations can be authorized by Supabase RLS. A server runtime would add deploy,
cache, and secret-management work without satisfying an accepted requirement.

### Runtime avatar generation or third-party avatar URLs

Rejected. It would make availability, performance, canonical links, generator
upgrades, and rights/provenance evidence dependent on a runtime service.
Pre-generation makes output reviewable, cacheable, reproducible, and deployable
with the app.
Future AI providers may be called only by approved offline/build tooling that
materializes reviewed assets before deployment, as defined in ADR-0002.

### Custom REST API or Cloudflare Pages Functions

Rejected for the MVP. It would duplicate authorization already enforced by
Postgres RLS. A future privileged or cross-user workflow can add a narrowly
scoped server boundary through a new ADR.

### Browser-only local storage for favorites and teams

Rejected because the accepted product requires accounts and durable data across
sessions/devices, with enforceable user isolation.

### Non-Cloudflare static hosting

Viable but not selected. Cloudflare Pages provides branch previews, static asset
delivery, and an approved path for the registered apex domain within the planned
free-tier envelope.

## Consequences

- Public catalog availability does not depend on Supabase availability.
- Frontend, backend, and platform work can proceed independently from the
  contracts in `docs/contracts/mvp-contracts.md`.
- RLS and least-privilege grants are release requirements, not optional defense.
- Generator engine/model/style upgrades are reviewed content changes because they
  can change IDs, output, usage rights, or provenance.
- Preview builds must use development Supabase resources; production credentials,
  DNS, and custom-domain changes remain launch-gated.
- If later requirements need secrets, privileged integration, shared teams, or
  server rendering, create a new ADR rather than quietly adding a runtime.

## References

- [Approved implementation plan](../../tasks/plan.md)
- [ADR-0002: Generator adapters and provenance](0002-generator-adapters-and-provenance.md)
- [Vite getting started](https://vite.dev/guide/)
- [DiceBear licenses](https://www.dicebear.com/licenses/)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Cloudflare Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Cloudflare Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
