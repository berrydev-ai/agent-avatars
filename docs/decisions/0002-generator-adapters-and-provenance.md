# ADR-0002: Pluggable generator adapters and content provenance

## Status

Accepted

## Date

2026-08-27

## Context

DiceBear is an efficient first source for a deterministic, CC0-first catalog, but
Agent Avatars is intended to grow across many procedural, open-source, local-model,
and hosted AI generators. Encoding DiceBear style, seed, SVG, or license details
as catalog primitives would make every future source a schema migration and would
couple frontend, favorites, Agent Teams, and canonical URLs to one vendor.

AI-generated media also has different properties: identical recipes may not
reproduce identical bytes; providers and model revisions can disappear; prompts
and input assets can carry personal or protected material; output rights may be
defined by provider terms rather than an open-source license; and generation may
require secrets, external data transfer, moderation, and spend.

## Decision

### Build-time generator registry

Create a statically registered build-tool interface for avatar generators. An
adapter owns its engine-specific recipe normalization, invocation, output
validation, trait mapping, and provenance capture. It returns a common normalized
asset; it never changes the public catalog or database schema.

The registry is source-controlled and allowlisted. It is not a runtime plugin
loader and does not execute downloaded/untrusted code. A synthetic fixture adapter
proves that catalog consumers handle a second generator and raster media without
requiring a second production dependency.

### Generator-neutral publication model

Catalog records expose only stable generator ID, preset/collection label, media
type and extension, dimensions, content hash, canonical path, tags, rights ID,
and provenance ID. Generator-specific recipes live in the build provenance ledger.

Published, normalized bytes are the identity boundary. Compute SHA-256 after
sanitization/metadata policy and set the ID to
`<generator-id>-<first-20-lowercase-hex-characters>`. Keep the full hash to detect
prefix collision. The same published bytes from one generator retain one ID;
different stochastic AI outputs receive different IDs even when their prompt is
identical. Tag or rights-metadata corrections do not change the asset ID.

### DiceBear MVP adapter

Use DiceBear 10's native JavaScript library with exact versions of
`@dicebear/core` and `@dicebear/styles`. Load selected style JSON into `Style` and
`Avatar`; validate current option names from DiceBear metadata. Do not use the
public HTTP API for bulk/commercial generation, individual legacy style packages,
`@dicebear/collection`, `createAvatar()`, or pre-10 option names. The adapter
preserves synthetic seed/options in its non-public, non-sensitive recipe and
emits reviewed CC0 SVGs.

### Alternative and AI adapter onboarding

Every adapter needs a supported adapter API version, immutable ID, pinned
engine/model revision, typed recipe schema, output/media validator, canonical
tag mapper, rights record, provenance record, fixture, failure isolation, and
acceptance evidence.

An AI adapter additionally requires a provider-specific ADR and explicit owner
approval for provider access, credentials, data sharing, recurring or per-image
spend, and output publication. Its review covers NIST AI RMF concerns, prompt and
input provenance, safety/moderation and bias sampling, likeness/trademark/IP risk,
provider/model terms, retention/training settings, reproducibility limits, and
incident/takedown handling. Secrets stay in protected build environments; no user
or private workspace data is sent without a separately approved product/privacy
change.

Hosted adapters use scoped build-only credentials and explicit request,
concurrency, timeout, retry, and spend limits. They allowlist provider hosts and
redirects, stream into bounded buffers, reject media-signature mismatches, and
never fetch an arbitrary provider-returned URL. Prompts, signed URLs, response
bodies, authentication headers, and credentials are redacted from logs.

AI output remains pre-generated for the foreseeable catalog flow. The build
ledger records generator/model revision, recipe hash, approved input-asset
hashes, safety policy revision, output hash, and rights decision; provider
responses are ephemeral and never committed wholesale. Support a C2PA Content
Credential or sidecar reference when the selected provider/toolchain can produce
one; do not claim cryptographic provenance when only internal metadata exists.

An append-only withdrawal ledger can remove a disputed or harmful asset without
deleting saved foreign-key references. Withdrawal removes the manifest record
and origin object, purges only its exact CDN URL, verifies origin and edge no
longer serve image bytes, and leaves an action-free tombstone in saved
collections. Immutable content caching has this explicit incident exception.

## Alternatives considered

### Keep DiceBear fields in the public manifest

Rejected. It makes frontend, database, and user collections understand every
engine and forces breaking migrations as generator types expand.

### Derive identity from seed or prompt

Rejected. Prompts are not unique, AI output may be stochastic, and provider/model
changes can alter bytes without changing the recipe. Published content hashing
works across deterministic and non-deterministic engines.

### Load generator plugins dynamically at runtime

Rejected. It expands the production attack surface, couples catalog availability
to generators, and makes rights/safety review fail-open. Adapters are reviewed
build dependencies and outputs are materialized before deployment.

### Require C2PA for the first release

Deferred. C2PA is the preferred interoperable path for tamper-evident provenance,
but DiceBear MVP assets can ship with a hashed internal ledger. The schema reserves
a credential reference so a later adapter can add C2PA without changing consumers.

## Consequences

- Adding a compliant procedural generator is an adapter and content-review change,
  not a frontend/database redesign.
- The MVP pays a small abstraction/test cost before the second production source.
- IDs change when normalized published bytes change, regardless of recipe intent.
- The asset pipeline and UI must support allowlisted vector and raster media.
- AI generation is technically accommodated but remains deliberately gated; this
  ADR does not authorize a provider, credentials, data sharing, spend, or runtime
  generation.
- Provenance describes verifiable facts and review state; it does not itself prove
  that an output is safe, accurate, original, or legally usable.

## References

- [DiceBear guidance for AI assistants](https://www.dicebear.com/guides/dicebear-for-ai-assistants/)
- [DiceBear JavaScript library](https://www.dicebear.com/how-to-use/js-library/)
- [DiceBear licenses](https://www.dicebear.com/licenses/)
- [NIST Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)
- [C2PA specifications](https://spec.c2pa.org/specifications/)
- [SPDX license identifiers](https://spdx.dev/learn/handling-license-info/)
- [RFC 8785: JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
