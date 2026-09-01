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

## Generator registry and stable identity

### Adapter boundary

Build tooling loads only source-controlled, statically allowlisted adapters. It
does not discover packages from the network or load runtime plugins.

```ts
type JsonPrimitive = string | number | boolean | null;
type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

type GeneratorId = string;
type GeneratorKind = 'procedural' | 'ai';
type Reproducibility = 'deterministic' | 'best-effort' | 'non-deterministic';
type MediaType = 'image/svg+xml' | 'image/png' | 'image/webp' | 'image/avif';
type AssetExtension = 'svg' | 'png' | 'webp' | 'avif';
type ReviewRef = {
  system: 'multica' | 'github' | 'other';
  id: string;
  url?: `https://${string}`;
};

interface GeneratorRecipe {
  schemaVersion: number;
  generatorId: GeneratorId;
  preset: string;
  input: Readonly<Record<string, JsonValue>>;
}

interface GeneratedAsset {
  bytes: Uint8Array;
  mediaType: MediaType;
  width: number;
  height: number;
}

interface PublicationEvidence {
  recipeSha256: string;
  assetSha256: string;
}

interface AvatarGeneratorAdapter {
  readonly descriptor: GeneratorDescriptor;
  normalizeRecipe(raw: unknown): GeneratorRecipe;
  generate(recipe: GeneratorRecipe): Promise<GeneratedAsset>;
  validateAndNormalizeAsset(asset: GeneratedAsset): Promise<GeneratedAsset>;
  deriveTags(
    recipe: GeneratorRecipe,
    asset: GeneratedAsset,
  ): Promise<readonly TagKey[]>;
  resolveRights(
    recipe: GeneratorRecipe,
    asset: GeneratedAsset,
  ): RightsId;
  buildProvenance(
    recipe: GeneratorRecipe,
    asset: GeneratedAsset,
    evidence: PublicationEvidence,
  ): ProvenanceRecord;
}

interface AiPublicationApproval {
  providerAdrPath: `docs/decisions/${string}.md`;
  ownerApproval: ReviewRef;
  providerAccessApproval: ReviewRef;
  rightsReview: ReviewRef;
  safetyReview: ReviewRef;
  privacyReview: ReviewRef;
  spendApproval: ReviewRef;
  approvedAt: `${number}-${number}-${number}`;
  reviewBy: `${number}-${number}-${number}`;
}

interface GeneratorPublicationPolicy {
  id: string;
  revision: string;
  generatorId: GeneratorId;
  approvedRightsIds: readonly RightsId[];
  reviewRefs: readonly ReviewRef[];
  publicActions: {
    download: true;
    open: true;
    copy: true;
  };
  aiApproval?: AiPublicationApproval;
}

