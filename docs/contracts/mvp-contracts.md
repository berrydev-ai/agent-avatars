# Agent Avatars MVP contracts

This document is the implementation boundary shared by frontend, backend,
platform, and QA work. A change to a required field, stable ID/path, tag key,
database object, client method, environment name, or error meaning must update
this document and its contract tests before consumers change.

## Contract versioning rules

- Prefer additive optional fields. Do not rename, remove, or change the meaning
  of an observable field in place.
- `manifest.schemaVersion` is a major integer. A consumer must reject an unknown
  major with a useful catalog-unavailable state; it may ignore unknown fields in
  a known major.
- Database migrations are forward-only. Generated database TypeScript types are
  committed and checked for drift after each migration.
- Public tag keys and avatar IDs are durable. Labels and aliases may be corrected
  without changing stored keys.
- One active contract version exists at a time. Do not maintain parallel v1/v2
  client implementations in the MVP.

## Avatar generation and stable identity

### Initial style allowlist

The generator may initially use only these DiceBear style slugs, which the
official license inventory lists under CC0 1.0 at the time of this decision:

```text
lorelei
lorelei-neutral
notionists
notionists-neutral
pixel-art
pixel-art-neutral
```

An implementation may start with a subset if it still produces at least 500
useful avatars and covers the required trait vocabulary. Adding a style requires
a reviewed license record and deterministic tag adapter. A package or style
upgrade requires regenerating and reviewing the license inventory; the software
package's MIT license does not determine a style's artwork license.

### Canonical render input and ID

Every avatar begins with this logical input:

```ts
interface AvatarRenderInput {
  renderVersion: 1;
  style: StyleSlug;
  seed: string;
  options: Readonly<Record<string, JsonValue>>;
}
```

Rules:

1. `style` is the allowlisted lowercase kebab-case DiceBear style slug.
2. `seed` is from a committed, append-only synthetic seed list. It must not
   contain a person's name, email, user ID, or other personal data.
3. `options` contains every option that can affect SVG bytes. Object keys are
   recursively sorted; absent/default values are normalized according to the
   pinned adapter before hashing.
4. Serialize the input as canonical JSON: UTF-8, recursively sorted object keys,
   array order preserved, no insignificant whitespace.
5. Compute SHA-256 of those bytes and set
   `id = <style>-<first-16-lowercase-hex-characters>`.
6. Fail generation on an ID collision. Never resolve one by adding a random
   suffix.

`renderVersion` must increase when package/style changes can alter SVG output
for unchanged normalized input. Tag, alt-text, or license-metadata corrections
do not change it. This keeps an ID stable for identical visual input and creates
a new immutable URL when the render contract changes.

### Output determinism and safety

- An input always emits the same UTF-8 SVG bytes, after a single documented
  deterministic optimization pass, and the same manifest record.
- SVGs are 1:1, contain an explicit `viewBox`, and contain no scripts, event
  handlers, remote references, embedded raster data, or user-controlled markup.
- Generation fails if an SVG or manifest record violates its schema, references
  an unknown tag/license, duplicates an ID/path, or disagrees with its SHA-256.
- Manifest entries, tag definitions, licenses, and object keys use the canonical
  sort described below. No build timestamp appears in deterministic output.
- Generated artifacts are never hand-edited.

## Manifest contract

The public manifest is served at `/avatars/manifest.json`. All asset paths are
same-origin root-relative URLs under `/avatars/`.

```ts
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

type AvatarId = `${string}-${string}`;
type StyleSlug = string;
type LicenseId = 'CC0-1.0';
type TagCategory =
  | 'expression'
  | 'accessory'
  | 'hair'
  | 'eye'
  | 'color'
  | 'theme';
type TagKey = `${TagCategory}:${string}`;

interface LicenseRecord {
  id: LicenseId;
  name: 'CC0 1.0 Universal';
  url: 'https://creativecommons.org/publicdomain/zero/1.0/';
  attributionRequired: false;
}

interface StyleLicenseRecord {
  style: StyleSlug;
  licenseId: LicenseId;
  creator: string;
  sourceUrl: `https://${string}`;
  verifiedAt: `${number}-${number}-${number}`;
}

