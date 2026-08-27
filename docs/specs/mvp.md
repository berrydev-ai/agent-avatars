# Agent Avatars MVP specification

## Objective

Deliver a polished, responsive library at `agent-avatars.dev` where anyone can
find and use a pre-generated agent avatar. Visitors can combine text search and
trait filters, then download an SVG, open its canonical asset URL, or copy that
URL. A user can create an email/password account, save favorites, and maintain
ordered collections named Agent Teams.

Success means the complete public experience works from static assets even when
the authenticated backend is unavailable, private records are isolated by
database policy, and the exact release candidate passes the matrix in
`docs/acceptance-test-matrix.md` before production approval.

## Approved assumptions

The owner approved `tasks/plan.md` on 2026-08-27. This specification therefore
treats these as decisions rather than open questions:

1. The MVP is a modern-browser web application, not a native app.
2. React, TypeScript, and Vite produce a static Cloudflare Pages site.
3. DiceBear runs only in pinned generation tooling; at least 500 SVGs are
   committed or emitted as deterministic build inputs.
4. Only reviewed CC0 styles are allowed initially. Every included style still
   carries machine-readable source and license evidence.
5. Supabase Auth/Postgres owns accounts, favorites, Agent Teams, and ordered
   membership; RLS is the user-isolation boundary.
6. Production deployment, DNS/nameserver changes, provider access, and spend are
   not authorized by this specification.

## Capability map and build order

| Module ID | Responsibility | Depends on |
|---|---|---|
| `shared-scaffold` | root package/lockfile, Vite/TypeScript/Vitest configuration, command names | this specification and contracts |
| `avatar-catalog` | deterministic assets/manifest, search/filter UI, avatar actions | `shared-scaffold` |
| `identity-data` | Auth, schema, RLS, policy tests, typed data client | `shared-scaffold` |
| `delivery` | quality gates, Cloudflare Pages preview, runbook | `shared-scaffold` |
| `authenticated-ui` | session shell, favorites, Agent Teams UI | all three foundation modules |
| `release-gate` | independent release verification | complete preview candidate |

Build order: contracts → `shared-scaffold` → `avatar-catalog` + `identity-data`
+ `delivery` in parallel → `authenticated-ui` → `release-gate` → owner-approved
production launch.

`shared-scaffold` is the first, small commit in BD-12 and is the base for the
three Stage 2 branches. Frontend owns `package.json`, the lockfile, Vite,
TypeScript, and test-runner configuration; Backend proposes Supabase dependency
and script additions as an isolated commit; Platform owns workflow/Pages files
and consumes (but does not redefine) the documented commands. The Engineering
Lead resolves shared-file contract changes before merge. This sequencing is a
Stage 2 bootstrap checkpoint, not an additional product stage.

## User-visible scope

### Anonymous catalog

- Render every valid manifest entry in a responsive catalog below the primary
  search and tag controls.
- Provide a labelled text field and explicit Search button. Search by visible
  labels, aliases, style, ID, and alt text using case- and diacritic-insensitive
  token matching; optional live updates must not make the button ineffective.
- Combine selected tags with AND semantics. Text search and selected tags also
  combine with AND semantics. Tag controls are toggle buttons with an exposed
  selected state.
- Persist normalized search state in `?q=<text>&tags=<sorted,comma-separated-keys>`
  so a copied page URL reproduces the result.
- Provide result count, clear-all, and an informative empty state.
- Lazy-load off-screen SVGs without moving already-laid-out content.

### Avatar actions

- **Download** fetches the same-origin SVG and saves `<avatar-id>.svg`.
- **Open** opens the canonical SVG URL in a new context with opener isolation.
- **Copy link** writes the absolute canonical SVG URL to the clipboard and has
  an accessible fallback when the Clipboard API is unavailable.
- Every action has visible and screen-reader-announced success/failure feedback;
  repeated clicks must not create stacked stale messages.

### Accounts and favorites

- Email/password sign-up returns a confirmation-required state. The user follows
  the one-time email link to `/auth/confirm`, which verifies and removes the
  credential from the address bar before showing authenticated state.
- Sign-in, sign-out, and startup session restoration in the same browser tab.
- Anonymous browsing continues when Auth is loading or unavailable.
- Signed-in users can set or clear a favorite from the catalog and view a
  favorites-only collection/filter after reload.
- Optimistic changes reconcile with the authoritative response and visibly roll
  back on failure.

### Agent Teams

- Signed-in users can create, view, rename, and delete their own named teams.
- They can add, remove, and reorder up to 100 unique avatars in a team.
- Reorder persists atomically and survives reload.
- Empty-team, validation, destructive-confirmation, loading, and error states are
  explicit and keyboard accessible.

## Out of scope for the MVP

- Runtime or user-requested avatar generation, uploads, or SVG editing.
- Social login, anonymous Supabase users, public profiles, or passwordless auth.
- Public/shared teams, collaboration, invitations, comments, or user-facing team
  file exports. An operational privacy-request export remains a launch control.
- Billing, usage quotas, admin dashboards, moderation, analytics, or email
  marketing.