interface GeneratorRegistration {
  registryApiVersion: 1;
  adapter: AvatarGeneratorAdapter;
  rightsInventory: readonly RightsRecord[];
  publicationPolicy: GeneratorPublicationPolicy;
}
```

This interface uses the public descriptor, tag, and provenance types defined in
the manifest contract below. Implementations may add private types, but those
types do not become catalog contracts.

The source-controlled registry is a literal array of `GeneratorRegistration`—not
a package scan. Registration, adapter descriptor, rights inventory, and policy
generator IDs must agree. The registry rejects unsupported API versions,
unregistered or adapter-returned-unapproved rights, missing review references,
and an AI adapter without a complete unexpired `aiApproval` before it invokes
generation. Every entry in `approvedRightsIds` must resolve in that
registration's inventory and permit download, redistribution, commercial use,
and modification, because the v1 policy exposes download/open/copy for every
active record.

Adapters own engine-specific recipes and invocation. Catalog consumers receive
only the common manifest record. Provider responses, model output, definitions,
and recipes are untrusted at adapter boundaries and are schema-validated before
they influence filenames, tags, rights, or publication.

Canonical recipe evidence uses the JSON Canonicalization Scheme (RFC 8785):
serialize the validated `GeneratorRecipe` as canonical UTF-8 JSON, hash those
exact bytes with SHA-256, and store the lowercase hexadecimal digest. Arrays keep
their order. Non-JSON values and duplicate object keys fail validation; adapters
must not substitute their own serialization.

### DiceBear 10 MVP adapter

The registry ID is `dicebear`. Use exact versions of `@dicebear/core` and
`@dicebear/styles`; load selected style JSON into the current `Style` and
`Avatar` classes. Do not use the public HTTP API for bulk/commercial generation,
individual legacy style packages, `@dicebear/collection`, `createAvatar()`, or
pre-10 option names. Component option names end in `Variant`; validate them from
current style metadata rather than relying on silently ignored parameters.

The adapter may initially use only these style slugs, listed by DiceBear under
CC0 1.0 when this contract was approved:

```text
lorelei
lorelei-neutral
notionists
notionists-neutral
pixel-art
pixel-art-neutral
```

It may use a subset if it still produces at least 500 useful avatars and covers
the required trait vocabulary. Preserve every synthetic seed exactly; seeds must
not contain a name, email, user ID, or other personal data. Record style, seed,
validated options, `@dicebear/core` version, and `@dicebear/styles` version in the
non-public, non-sensitive build recipe/provenance ledger. DiceBear software's MIT
license does not determine a style's artwork license.

### Alternative and AI adapters

A new adapter must provide an immutable generator ID, pinned engine/model
revision, typed recipe, output validator, tag mapper, rights decision,
provenance record, deterministic fixtures where applicable, and the shared
contract suite. Generator IDs are never renamed or reused.

An AI adapter additionally requires a provider-specific ADR and explicit owner
approval for provider access, credentials, data transfer, spend, and publishing.
Before output enters the catalog, review model/provider terms, prompt and input
rights, retention/training settings, likeness/trademark risk, harmful bias,
safety/moderation results, reproducibility limits, and takedown/incident handling.
No user/private data may enter a recipe without a separately approved product and
privacy change. AI generation remains offline/build-time; the browser never holds
provider credentials or generates on request.

Record generator/model revision, canonical recipe hash, approved input-asset
hashes, safety-policy revision, output hash, and rights decision. Provider
responses are ephemeral and never committed wholesale. A supported C2PA
Content Credential or external sidecar may be referenced, but internal metadata
must not be described as cryptographically verified provenance.

Hosted adapters run with scoped build-only credentials, explicit request,
concurrency, timeout, retry, and spend ceilings. Provider hosts and redirects are
allowlisted; an adapter may not fetch an arbitrary output URL or attach a secret
to a redirected host. Response status, declared length, streamed byte count, and
media signature are checked before decode. Logs redact prompts, signed URLs,
headers, provider responses, and credentials.

### Content-addressed identity and media safety

1. Validate and normalize the final asset that will be published.
2. Compute `assetSha256` from those exact bytes.
3. Set `id = <generator-id>-<first-20-lowercase-hex-characters>`.
4. Store the full hash and fail if a prefix collision maps to different bytes.
5. Set `assetPath = /avatars/<id>.<extension>`, where extension and media type
   agree through the allowlist below.

The same normalized bytes from the same generator keep the same ID. Different
stochastic outputs get different IDs even when their recipe is identical. A
re-encode or byte-changing engine upgrade creates a new ID. Tag, alt-text,
rights, or provenance corrections that do not change published bytes keep the
ID.

Every asset is at most 5 MiB encoded, is 1:1, has positive dimensions no greater
than 2048×2048, and is decoded/validated with bounded parsers before publication.
SVG parsing disables DTDs and external entities and enforces document/node/depth
limits. A small source-controlled element/attribute allowlist permits only the
static geometry, grouping, gradient, clip, and mask constructs required by an
approved adapter. It rejects `DOCTYPE`, entities, script, event attributes,
`foreignObject`, CSS `style` elements/attributes, animation, filters, embedded
raster, and arbitrary `href`/`url()`/`data:` values. Only validated same-document
fragment references to allowlisted IDs may be retained. Raster media is decoded
and deterministically re-encoded; EXIF/location, profiles/comments not explicitly
allowed, and provider metadata are stripped.
The encoded signature, declared media type, and extension must agree. Generated
artifacts are never hand-edited.

## Manifest contract

The public manifest is served at `/avatars/manifest.json`, contains only active
records, and never contains a withdrawal tombstone. All asset paths are
same-origin root-relative URLs under `/avatars/`.

```ts
type AvatarId = `${string}-${string}`;
type RightsId = string;
type ProvenanceId = string;
type TagCategory =
  | 'expression'
  | 'accessory'
  | 'hair'
  | 'eye'
  | 'color'
  | 'theme';