interface TagDefinition {
  key: TagKey;
  label: string;
  aliases: readonly string[];
}

interface AvatarRecord {
  id: AvatarId;
  style: StyleSlug;
  seed: string;
  options: Readonly<Record<string, JsonValue>>;
  assetPath: `/avatars/${AvatarId}.svg`;
  assetSha256: string; // exactly 64 lowercase hex characters
  width: 128;
  height: 128;
  alt: string;
  tags: readonly TagKey[];
  licenseId: LicenseId;
}

interface AvatarManifestV1 {
  schemaVersion: 1;
  renderVersion: 1;
  generator: {
    name: '@dicebear/core';
    version: string;
    stylePackages: Readonly<Record<StyleSlug, string>>;
  };
  licenses: readonly LicenseRecord[];
  styleLicenses: readonly StyleLicenseRecord[];
  tagDefinitions: readonly TagDefinition[];
  avatars: readonly AvatarRecord[];
}
```

Additional invariants:

- `avatars.length >= 500`; IDs and asset paths are unique and sorted by `id`.
- Every ID matches
  `^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{16}$`, with its allowlisted style as
  the prefix. Boundary schemas must enforce the regex rather than relying on the
  broad TypeScript template type.
- `tags` on each record are unique and sorted by `TagKey`.
- `tagDefinitions` are unique and sorted by `key`; aliases are normalized,
  unique, and sorted.
- Every avatar style has exactly one `styleLicenses` record and every referenced
  tag/license exists.
- `alt` is concise natural language describing visible distinguishing traits. It
  does not begin with “image of” and is not a filename or raw tag dump.
- The actual SVG SHA-256 equals `assetSha256`.
- Package versions are exact semver strings, never ranges such as `^1.2.3`.

The canonical absolute asset URL is:

```ts
new URL(record.assetPath, env.VITE_PUBLIC_SITE_URL).href
```

`VITE_PUBLIC_SITE_URL` is an HTTPS origin without a path or trailing slash in
preview/production. The path—not a database or DiceBear URL—is the public link
used by open, copy, download, favorites, and Agent Teams.

## Tag and search contract

### Stable keys

Tags use `<category>:<lowercase-kebab-value>`. Keys are storage and URL values;
labels are presentation. These required examples must exist in the initial
vocabulary or as aliases to an equivalent visible trait:

| Product phrase | Canonical key | Display label | Required search aliases |
|---|---|---|---|
| smile | `expression:smile` | Smile | `smile`, `smiling`, `happy` |
| glasses | `accessory:glasses` | Glasses | `glasses`, `eyeglasses`, `spectacles` |
| nerd | `theme:nerd` | Nerd | `nerd`, `geek`, `geeky` |
| bald | `hair:bald` | Bald | `bald`, `no hair` |
| yellow | `color:yellow` | Yellow | `yellow`, `gold` |
| big eyes | `eye:big` | Big eyes | `big eyes`, `large eyes` |

Tags must describe visible output, not merely requested generator options. Each
style adapter maps its supported options to keys, then generation validates a
representative sample visually. Curated corrections live in a committed source
file keyed by avatar ID and are merged deterministically.

### Query normalization and matching

1. Trim input; apply Unicode NFKD; remove combining marks; lowercase; replace
   punctuation/whitespace runs with one space.
2. Tokenize the normalized query on spaces.
3. Build each avatar's search document from ID, style, alt text, tag labels, and
   tag aliases using the same normalization.
4. Every text token must appear in the search document (AND semantics).
5. Every selected `TagKey` must appear in `avatar.tags` (AND semantics).
6. An avatar must satisfy both text and tag predicates.
7. Preserve manifest order in results; do not add relevance ordering in v1.

URL state uses only `q` and `tags`. `tags` is a sorted comma-separated list of
encoded canonical keys. The parser removes duplicate and unknown keys, omits
empty values, and replaces the URL with normalized state without a reload.
Search submits from a labelled field or explicit Search button; optional
debounced live matching uses the identical predicate. Tag toggles expose
`aria-pressed` and never encode labels in URL state.

Construct `tags` by joining raw sorted keys with `,`, then set that value once
through `URLSearchParams`; do not pre-encode individual keys. For example, the
decoded state `q=big eyes` with `accessory:glasses` and `expression:smile` has
this canonical query string (one percent-encoding pass):

```text
?q=big+eyes&tags=accessory%3Aglasses%2Cexpression%3Asmile
```

Parsing reads the decoded `tags` value from `URLSearchParams` and then splits on
`,`; it must not decode a second time.

## Public action contract

| Action | Behavior | Failure behavior |
|---|---|---|
| Download | fetch same-origin `assetPath`, verify its SHA-256 against the manifest and an SVG content type/safe signature, create a blob URL, click an `<a download="<id>.svg">`, then revoke it | announce failure; do not navigate or save an unverified/HTML/error payload |
| Open | open canonical absolute asset URL with `_blank` and `noopener,noreferrer` | announce when the browser blocks the new context |
| Copy link | write canonical absolute asset URL with Clipboard API | expose a focusable select/copy fallback and announce instructions |

Status messages identify the action and avatar, are visible, use a polite live
region, and clear/replace predictably. Buttons remain keyboard operable and do
not rely on hover-only controls.

## Database contract

All application tables are in `public`, use UTC `timestamptz`, have RLS enabled,
and receive explicit least-privilege grants. Migration tests inspect both grants
and policies.

### Tables and constraints

#### `profiles`

| Column | Type | Contract |
|---|---|---|
| `user_id` | `uuid` | primary key; FK `auth.users(id) on delete cascade` |
| `created_at` | `timestamptz` | not null, default `now()` |
| `updated_at` | `timestamptz` | not null, default `now()`; update trigger |

An `auth.users` insert trigger creates the row through a small `security definer`
function with `search_path = ''` and fully qualified object names. Trigger logic
does not copy untrusted user metadata.

#### `avatars`

| Column | Type | Contract |
|---|---|---|
| `id` | `text` | primary key; stable manifest `AvatarId` |
| `style` | `text` | not null, lowercase kebab-case |
| `seed` | `text` | not null |
| `asset_path` | `text` | not null, unique, exactly `/avatars/<id>.svg` |
| `alt` | `text` | not null |
| `tags` | `text[]` | not null, default empty; canonical unique sorted keys |
| `license_id` | `text` | not null; `CC0-1.0` in v1 |
| `asset_sha256` | `text` | not null; 64 lowercase hex |
| `manifest_version` | `integer` | not null; `1` in v1 |

A privileged seed synchronization upserts manifest records and fails rather than
deleting any avatar referenced by favorites/team membership. Browser roles have
no catalog mutation grant.

#### `favorites`

| Column | Type | Contract |
|---|---|---|
| `user_id` | `uuid` | FK `profiles(user_id) on delete cascade` |
| `avatar_id` | `text` | FK `avatars(id) on delete restrict` |
| `created_at` | `timestamptz` | not null, default `now()` |

Primary key: `(user_id, avatar_id)`. The pair makes setting a favorite
idempotent and prevents duplicates.

#### `agent_teams`

| Column | Type | Contract |
|---|---|---|
| `id` | `uuid` | primary key; supplied by client for retry-safe create |
| `user_id` | `uuid` | not null; FK `profiles(user_id) on delete cascade` |
| `name` | `text` | trimmed, 1–80 Unicode characters |
| `created_at` | `timestamptz` | not null, default `now()` |
| `updated_at` | `timestamptz` | not null, default `now()`; update trigger |

Unique index: `(user_id, lower(name))`. This gives one case-insensitive team name
per owner. The client generates one UUID per create intent and reuses it across
retries. The same ID/name owned by the caller returns the existing team; any
different-payload or different-owner ID collision returns the same generic
`CONFLICT` without row/owner details. A user may own at most 50 teams; the create
function serializes the per-user count and rejects the 51st.

#### `agent_team_avatars`

| Column | Type | Contract |
|---|---|---|
| `team_id` | `uuid` | FK `agent_teams(id) on delete cascade` |
| `avatar_id` | `text` | FK `avatars(id) on delete restrict` |
| `position` | `smallint` | not null; `0 <= position < 100` |
| `created_at` | `timestamptz` | not null, default `now()` |

Primary key: `(team_id, avatar_id)`. Unique constraint: `(team_id, position)`.
For every team positions are contiguous `0..n-1`, and `n <= 100`.

### Grants and RLS matrix

“Own” means `(select auth.uid()) is not null` and equals the row's `user_id`, or
equals the owner of the referenced team. Policies use explicit `TO` roles.

| Object | `anon` | `authenticated` | Policy |
|---|---|---|---|
| `profiles` | none | select | own row only; inserts come only from trigger |
| `avatars` | select | select | `using (true)`; no browser writes |
| `favorites` | none | select | own rows; all writes use `set_favorite` |
| `agent_teams` | none | select | own rows; all writes use team functions |
| `agent_team_avatars` | none | select | referenced team is owned; all writes use `set_agent_team_members` |

The `service_role` remains provider-side and bypasses RLS; it is never a browser
or preview variable. New tables/views/functions are denied until their grants and
RLS behavior are specified and tested. Views must use invoker security or an
equivalent design proven not to bypass private-table policies.

Authenticated table writes are explicitly revoked, including otherwise-owned
rows. This prevents callers from setting protected IDs/timestamps or bypassing
transactional validation with direct PostgREST insert/update/delete requests.
RLS write policies remain deny-by-default defense in depth; functions are the
only granted write surface.

### Transactional functions

```sql
public.set_favorite(p_avatar_id text, p_is_favorite boolean)
  returns boolean

