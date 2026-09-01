# ADR-0003: Composable avatar part packs

## Status

Accepted

## Date

2026-08-31

## Context

Agent Avatars needs substantially more deterministic images than can be curated
as complete one-off files. The Premium Flat source contributes 20 editable
vector characters, but its Illustrator document contains one layer and mostly
unnamed nested groups. Automatically treating those groups as semantic hair,
eye, mouth, or clothing parts would create unstable and visually invalid
contracts.

The artwork archive also contains no license evidence. Importing it into the
public catalog would bypass the rights and provenance boundary in ADR-0002.

## Decision

Add a versioned, source-controlled `AvatarPartPack` interface for offline
composition. A pack declares a square canvas, ordered slots, named variants, and
an explicit publication state. SVG variants are validated at the pack boundary;
same-document IDs are namespaced during composition; the final SVG passes the
existing publication validator.

Use mixed-radix indexing to map any integer recipe index directly to one
selection per slot. Combination counts use `bigint`, so tooling can report and
sample a large cartesian product without expanding it in memory.

Import the 20 Premium Flat characters as complete `base` variants, then combine
them with background, accent, frame, and badge slots. Keep this pack and all
generated samples below the Git-ignored `local/avatar-parts/` directory. Mark
the pack `local-only` until redistribution, commercial-use, and modification
rights are documented.

Approve a bounded generated sample separately from the raw pack. The approved
sample records its source-pack hash, exact recipes, final asset hashes,
owned-work evidence, and review reference before the catalog generator can
merge it into the public manifest.

Semantic extraction of the source's unnamed nested groups is a later curation
step. New slots are additive to the pack contract and do not change catalog
consumers or existing content-addressed asset IDs.

## Alternatives considered

### Publish the 20 full characters directly

Rejected. It adds only 20 identities and does not advance combinatorial
generation.

### Infer semantic parts from unnamed Illustrator groups

Rejected for automatic migration. Group hierarchy and drawing order do not
reliably identify visible anatomy, and parts do not share normalized anchors.
Manual visual curation is required before those labels become a stable contract.

### Generate combinations in the browser

Rejected. Runtime generation conflicts with ADR-0001 and ADR-0002, makes stable
asset identity harder, and would expose unreviewed source material to public
clients.

## Consequences

- The migrated local pack exposes 90,720 deterministic recipes from 20 base
  characters and four decorative part categories.
- Small samples can cover the full recipe space without materializing every SVG.
- Unsafe SVG markup and cross-part ID collisions fail before output publication.
- Owner approval recorded on 2026-09-01 permits the reviewed 256-avatar Premium
  Flat sample to enter the public catalog; the raw pack remains local-only.
- The deployed catalog contains 757 unique rendered avatars: 501 DiceBear and
  256 Premium Flat. Render-level deduplication removes three DiceBear recipes
  whose SVGs differ only by document-local fragment IDs.
- Hair, eyes, mouths, facial hair, and clothing are not yet independently
  swappable; achieving that requires a visual semantic-curation pass.