type TagKey = `${TagCategory}:${string}`;

interface GeneratorDescriptor {
  id: GeneratorId;
  adapterApiVersion: 1;
  name: string;
  kind: GeneratorKind;
  engine: string;
  engineVersion: string;
  components: Readonly<Record<string, string>>;
  sourceUrl: `https://${string}`;
  reproducibility: Reproducibility;
  outputMediaTypes: readonly MediaType[];
}

interface RightsRecord {
  id: RightsId;
  basis: 'spdx' | 'provider-terms' | 'owned';
  name: string;
  spdxExpression?: string;
  url: `https://${string}`;
  policyRevision: string;
  reviewedSourceSha256: string;
  attributionRequired: boolean;
  attributionText?: string;
  downloadAllowed: boolean;
  redistributionAllowed: boolean;
  commercialUseAllowed: boolean;
  modificationsAllowed: boolean;
  reviewedAt: `${number}-${number}-${number}`;
  reviewBy?: `${number}-${number}-${number}`;
}

interface ProvenanceRecord {
  id: ProvenanceId;
  generatorId: GeneratorId;
  generatorVersion: string;
  recipeSchemaVersion: number;
  recipeSha256: string;
  assetSha256: string;
  inputAssetSha256s: readonly string[];
  aiGenerated: boolean;
  creator?: string;
  sourceUrl?: `https://${string}`;
  modelId?: string;
  modelRevision?: string;
  safetyPolicyRevision?: string;
  c2paCredentialPath?: `/avatars/provenance/${string}`;
  c2paCredentialSha256?: string;
  publicationPolicyId: string;
  publicationPolicyRevision: string;
  approvalRefs: readonly ReviewRef[];
}

interface TagDefinition {
  key: TagKey;
  label: string;
  aliases: readonly string[];
}

interface AvatarRecord {
  id: AvatarId;
  generatorId: GeneratorId;
  preset: string;
  assetPath: `/avatars/${AvatarId}.${AssetExtension}`;
  assetExtension: AssetExtension;
  mediaType: MediaType;
  assetSha256: string;
  width: number;
  height: number;
  alt: string;
  tags: readonly TagKey[];
  rightsId: RightsId;
  provenanceId: ProvenanceId;
}

interface AvatarManifestV1 {
  schemaVersion: 1;
  generators: readonly GeneratorDescriptor[];
  rights: readonly RightsRecord[];
  provenance: readonly ProvenanceRecord[];
  tagDefinitions: readonly TagDefinition[];
  avatars: readonly AvatarRecord[];
}
```

Additional invariants:

- `avatars.length >= 500` active records; IDs and asset paths are unique and
  sorted by `id`.
- Every generator ID matches `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Every avatar ID
  matches `^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{20}$`, begins with its immutable
  generator ID, and matches the first 20 characters of its full asset hash.
- `generators`, `rights`, and `provenance` are unique and sorted by ID. Every
  avatar reference resolves; each provenance asset hash equals its avatar hash.
- `tags` on each record are unique and sorted by `TagKey`.
- `tagDefinitions` are unique and sorted by `key`; aliases are normalized,
  unique, and sorted.