public.create_agent_team(p_id uuid, p_name text)
  returns public.agent_teams

public.rename_agent_team(p_team_id uuid, p_name text)
  returns public.agent_teams

public.delete_agent_team(p_team_id uuid)
  returns boolean

public.set_agent_team_members(p_team_id uuid, p_avatar_ids text[])
  returns table (avatar_id text, position smallint)
```

Migrations create a dedicated `app_private_writer` role with `NOLOGIN` and
`NOBYPASSRLS`. It does not own application tables. It owns all five functions,
which are `security definer` with `search_path = ''`, fully qualified object
references, and explicit `auth.uid()` plus ownership checks. Revoke function
execute from `public` and `anon`; grant execute only to `authenticated`.

`app_private_writer` receives only these table privileges: select/insert/delete
on `favorites`; select/insert, column-level `update(name)`, and delete on
`agent_teams`; select/insert/delete on `agent_team_avatars`; select on `avatars`
and `profiles`. It receives no update of IDs, owners, timestamps, avatar rows, or
profile rows. Write policies explicitly `TO app_private_writer` repeat the own-row
checks, so RLS still constrains the non-owner/non-bypass function role. Function
arguments never accept a `user_id`, timestamp, or position. Tests inspect role,
table/function ownership, `rolbypassrls`, grants, policies, and prove direct DML
fails even for an owned row.

`set_favorite` inserts with conflict-do-nothing or deletes and returns the
resulting state, making retry safe. `create_agent_team` takes a transaction-level
advisory lock derived from `auth.uid()`, enforces the 50-team limit, and
implements the client-intent ID rules below. A UUID collision owned by someone
else returns the same generic `CONFLICT` as a caller-owned ID reused with a
different name; create cannot hide collision existence because a missing ID must
succeed. Rename normalizes/validates only `name`. Rename, delete, and membership
operations map cross-owner and missing target IDs to the same result. Delete is
idempotent for either case.

`set_agent_team_members`:

1. locks the owned team row for the transaction;
2. rejects more than 100 IDs, duplicates, nulls, or unknown avatar IDs;
3. replaces membership in one transaction using array order as positions;
4. returns the stored ordered membership.

An unauthenticated/cross-owner/missing team is returned as not found to avoid
confirming another user's private identifier. Direct table mutation and direct
multi-statement reorder from the browser are forbidden.

## TypeScript client contract

Supabase-specific result objects and error text do not escape the repository
adapter. Public methods return domain types or throw `AppClientError`.

```ts
type AppErrorCode =
  | 'AUTH_REQUIRED'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'UNEXPECTED_ERROR';