- Server rendering, Pages Functions, an application REST API, or search service.
- Production provider/DNS changes before the separate Stage 5 approval.

## Technical baseline

- Node.js 24 LTS; exact minor version recorded in `.nvmrc` and CI.
- npm with a committed lockfile and `npm ci` in automation.
- React + TypeScript with Vite and strict compiler settings.
- DiceBear core and selected style packages pinned to exact versions.
- `supabase-js` browser client and a project-pinned Supabase CLI dev dependency.
- Vitest + Testing Library, pgTAP through Supabase CLI, and Playwright.
- Modern production browsers in the latest two stable major releases of Chrome,
  Edge, Firefox, and Safari, plus current iOS Safari and Android Chrome.

Stage 2 implementation pins exact dependency versions in `package.json`; this
document fixes compatibility and behavior, not a floating registry version.

## Required commands

The scaffold must expose these repository-root commands without hidden manual
steps:

| Command | Contract |
|---|---|
| `npm ci` | install exactly the lockfile |
| `npm run dev` | start the Vite app using local public environment values |
| `npm run generate:avatars` | regenerate assets, manifest, tags, and license inventory |
| `npm run validate:manifest` | validate schemas, references, uniqueness, order, hashes, and licenses without mutation |
| `npm run format:check` | check formatting without rewriting files |
| `npm run lint` | run static lint with warnings treated as failures |
| `npm run typecheck` | run strict TypeScript checks without emitting |
| `npm run test` | run deterministic unit and component tests once |
| `npm run test:db` | reset local Supabase, lint the schema, and run pgTAP tests |
| `npm run test:e2e` | run Playwright critical paths against a disposable/local environment |
| `npm run build` | validate generated data and emit the production app to `dist/` |
| `npm run verify` | run format, lint, type-check, unit/component, DB, and build gates |

`test:db` may require a documented Docker-compatible runtime. CI must run the
same underlying commands, not materially different shortcuts.

## Repository structure

```text
docs/                          architecture, contracts, runbooks, acceptance matrix
public/avatars/                generated SVGs and manifest.json
scripts/avatars/               deterministic generator, tag adapters, validators
src/app/                       app shell, routing/query state, providers
src/features/catalog/          public search, filters, grid, actions
src/features/auth/             session and email/password UI
src/features/favorites/        favorite state and UI
src/features/teams/            Agent Team state and UI
src/lib/contracts/             shared manifest/data/environment types and validators
src/lib/supabase/              browser client and error mapping
supabase/migrations/           ordered database migrations and policies
supabase/tests/database/       pgTAP schema, grant, function, and RLS tests
tests/                         shared unit/integration fixtures
e2e/                           Playwright critical paths and accessibility checks
```

Feature modules may import `src/lib` and public contracts. They must not import
another feature's private implementation; coordination occurs through typed
public functions/components.

## Code style

- Strict TypeScript: no implicit `any`, unchecked casts, or unvalidated external
  data. Parse manifests, environment values, URL state, and provider responses at
  their boundary.
- Use named exports, small pure functions for search/normalization, and exhaustive
  handling for result variants.
- Components use semantic HTML first. Icon-only controls require accessible
  names, and async status uses a deliberate live region.
- Database names are `snake_case`; TypeScript names are `camelCase`; React
  components are `PascalCase`; tag values and URL keys are lowercase kebab-case.

```ts
export async function setFavorite(
  avatarId: AvatarId,
  isFavorite: boolean,
): Promise<boolean> {
  const parsedId = avatarIdSchema.parse(avatarId);
  return favoriteRepository.set(parsedId, isFavorite);
}
```

## Testing strategy

- **Generation/unit:** identical inputs produce byte-identical assets and
  manifest; IDs, URL state, tag normalization, search combinations, action
  helpers, and error mapping cover success and failure.
- **Component/integration:** keyboard operation, live feedback, loading/empty
  states, session transitions, optimistic rollback, and team editor behavior.
- **Database:** constraints, grants, every RLS operation as anon/user A/user B,
  catalog sync, idempotent favorites, and atomic team replacement.
- **End to end:** anonymous catalog/actions and complete authenticated paths in
  Chromium for PRs; release gate repeats critical paths in Firefox/WebKit and
  mobile viewports.
- **Accessibility:** automated axe checks plus manual keyboard, focus, names,
  status announcements, zoom, contrast, and reduced-motion verification.
- **Performance:** Lighthouse/DevTools on a populated production build using the
  budgets in the acceptance matrix; record configuration and artifact.

Tests must control time, network/provider fixtures, random seeds, and generated
ordering. No test may depend on production data or production credentials.

## Security and privacy requirements

- Treat manifest JSON, URL parameters, Supabase responses, and Auth state as
  untrusted at their entry points.
- Pre-generate and validate SVGs; never render user-provided SVG/HTML.
- Enable RLS and explicit grants on every exposed table. Test absence of access,
  not only happy-path access.
- Use only a Supabase public publishable key in the browser. Secret/service-role,
  database, Cloudflare, and GitHub credentials are CI/provider secrets.