- `alt` is concise natural language describing visible distinguishing traits. It
  does not begin with “image of” and is not a filename or raw tag dump.
- The actual asset SHA-256 equals `assetSha256`; its decoded type, signature,
  extension, dimensions, and manifest fields agree.
- Engine, component, and model versions/revisions are exact immutable strings,
  never floating tags such as `latest` or semver ranges such as `^1.2.3`.
- The registry rejects an unsupported adapter API version before invoking the
  adapter. A future API version changes the shared contract suite explicitly.
- Hash fields are 64 lowercase hexadecimal characters. Rights evidence binds the
  reviewed source/terms bytes to an exact `policyRevision`; `basis: 'spdx'`
  requires a valid SPDX expression. `basis: 'provider-terms'` requires a future
  `reviewBy` date and fails publication after it expires. Required attribution
  has non-empty text.
- Recipe schema versions are positive integers interpreted only by their owning
  adapter; catalog consumers do not branch on them.
- `aiGenerated: true` requires model ID/revision and safety-policy revision.
  Input hashes are unique and sorted. A C2PA path and credential hash must either
  both be present or both be absent.
- Every provenance record resolves the exact active publication-policy ID and
  revision. Its review references match that policy; AI records include every
  approval reference and fail when the approval's `reviewBy` date has passed.
- MVP publication accepts `CC0-1.0` and the reviewed Premium Flat owned-work
  record. Additional SPDX, provider-terms, or owned-output decisions require
  their own exact evidence digest and approval reference.
- Because v1 always exposes open, copy, and download, a published rights record
  must allow download, redistribution, commercial use, and modification. A later
  restricted-rights source requires an explicit rights-aware UI/contract change;
  the current pipeline fails closed rather than silently exposing disallowed
  actions.

The canonical absolute asset URL is:

```ts
new URL(record.assetPath, env.VITE_PUBLIC_SITE_URL).href
```

`VITE_PUBLIC_SITE_URL` is an HTTPS origin without a path or trailing slash in
preview/production. The path—not a generator/provider URL—is the public link used
by open, copy, download, favorites, and Agent Teams.

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
generator adapter maps its supported recipe fields to keys, then generation
validates a representative sample visually. Curated corrections live in a
committed source file keyed by avatar ID and are merged deterministically.

### Query normalization and matching

1. Trim input; apply Unicode NFKD; remove combining marks; lowercase; replace
   punctuation/whitespace runs with one space.
2. Tokenize the normalized query on spaces.
3. Build each avatar's search document from ID, generator name, preset, alt text,
   tag labels, and tag aliases using the same normalization.
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
| Download | fetch same-origin `assetPath`, verify its SHA-256, signature, and allowlisted media type against the manifest, create a blob URL, click an `<a download="<id>.<extension>">`, then revoke it | announce failure; do not navigate or save an unverified/HTML/error payload |
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
| `generator_id` | `text` | not null; immutable generator namespace |
| `preset` | `text` | not null; generator-neutral collection/style label |
| `asset_path` | `text` | not null, unique; `/avatars/<id>.<extension>` |
| `asset_extension` | `text` | not null; allowlisted extension matching media type |
| `media_type` | `text` | not null; allowlisted manifest media type |
| `width` | `integer` | not null; positive and equal to `height` |
| `height` | `integer` | not null; positive and equal to `width` |
| `alt` | `text` | not null |
| `tags` | `text[]` | not null, default empty; canonical unique sorted keys |
| `rights_id` | `text` | not null; resolves in manifest rights inventory |
| `provenance_id` | `text` | not null; resolves in manifest provenance inventory |
| `asset_sha256` | `text` | not null; 64 lowercase hex |
| `manifest_version` | `integer` | not null; `1` in v1 |
| `publication_status` | `text` | not null; `active` or `withdrawn` |
| `withdrawn_at` | `timestamptz` | null for active; required for withdrawn |
| `withdrawal_code` | `text` | null for active; allowlisted non-sensitive reason for withdrawn |
| `withdrawal_ref` | `text` | null for active; stable review/incident ID for withdrawn |