interface AppClientError extends Error {
  code: AppErrorCode;
  retryable: boolean;
  cause?: unknown; // logging/debug only; never rendered directly
}

interface AuthUser {
  id: string;
  email: string;
}

interface EmailPasswordInput {
  email: string;
  password: string;
}

type SignUpResult = {
  status: 'confirmation_required';
  email: string; // normalized copy of the caller's own input
};

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'error'; error: AppClientError };

interface AuthClient {
  getInitialState(): Promise<AuthState>;
  subscribe(listener: (state: AuthState) => void): () => void;
  signUp(input: EmailPasswordInput): Promise<SignUpResult>;
  confirmEmail(input: {
    tokenHash: string;
    type: 'email';
  }): Promise<{ status: 'authenticated'; user: AuthUser }>;
  signIn(input: EmailPasswordInput): Promise<{
    status: 'authenticated';
    user: AuthUser;
  }>;
  signOut(): Promise<void>;
}

interface FavoriteClient {
  listFavoriteIds(): Promise<readonly AvatarId[]>;
  setFavorite(avatarId: AvatarId, isFavorite: boolean): Promise<boolean>;
}

interface AgentTeam {
  id: string;
  name: string;
  avatarIds: readonly AvatarId[];
  createdAt: string;
  updatedAt: string;
}