- No email, user ID, access token, or private team/favorite data in analytics,
  URLs, generated assets, or logs.
- Configure `supabase-js` with a `sessionStorage` adapter, not `localStorage`.
  Session restoration means reload in the same tab; closing the tab ends local
  persistence. Strict CSP and a no-third-party-script policy reduce the residual
  XSS token risk inherent in a browser-direct Supabase client. Longer-lived or
  cross-tab sessions require a new ADR and server-managed `HttpOnly` boundary.
- Email confirmation uses a customized token-hash link and `verifyOtp`, not the
  implicit browser flow or a tab-bound PKCE verifier. `/auth/confirm` accepts
  only a one-time `token_hash` and `type=email`, removes the fragment before the
  network exchange, and never puts access/refresh tokens in a URL.
- Team names are plain text, 1–80 Unicode characters after trimming, rendered as
  text, never HTML. A team contains at most 100 unique valid avatar IDs.
- Auth callback allowlists are environment-specific. Preview and production do
  not share a production session or production database by default.
- Email exists only in Supabase Auth for authentication/transactional delivery.
  The app stores only the Auth UUID in owned rows. Before launch, verify a
  documented export/account-deletion request path, cascade deletion of profile,
  favorites, and teams, provider backup retention, and a public privacy contact.
- Use Supabase's Auth abuse controls and production-capable SMTP. Stage 4 verifies
  sign-up/sign-in rate limits and non-enumerating errors rather than implementing
  a second client-side rate limiter.

## Accessibility and performance requirements

- Target WCAG 2.2 AA for accepted user flows.
- All interactive behavior works by keyboard; focus remains visible and returns
  predictably after dialogs, deletes, and async updates.
- At 200% browser zoom and 320 CSS-pixel width, no required control or content is
  lost and no two-dimensional page scrolling is required.
- Respect `prefers-reduced-motion` and do not rely on color alone.
- On the release profile: LCP ≤ 2.5 s, CLS ≤ 0.10, total blocking time ≤ 200 ms,
  initial application JavaScript ≤ 200 KiB gzip, and manifest ≤ 150 KiB gzip.
  Off-screen avatars must be lazy loaded and fixed aspect-ratio space reserved.

## Boundaries

### Always

- Update the contract before intentionally changing an observable schema or
  interface.
- Add tests with behavior changes and run the relevant verification commands.
- Preserve anonymous catalog behavior when authenticated services fail.
- Keep generation inputs, package versions, license records, and output hashes
  reviewable in source control.
- Make database migrations forward-only, reproducible from an empty local stack,
  and covered by policy tests.

### Ask first

- Add a non-development runtime, Pages Function, custom API, paid service, new
  avatar license class, analytics, third-party scripts, or user-generated data.
- Change stable ID/path rules, public tag keys, table/function contracts, auth
  method, supported-browser policy, or performance budgets.
- Mutate a remote Supabase project, Cloudflare project/zone, GitHub settings,
  production DNS, or the registered domain.

### Never

- Commit secrets or expose privileged keys through `VITE_*` variables.
- Generate avatars at request time or depend on an unpinned external asset URL.
- Disable RLS to make a client operation pass.
- Trust or inject raw SVG/HTML from users, URL state, or providers.
- edit generated artifacts by hand; change the generator input and regenerate.
- claim production deployment or security approval without recorded evidence.

## Production access and owner decisions

Stage 2 can proceed locally and on a non-production preview without production
authority. Stage 5 requires all of the following, explicitly approved at launch:

- GitHub Actions/environment administration for scoped deployment secrets and a
  protected production environment.
- A Cloudflare account with the Pages project, the `agent-avatars.dev` zone, and
  separately scoped Pages-deploy and DNS/custom-domain permissions.
- A production Supabase project, project reference, public publishable key,
  migration authority, configured Auth site URL/redirect allowlist, and an SMTP
  decision suitable for production email delivery.
- Domain registrar/nameserver authority if the apex is not already delegated to
  Cloudflare.
- Owner acceptance of free-tier sleep/backup limits or explicit approval of any
  paid upgrade.

Secret values are never written in docs, issues, manifests, client bundles, or
repository files.

## Success criteria

- The manifest contains at least 500 unique, valid, deterministic CC0-approved
  avatars and covers the product's example traits through canonical tags or
  aliases: smile, glasses, nerd, bald, yellow, and big eyes.
- All public and authenticated behaviors above work after reload and report
  useful error states.
- Anon and cross-user database operations cannot observe or mutate private rows.
- The exact preview commit passes all required CI and Stage 4 matrix rows.
- The owner separately approves production access/DNS/spend, after which the same
  reviewed commit serves `https://agent-avatars.dev` with valid TLS and rollback.

## Open questions

There are no unresolved interface choices blocking Stages 2–4. Provider project
IDs, scoped credentials, SMTP vendor/configuration, current DNS delegation, and
free-vs-paid production tier are intentionally deferred owner/access inputs for
the launch gate; implementations must accept them through the environment
contract rather than hard-code them.