A source-controlled, append-only withdrawal ledger records avatar ID, one of
`rights`, `safety`, `privacy`, `provider`, `takedown`, or `other`, effective time,
and a stable review reference without claim/complainant details. Withdrawal is
explicit; absence from a generation run never implies withdrawal. A privileged
catalog synchronization atomically upserts active records and marks ledger IDs
withdrawn instead of deleting rows. It removes withdrawn records/assets from the
next public manifest/deployment, replaces DB alt text with `Avatar unavailable`,
and clears DB tags. Historical hashes, rights/provenance IDs, and foreign-key
references remain for audit and safe saved-collection rendering. Browser roles
have no catalog mutation grant.

The withdrawal deployment deletes the origin object, purges only the withdrawn
canonical asset URL from the CDN, and verifies that both cache-bypassed origin and
edge requests return 404/410 without image bytes before the incident is closed.
Immutable caching does not waive this exception. If exact-URL purge permission is
unavailable, the withdrawal remains blocked and is escalated to the owner; a
broad cache purge is not an authorized substitute. Already downloaded or
third-party-copied files cannot be revoked and are recorded as an explicit
incident limitation.

Favorites and team entries retain a withdrawn ID until their owner removes it.
The UI renders a non-image `Avatar unavailable` tombstone with no open/copy/
download action. New favorites and new team membership require an active avatar.
An existing withdrawn team member may be retained/reordered in that same team or
removed, but may not be newly inserted into another team. Withdrawal entries are
permanent in v1; republishing requires a reviewed new asset ID.

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

`set_favorite` requires an active avatar when setting true, inserts with
conflict-do-nothing or deletes, and returns the resulting state, making retry
safe. A withdrawn favorite can always be removed. `create_agent_team` takes a transaction-level
advisory lock derived from `auth.uid()`, enforces the 50-team limit, and
implements the client-intent ID rules below. A UUID collision owned by someone
else returns the same generic `CONFLICT` as a caller-owned ID reused with a
different name; create cannot hide collision existence because a missing ID must
succeed. Rename normalizes/validates only `name`. Rename, delete, and membership
operations map cross-owner and missing target IDs to the same result. Delete is
idempotent for either case.

`set_agent_team_members`:

1. locks the owned team row for the transaction;
2. rejects more than 100 IDs, duplicates, nulls, unknown avatar IDs, new
   withdrawn IDs, or a withdrawn ID not already in that same team;
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
  listFavorites(): Promise<readonly SavedAvatarRef[]>;
  setFavorite(avatarId: AvatarId, isFavorite: boolean): Promise<boolean>;
}

interface SavedAvatarRef {
  avatarId: AvatarId;
  availability: 'active' | 'withdrawn';
}