interface Page<T> {
  items: readonly T[];
  nextCursor: string | null;
}

interface TeamClient {
  listTeams(input?: {
    cursor?: string;
    limit?: number; // default 25, maximum 50
  }): Promise<Page<AgentTeam>>;
  createTeam(input: { id: string; name: string }): Promise<AgentTeam>;
  renameTeam(input: { teamId: string; name: string }): Promise<AgentTeam>;
  deleteTeam(teamId: string): Promise<void>;
  setMembers(input: {
    teamId: string;
    avatarIds: readonly AvatarId[];
  }): Promise<AgentTeam>;
}
```

Operational semantics:

- Lists use stable ordering: favorites by `created_at desc, avatar_id asc`; teams
  by `updated_at desc, id asc`; members by `position asc`. Team pagination uses
  an opaque cursor containing the last ordering pair; offset pagination is not a
  public contract.
- `deleteTeam` and favorite removal are idempotent. A missing team delete is
  successful only if it cannot represent a cross-owner lookup; the adapter must
  not leak private existence.
- `createTeam` uses a client UUID generated once per user intent. Retrying the
  same ID and normalized name returns the stored team; reusing the ID with a
  different payload produces `CONFLICT`. Creation of a 51st team produces
  `VALIDATION_ERROR`.
- `VALIDATION_ERROR`, `AUTH_REQUIRED`, `NOT_FOUND`, and `CONFLICT` are not
  retryable. Network/rate errors may be retried with bounded backoff while
  preserving the original create intent ID.
- UI strings are authored locally from error codes. Provider messages and SQL
  details are not displayed.

### Email/password confirmation flow

- Email confirmation is enabled in local, preview, and production Supabase
  configuration; auto-confirm is disabled so environments behave consistently.
- Trim email input, validate its email shape and maximum 254 characters, but let
  Supabase own canonical account matching. Password is 12–72 UTF-8 bytes; count
  with `TextEncoder`, test multibyte boundaries, and configure the Supabase
  provider minimum to 12 so direct Auth calls cannot bypass the client. Do not
  impose composition rules or log/retain the plaintext. UI confirmation must
  match before calling the client.
- Create the browser client with `detectSessionInUrl: false`. Sign-up supplies
  the allowlisted `VITE_PUBLIC_SITE_URL` as `emailRedirectTo`.
- Customize the Confirm Signup email template to link to
  `{{ .RedirectTo }}/auth/confirm#token_hash={{ .TokenHash }}&type=email`.
  The fragment is not sent in HTTP requests or referrers.
