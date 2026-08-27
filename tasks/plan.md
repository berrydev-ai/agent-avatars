# Implementation Plan: Agent Avatars MVP

## Overview

Build a public, searchable library of pre-generated SVG avatars at `agent-avatars.dev`. Visitors can filter by descriptive tags, download an avatar, open its canonical asset URL, or copy that URL. Signed-in users can save favorites and organize selected avatars into named Agent Teams.

The repository currently contains only a README and license. This plan therefore starts with contracts and project scaffolding, delivers public and authenticated vertical slices in parallel where safe, and places production deployment behind an explicit owner approval gate.

## Proposed Architecture

- **Frontend:** React, TypeScript, and Vite as a static single-page application. Use accessible semantic components, responsive CSS, lazy-loaded images, and URL-backed search/filter state.
- **Avatar generation:** Pin DiceBear packages and generate SVGs plus a typed JSON manifest during development/build tooling. Start with CC0 styles to minimize attribution complexity, while retaining a license inventory for every included style. DiceBear's software is MIT licensed, but style licenses vary.
- **Catalog:** Pre-generate at least 500 deterministic avatars. Each manifest entry includes a stable ID, style, seed, canonical asset path, alt text, and normalized tags such as expression, accessories, hair, color, and eye traits.
- **Backend:** Supabase Auth and Postgres. Keep public catalog assets static; seed catalog IDs in Postgres so favorites and team membership have referential integrity. Protect all user-owned tables with row-level security.
- **Hosting:** Cloudflare Pages for the static application and custom apex domain. Use Supabase's free tier for the MVP, with a documented upgrade trigger because inactive free projects can pause.
- **Quality:** Unit/component tests for generation, filtering, and user actions; integration tests for Supabase policies; Playwright coverage for the critical public and authenticated flows; automated lint, type-check, test, and production-build gates.

## Data Model

- `profiles`: one row per authenticated user.
- `avatars`: public catalog identity and searchable metadata synchronized from the generated manifest.
- `favorites`: unique `(user_id, avatar_id)` pairs owned by the signed-in user.
- `agent_teams`: named collections owned by one user.
- `agent_team_avatars`: ordered unique avatar membership within a team.

Public users may read `avatars`. Row-level security limits every write and every read of private collections to the authenticated owner.

## Delivery Stages

### Stage 1: Contracts

- Define the MVP specification, architecture decision record, repository conventions, data contracts, licensing rules, and executable acceptance-test matrix.

### Stage 2: Parallel foundations

- Build the deterministic avatar generator, static catalog, search/tag UI, and per-avatar actions.
- Implement Supabase authentication, schema, migrations, seed synchronization, and row-level security for favorites and Agent Teams.
- Establish continuous integration and a non-production Cloudflare Pages preview path without touching production DNS.

### Stage 3: Authenticated product slice

- Integrate sign-up/sign-in, favorites, and Agent Teams into the frontend using the approved backend contracts.

### Stage 4: Independent release gate

- Verify acceptance criteria, accessibility, browser behavior, performance, privacy boundaries, and row-level security independently from implementation authors.

### Stage 5: Production launch

- After explicit owner approval and access confirmation, deploy the reviewed commit, bind `agent-avatars.dev`, verify TLS/DNS and production flows, and document rollback.

## Task Index

Tasks are tracked as staged child issues of BD-10 in Multica. They remain in `backlog` until this plan is approved. Promotion is stage-by-stage so dependent work cannot start early.

1. Define MVP architecture, contracts, and acceptance matrix — Engineering Lead — Stage 1.
2. Build generated avatar catalog and public browser — Frontend Engineer — Stage 2.
3. Implement auth, favorites, and Agent Teams data layer — Backend Engineer — Stage 2.
4. Establish CI and Cloudflare preview delivery — Platform Engineer — Stage 2.
5. Integrate authenticated favorites and Agent Teams UX — Frontend Engineer — Stage 3.
6. Run independent QA, accessibility, performance, and security gate — QA & Security Engineer — Stage 4.
7. Deploy production and bind `agent-avatars.dev` — Platform Engineer — Stage 5.

## Checkpoints

### After Stage 1

- The architecture and data contracts are explicit.
- Licensing policy covers every chosen avatar style.
- Every MVP behavior has a testable acceptance criterion.

### After Stage 2

- Public catalog and backend foundations pass focused tests independently.
- CI runs lint, type-check, tests, and the production build.
- A preview deployment is available without production DNS changes.

### After Stage 3

- A user can sign up, favorite avatars, and create and edit Agent Teams end to end.
- Anonymous browsing and all avatar actions still work.

### After Stage 4

- Independent QA and security review passes or records actionable blockers.
- Release candidate meets agreed accessibility and performance thresholds.

### After Stage 5

- `https://agent-avatars.dev` serves the reviewed build over TLS.
- Auth callbacks, favorite persistence, team membership, download, open, and copy-link flows pass production smoke tests.
- Rollback instructions and provider ownership are documented.

## Cost and Operational Notes

- Cloudflare Pages' Free plan currently supports 500 builds per month, 20,000 files per site, and custom domains. A 500-avatar static MVP fits comfortably inside those limits.
- Supabase's Free plan currently includes a 500 MB database, 50,000 monthly active users, and 5 GB egress, but free projects may pause after one week of inactivity. Start at $0/month and upgrade to Pro if the service needs guaranteed wakefulness, backups, or higher limits.
- Binding an apex domain to Cloudflare Pages requires the domain to be a Cloudflare zone with its nameservers pointed to Cloudflare. That DNS change and all production deployment actions require owner approval.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Search tags do not match visible avatar traits | High | Derive tags from generation inputs, validate a sample visually, and keep curated overrides in source control. |
| Avatar style licensing is mishandled | High | Default to CC0 styles, pin versions, generate a machine-readable license inventory, and review it before release. |
| Supabase row-level security leaks private collections | High | Deny by default, test policies with multiple users, and require independent security review. |
| Hundreds of SVGs slow the catalog | Medium | Lazy-load images, keep SVG output optimized, avoid rendering hidden detail, and enforce a performance budget. |
| Free backend pauses after inactivity | Medium | Document the limitation, monitor launch usage, and define the Pro upgrade trigger before production. |
| Production DNS or provider access is unavailable | High | Build and verify previews first; request only the minimum Cloudflare, Supabase, and domain access at the launch gate. |

## Approval Gate

Approval authorizes promotion of Stage 1. It does not authorize production deployment, DNS changes, provider spending, or credential changes. Those remain a separate explicit launch approval after Stage 4 passes.

## Sources

- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Supabase pricing and free-tier limits](https://supabase.com/pricing)
- [DiceBear license overview](https://www.dicebear.com/licenses/)