interface AgentTeam {
  id: string;
  name: string;
  avatars: readonly SavedAvatarRef[];
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
| generated media → browser/download | active content, malformed pixels, metadata disclosure, or tampered bytes | media-specific offline validator/normalizer, committed hash, download hash verification, `nosniff` |
| Auth/browser session | token theft, account enumeration, brute force | session-scoped storage, no third-party scripts, provider rate limits, generic mapped errors, sign-out clearing |
| browser → PostgREST/RPC | cross-user read/write or guessed private ID | least grants, RLS on every operation, owner checks, two-user negative tests |
| team reorder transaction | race, duplicate position, partial data loss | owned-row lock, bounded unique array, one transaction, rollback/concurrency tests |
| build/CI → providers | credential leak, SSRF/redirect theft, runaway spend, or resource exhaustion | protected scoped secrets, host/redirect allowlist, bounded streaming/decode, timeout/concurrency/retry/spend limits, redacted logs, no `VITE_*` secrets, secret/bundle scans |
| catalog/package/model supply chain | changed artwork/terms, unsafe model output, or malicious dependency | exact pins/revisions, install-script review, rights inventory, safety review, fixture/content diff, audit triage |
| withdrawn asset → immutable CDN cache | harmful/disputed bytes remain reachable after catalog removal | origin deletion, exact-URL purge, origin/edge 404-or-410 proof, retained DB tombstone; never a broad purge |

Data classification and lifecycle:

- Published avatar assets, tags, rights records, and non-sensitive provenance are
  public non-personal data. Approved non-sensitive recipes are non-public build
  records; provider responses are transient and retained only as required hashes
  or reviewed evidence, never as wholesale response bodies.
- Auth email and Auth/user UUID are personal data used only for account access,
  ownership, and transactional Auth email. No profile name is collected in v1.
- Favorites and team names/membership are private user content. They are retained
  until user/account deletion; foreign-key cascades erase application rows.
- Before launch, the runbook must verify a request-based export/deletion process,
  Supabase Auth-user deletion, provider backup/restore retention, and a public
  privacy contact. Logs and test fixtures exclude real email/private content.
- No analytics or advertising vendor receives personal/private data in the MVP.

## Licensing and provenance contract

- Every published record resolves to one reviewed `RightsRecord` and one
  `ProvenanceRecord`. Missing, conflicting, stale, or unapproved records fail the
  build. Approved non-sensitive source recipes stay out of the public manifest;
  their canonical hashes and the final asset hash are retained.
- SPDX IDs represent standard licenses. Provider terms or owned-work bases use a
  stable policy ID, exact revision, reviewed URL, and source digest. Capabilities
  such as download, redistribution, modification, and commercial use are
  recorded explicitly; inference from a generator software license is forbidden.
- The MVP publication policy remains CC0-only artwork. `CC0-1.0` records use the
  authoritative Creative Commons URL and `attributionRequired: false`. The
  DiceBear software MIT license remains separate from each style's artwork
  rights.
- Generate `THIRD_PARTY_NOTICES.md` (or an equivalent clearly linked page) from
  the rights/provenance inventory. Preserve creator/source, verified date,
  generator and component versions, adapter policy revision, and any required
  attribution even when the current MVP does not display attribution.
- Adding or upgrading a generator, package, model, style, or provider requires a
  fresh rights review recorded in the pull request. AI output also requires the
  provider-specific approvals and safety/privacy evidence in ADR-0002. This is
  engineering scope control, not a substitute for legal advice.
- A C2PA Content Credential may be stored and validated when supported. Internal
  hashes and ledger records are provenance evidence, but are not represented as
  cryptographically verified Content Credentials.

## Production access handoff

Before production, the platform owner records—without secret values—the GitHub
environment name, Cloudflare account/Pages project/zone, Supabase project ref,
Auth site URL and redirects, SMTP readiness, domain registrar/nameserver owner,
and rollback owner. QA receives the immutable preview URL and commit SHA. No
production mutation occurs until the owner explicitly approves access, DNS, and
spend after the independent gate.

## Authoritative references

- [ADR-0002: generator adapters and provenance](../decisions/0002-generator-adapters-and-provenance.md)
- [DiceBear guidance for AI assistants](https://www.dicebear.com/guides/dicebear-for-ai-assistants/)
- [DiceBear JavaScript library](https://www.dicebear.com/how-to-use/js-library/)
- [DiceBear license inventory](https://www.dicebear.com/licenses/)
- [SPDX license identifiers](https://spdx.dev/learn/handling-license-info/)
- [RFC 8785: JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [NIST AI 600-1: Generative AI Profile](https://doi.org/10.6028/NIST.AI.600-1)
- [C2PA specifications](https://spec.c2pa.org/)
- [Supabase RLS: grants and policies](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase email templates and token hashes](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase local development](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Supabase database testing](https://supabase.com/docs/guides/local-development/cli/testing-and-linting)
- [Cloudflare Pages build variables](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Cloudflare Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Vite environment variables](https://vite.dev/guide/env-and-mode)
