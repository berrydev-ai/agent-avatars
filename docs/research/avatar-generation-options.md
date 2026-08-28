# Avatar generation options — research

Date: 2026-08-28. Status: research for decision; authorizes nothing by itself.
Facts below were web-verified on this date unless flagged; prices and model
lineups in this space change monthly.

## The bar every option is measured against

From ADR-0002 and the MVP contracts:

- Generation is **build-time only**, through a source-controlled adapter in the
  allowlisted registry. No runtime generation, no runtime plugins.
- Identity is the **SHA-256 of published bytes** (`<generator-id>-<20 hex>`), so
  stochastic generators are acceptable; regeneration is never promised.
- Every approved rights record must permit **download, redistribution,
  commercial use, and modification** (contract requirement for the v1
  download/open/copy actions). CC0 preferred; attribution (CC-BY) is extra
  machinery; "artist's own terms" is a legal gray zone.
- An **AI adapter is allowed but gated**: provider-specific ADR plus owner
  approvals (access, credentials, data transfer, spend, publishing) and
  safety/bias/likeness/rights reviews. Local models drop the
  credential/data/spend concerns but keep the ADR and safety/rights review.
- The SVG validator allowlists elements — **no `<style>`, no `style=`
  attributes, no filters, no animation elements** — square dimensions ≤2048,
  ≤10k nodes. Raster is contractually accommodated but the pipeline is
  vector-first today.

## Option 1 — Expand the existing DiceBear adapter (days, $0)

DiceBear v10 ships ~61 styles; the project uses 6. Per the DiceBear licenses
page: **42 styles are CC0**, 14 CC-BY 4.0, 1 MIT, 4 "artist's own terms."
Unused CC0 styles that fit an *AI-agent* identity: **Pixelbot** and **Voxel
Bot** (robots), plus abstract CC0 styles (Thumbs, Identicon, Shapes, Glass,
Rings, Marbles) and **Open Peeps** (CC0 remix).

- **Fit**: same `@dicebear/core` + `@dicebear/styles` path, same adapter,
  same rights review as the current CC0 set. New `StyleConfig` entries, trait
  mapping, review evidence. This is the cheapest possible catalog expansion.
- **Risks**
  - **bottts — the most famous robot style — is NOT CC0.** Bottts, Bottts
    Neutral, Avataaars are Pablo Stanley "artist's own terms" ("free for
    personal and commercial use," one line, no explicit redistribution or
    modification grant, no SPDX id). Using it means a `LicenseRef-` custom
    rights record and accepting unresolved redistribution ambiguity —
    recommend excluding it.
  - Pixelbot and Voxel Bot are listed as **animated** styles; the SVG
    validator forbids animation elements. Expect either a static rendering
    mode or a validator/policy decision before these two ship. (Export slugs
    in `@dicebear/styles` v10 not yet enumerated — check at implementation.)
  - CC-BY tier (Adventurer, Big Ears, Micah, Personas…) is usable only if
    per-asset attribution records and UI surfacing are added — a product
    decision, not just an adapter change.

## Option 2 — First-party original style: build our own (weeks, $0–8k)

The differentiating move: commission or draw an original robot/bot trait set
the project owns outright.

- **Key finding**: DiceBear v10 styles are plain JSON definitions (canvas +
  components/variants with probabilities + color constraints, JSON Schema
  published, Figma "DiceBear Studio" plugin exports it). The existing adapter
  already does `new Style(json)` — **a first-party style needs no new engine**.
  Estimated ~1–2 eng-weeks (config, tags, rights, goldens, contact-sheet QA)
  plus art. A fully independent engine instead: ~2–3 eng-weeks.
- **Art sourcing**: commission at roughly **$1.5k–8k** for ~40–80 flat vector
  trait pieces with full rights (triangulated estimate, not a quote); in-house
  for $0 cash; or remix existing CC0 art (Kenney, Open Peeps — both verified
  CC0). Contract must use work-for-hire **plus** fallback present assignment
  language (commissioned illustration may not qualify as statutory WFH),
  originality/no-AI warranty, and an explicit CC0-release clause.