- `/auth/confirm` accepts only that fragment shape, copies the one-time value to
  memory, immediately calls `history.replaceState` to remove the fragment, and
  then calls `verifyOtp({ token_hash, type: 'email' })` through `confirmEmail`.
  Access/refresh tokens never appear in the address bar.
- The token-hash flow has no tab-bound PKCE verifier, so the confirmation may
  open in the current or a new tab. Success stores the returned session in that
  tab's `sessionStorage`; failure shows a generic expired/invalid-link state.
- Component/integration tests use local Mailpit to cover current-tab, new-tab,
  reused/expired token, malformed fragment, and callback URL cleanup.

## Environment contract

Environment validation runs before creating provider clients or rendering the
authenticated shell. Missing/invalid public Supabase values disable authenticated
features with a useful status but must not prevent the static catalog loading.

### Browser-visible build values

| Name | Required | Validation and meaning |
|---|---|---|
| `VITE_PUBLIC_SITE_URL` | yes | absolute HTTPS origin, no credentials/path/query/trailing slash; local dev may use `http://localhost:<port>` |
| `VITE_SUPABASE_URL` | auth builds | absolute HTTPS Supabase project URL; local dev may use loopback HTTP |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | auth builds | public publishable key only; legacy anon key may be mapped at build time, never under another browser name |
| `VITE_APP_ENV` | yes | exactly `local`, `preview`, or `production` |

All `VITE_*` values are public because Vite embeds them in the browser bundle.
Secret-scanning and build inspection must prove no secret/service-role value is
present.

### Cloudflare Pages build values

| Name | Source | Use |
|---|---|---|
| `CF_PAGES` | Cloudflare injected | assert Pages build context |
| `CF_PAGES_URL` | Cloudflare injected | preview default for `VITE_PUBLIC_SITE_URL` through the build wrapper |
| `CF_PAGES_BRANCH` | Cloudflare injected | select preview vs production public configuration |
| `CF_PAGES_COMMIT_SHA` | Cloudflare injected | release evidence, not user data |

Production must explicitly set `VITE_PUBLIC_SITE_URL=https://agent-avatars.dev`;
it must not use the `pages.dev` origin as canonical. Preview uses a non-production
Supabase project and an allowlisted `https://*.agent-avatars.pages.dev` callback
pattern only if Supabase supports the reviewed pattern; otherwise list exact
preview URLs.

### CI/provider secrets

The platform scaffold may use these names. They are never prefixed `VITE_` and
are stored in protected GitHub/Cloudflare environments:

| Name | Scope |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | CLI management for the selected non-production/production project |
| `SUPABASE_PROJECT_REF` | non-secret project selector, still environment-specific |
| `SUPABASE_DB_PASSWORD` | remote migration only; never available to preview browser builds |
| `CLOUDFLARE_API_TOKEN` | scoped Pages deployment; DNS permission excluded until launch |
| `CLOUDFLARE_ACCOUNT_ID` | account selector |
| `CLOUDFLARE_PAGES_PROJECT` | Pages project selector |

Local committed `.env.example` contains names and safe placeholders only.
`.env`, `.env.local`, CLI credentials, and generated tokens are ignored.

### Browser session and response-header baseline