- **Risks**
  - Trait-combinatorics QA (10⁵–10⁸ combos) needs automated overlap/contrast
    checks and pairwise render sweeps — cannot be eyeballed.
  - Trademark clearance against the crowded bot-mascot field (Octocat®, Reddit
    Snoo, Android robot, and DiceBear's own Bottts) before release.
  - Releasing the art CC0 forfeits exclusivity; anyone may republish the set.
    Mitigation: CC0 the trait library, reserve one hero mascot as a
    trademarked brand asset outside the catalog.
  - AI-drafted trait art carries no copyright (USCO Jan-2025 report; *Thaler*
    cert denied Mar 2026) — nothing to assign or dedicate. If AI drafts are
    used, human-redraw finals from scratch and record the process.

## Option 3 — Additional open-source procedural libraries (days each)

Verified adapter candidates and rejects:

| Library | License | Verdict |
| --- | --- | --- |
| **boring-avatars** 2.0.4 (2025-09) | MIT, active | Good: 6 abstract SVG variants, deterministic; React-only — adapter renders via `react-dom/server` `renderToStaticMarkup` (build-time dev-dep only) |
| **jdenticon** 3.3.0 / **blo** 2.0.0 | MIT | Safe abstract tier (identicons / blockies); pure Node → SVG string; quiet-but-stable maintenance |
| **RoboHash** art sets | code MIT; set1–4 CC-BY 3.0/4.0; **set6 CC0**; set5 artist's own terms | Thematically ideal robots; but Python renderer (or vendor the art + reimplement hash-assembly in Node), raster-only output, CC-BY attribution records needed for sets 1–4. Start with set6 (CC0) if pursued |
| **multiavatar** | custom | **Reject** — license forbids re-packaging avatar sets or building a competing avatar product: that is literally this project. Also unmaintained since 2022 |
| **ugly-avatar** | CC BY-NC | **Reject** — non-commercial fails the rights bar |
| npm "robohash"/"robohash-avatars" wrappers | — | **Reject** — they are URL builders for the hosted robohash.org API (forbidden path) |

Risks: mostly abandonment-grade maintenance outside boring-avatars, and style
overlap with existing DiceBear abstract styles (marginal catalog value per
adapter). Each adapter still pays the full registration cost (recipe schema,
validator, tags, rights, fixtures).

## Option 4 — Local open-weight AI models (gated; ~$25 compute + review hours)

Generate original raster collections at build time on owned/rented hardware.
No provider credentials, data transfer, or per-image spend — but still an AI
adapter: ADR + safety/bias/rights review required.

- **License-clean models (commercial + output redistribution OK)**:
  **FLUX.1 [schnell]** (Apache-2.0), **FLUX.2 [klein] 4B** (Apache-2.0,
  Jan 2026), **Z-Image-Turbo** (Apache-2.0), Qwen-Image (Apache-2.0, heavy),
  SD 3.5 (free only under $1M org revenue — a standing condition the rights
  record must carry). **FLUX.1/2 [dev] are non-commercial — out** without a
  paid BFL license.
- **Consistency recipe**: train a style LoRA on operator-owned seed art
  (15–50 images, $1–10 per training attempt on a rented 4090) + templated
  prompts; strongest provenance story ("fine-tuned on our art").
- **Cost math (500-avatar reviewed collection, 4× overgeneration)**: compute
  **$0 on Apple Silicon** (hours, overnight) or **~$10–25 on a rented 4090**
  (1–3 h). The dominant cost is **human curation + safety/bias review, 6–12 h**.
- **Risks**
  - Raster-only; SVG requires flat-styled output → color quantize → vtracer
    trace (works at avatar scale; fails on painterly styles). AI-native SVG
    models (OmniSVG, StarVector) not production-ready; OmniSVG's training set
    is NC-licensed — rights ambiguity.
  - Reproducibility is best-effort same-machine only (GPU nondeterminism);
    ledger must promise content-hash identity, seeds recorded as metadata —
    which is exactly the accepted ADR posture.
  - Raw AI output is uncopyrightable in the US (settled: USCO 2025; Thaler
    cert denied Mar 2026). Honest rights record: "no copyright claimed /
    operator dedication," never an ownership claim.
  - Training-data litigation is live: **Andersen v. Stability trial starts
    2026-09-08**; Getty US case in discovery (Getty lost the UK secondary-
    copyright claim, Nov 2025). Re-check status before publishing any
    AI collection.
  - GitHub Actions default runners cannot do this; generation happens on a
    workstation or rented GPU, and outputs are committed/materialized.

## Option 5 — Hosted AI image APIs (gated; <$50 per 500-image set)

The full AI-approval gate applies: provider ADR, credentialed build-only
access, spend ceilings, host allowlists.

| Provider | Why / why not | 500 imgs |
| --- | --- | --- |
| **Recraft V4.1** | **Only native-SVG provider** — fits the vector pipeline with no tracing; custom `style_id` trained from 1–5 reference images gives best-in-class set consistency; API data explicitly never used for training. No seed (irrelevant — bytes are materialized); no C2PA; broad license-back to Recraft in ToS | $17.50 raster / **$44 true SVG** |
| **OpenAI gpt-image-2 / mini** | Strongest legal package: output rights assigned, API no-training default, **C2PA + SynthID** (fills the schema's reserved credential ref). Raster only; admits weak recurring-character consistency; gpt-image-1 deprecates 2026-10-23 | $2.50–26 |
| **Google Gemini image models** | Cheap; SynthID mandatory; Cloud-side IP indemnity if bought via Vertex. But churn is proven: **Imagen API endpoints were shut down 2026-08-17** with a ~2-month window | ~$10–20 |
| **BFL direct API** | **Flag** — service terms take a perpetual license to inputs *and* outputs and explicitly allow training on API I/O; no ownership assignment. Poor rights-record fit despite C2PA and cheap Klein pricing | $7–15 |
| **Aggregators (Replicate/fal/Together)** | Cheapest raw generation (schnell ~$1.35/500) but rights = aggregator ToS **+** upstream model license, with silent version drift — double review surface. Fine for experiments, wrong target for a provider ADR. Midjourney: still no API; automation violates its ToS — disqualified | $1.35+ |

Cost is a non-factor (<$50 premium path). The real cost is the approval
machinery and provider-terms review; model/product churn is the recurring tax.

## Ruled out — hosted procedural avatar APIs (documented dead end)

Every non-AI hosted avatar service fails at least one hard requirement.
DiceBear's HTTP API: non-commercial fair use, "set up your own instance" for
commercial — the ADR's existing exclusion is confirmed verbatim. UI Avatars:
no ToS at all → no rights record possible; bus-factor-1. Gravatar: free tier
restricted to "active users only," no redistribution grant, generated-style
art licensing undocumented. Multiavatar API: **shut down**. Boring Avatars'
free endpoint: **shut down July 2024** (paid Gumroad tiers, no redistribution
terms). avatar.vercel.sh: courtesy demo, no terms. avatar.iran.liara.run:
returned 502 during this research. The one defensible rights story — RoboHash
(CC-BY/CC0 art) — is better consumed as a library (Option 3). Precedent:
Adorable Avatars, the category's poster child, evaporated ~2019.

## Comparison

| # | Option | Effort | Cash | Rights story | Distinct value |
| --- | --- | --- | --- | --- | --- |
| 1 | DiceBear CC0 expansion | Days | $0 | CC0, same review path | Robot styles now (validator caveat) |
| 2 | First-party style | 1–2 wks eng + art | $0–8k | Owned → clean CC0 | Brand identity nobody else has |
| 3 | OSS library adapters | Days each | $0 | MIT/CC0/CC-BY per lib | Variety; RoboHash robots |
| 4 | Local AI (Apache models) | 1–2 wks + review | ~$25 | "No copyright claimed" + model license | Unlimited original collections |
| 5 | Hosted AI (Recraft first) | ADR + adapter | <$50/set | Provider-terms dependent | Native SVG, style_id consistency |

## Recommended sequence

1. **Ship Option 1 now** (excluding bottts; resolve the animated-style
   question for Pixelbot/Voxel Bot).
2. **Start Option 2's art track in parallel** — it reuses the DiceBear engine,
   and it is the only option that yields an identity the project owns.
3. **Add Option 3 selectively** (boring-avatars first) when catalog variety,
   not volume, is the gap.
4. **Prototype Option 4 offline** (FLUX.2 klein or Z-Image-Turbo + own-art
   LoRA) without publishing, so the safety/rights review has concrete samples;
   revisit after the Andersen trial signal.
5. **Take Option 5 only via a Recraft-specific ADR** if native-SVG AI output
   proves worth the approval machinery; OpenAI as the raster/provenance
   alternative.

## Source highlights

- DiceBear licenses/styles: dicebear.com/licenses, dicebear.com/styles,
  github.com/dicebear/schema
- Multiavatar license: multiavatar.com/license; RoboHash sets:
  github.com/e1ven/Robohash
- USCO *Copyright and AI, Part 2* (Jan 2025): copyright.gov/ai; *Thaler v.
  Perlmutter* cert denied Mar 2026
- FLUX licenses: bfl.ai/licensing, github.com/black-forest-labs/flux;
  Stability Community License: stability.ai/news-updates/license-update
- Recraft API/pricing/data policy: recraft.ai/pricing?tab=api,
  recraft.ai/docs/trust-and-security/data-use-and-model-training
- OpenAI pricing/terms/C2PA: developers.openai.com/api/docs/pricing,
  openai.com/policies/services-agreement
- Google Gemini API pricing/terms: ai.google.dev/gemini-api/docs/pricing,
  cloud.google.com/terms/generative-ai-indemnified-services
- Litigation trackers: meshiplaw.com (Andersen), courtlistener.com (Getty US)

Flagged as unverified: commission price range (triangulated, no direct quote);
`@dicebear/styles` v10 export slugs for Pixelbot/Voxel Bot; Stability official
API pricing and C2PA status; Recraft V4.1 exact API model string; bottts
redistribution terms (one-line license, silent either way).