The browser client uses `persistSession: true` with an injected `sessionStorage`
adapter. Application code never reads or writes token strings directly. A reload
in the same tab restores the session; tab close clears persisted local state.
This is a deliberate compromise for the approved browser-direct architecture:
strict CSP, no third-party runtime scripts, React text escaping, short provider
token lifetimes, and sign-out cache clearing are mandatory. A request for
long-lived/cross-tab sessions requires a server-managed `HttpOnly` cookie design
and a new ADR.

Cloudflare `_headers` (or an equivalent reviewed configuration) supplies this
minimum production/preview policy, with the exact Supabase HTTPS/WSS origins
substituted per environment:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://<project>.supabase.co wss://<project>.supabase.co; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
```

Production also enables HSTS after the custom domain is proven HTTPS-only. CSP
contains neither `unsafe-eval` nor a wildcard source. Adding analytics, external
fonts, or another runtime origin requires security/owner review.

## Threat and privacy model

| Boundary / asset | Primary abuse case | Required control and proof |
|---|---|---|
| URL/manifest → React | XSS, unsafe path, oversized/malformed data | schema/size/path validation, React text rendering, strict CSP, malicious fixtures |
| generated SVG → browser/download | script/remote reference or tampered bytes | offline allowlist validator, committed hash, download hash verification, `nosniff` |
| Auth/browser session | token theft, account enumeration, brute force | session-scoped storage, no third-party scripts, provider rate limits, generic mapped errors, sign-out clearing |
| browser → PostgREST/RPC | cross-user read/write or guessed private ID | least grants, RLS on every operation, owner checks, two-user negative tests |
| team reorder transaction | race, duplicate position, partial data loss | owned-row lock, bounded unique array, one transaction, rollback/concurrency tests |
| build/CI → providers | credential leak or privilege escalation | protected scoped secrets, no `VITE_*` secrets, secret/bundle scans, separate DNS permission |
| catalog/package supply chain | changed artwork/license or malicious dependency | exact pins/lockfile, install-script review, license inventory, deterministic diff, audit triage |

Data classification and lifecycle:

- Avatar assets/tags/licenses are public non-personal data.
- Auth email and Auth/user UUID are personal data used only for account access,
  ownership, and transactional Auth email. No profile name is collected in v1.
- Favorites and team names/membership are private user content. They are retained
  until user/account deletion; foreign-key cascades erase application rows.
- Before launch, the runbook must verify a request-based export/deletion process,
  Supabase Auth-user deletion, provider backup/restore retention, and a public
  privacy contact. Logs and test fixtures exclude real email/private content.
- No analytics or advertising vendor receives personal/private data in the MVP.

## Licensing and provenance contract

- The MVP policy is CC0-only artwork. `CC0-1.0` records use the authoritative
  Creative Commons URL and `attributionRequired: false`.
- Preserve provenance even when attribution is not required: style slug, creator,
  DiceBear/source URL, verified date, pinned package version, and license ID.
- Generate `THIRD_PARTY_NOTICES.md` (or an equivalent clearly linked page) from
  the same inventory. It distinguishes DiceBear software (MIT) from each style's
  artwork license.
- The generator fails closed for a missing, unknown, non-CC0, or conflicting
  license record.
- License review is mandatory when adding/upgrading a style or package. A page
  label can change over time; the pull request records the reviewed source and
  date. This policy is engineering scope control, not a substitute for legal
  advice.

## Production access handoff

Before production, the platform owner records—without secret values—the GitHub
environment name, Cloudflare account/Pages project/zone, Supabase project ref,
Auth site URL and redirects, SMTP readiness, domain registrar/nameserver owner,
and rollback owner. QA receives the immutable preview URL and commit SHA. No
production mutation occurs until the owner explicitly approves access, DNS, and
spend after the independent gate.

## Authoritative references

- [DiceBear license inventory](https://www.dicebear.com/licenses/)
- [Supabase RLS: grants and policies](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase email templates and token hashes](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase local development](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Supabase database testing](https://supabase.com/docs/guides/local-development/cli/testing-and-linting)
- [Cloudflare Pages build variables](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Cloudflare Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Vite environment variables](https://vite.dev/guide/env-and-mode)
