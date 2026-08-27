# Agent Avatars MVP acceptance-test matrix

This matrix is the release contract for BD-10. “Automated” rows must name the
test/spec in the implementing pull request. “Manual” rows require recorded
browser, viewport, commit SHA, result, and evidence link in the Stage 4 report.
No row may be waived silently.

## Gate definitions

| Gate | Required evidence |
|---|---|
| Foundation PR | focused unit/component/DB tests plus lint, type-check, and build for the touched module |
| Integrated PR | full `npm run verify`, Chromium critical-path Playwright, and immutable preview URL |
| Stage 4 release gate | all rows through `PF-*` plus `OPS-01`–`OPS-04`, including Firefox/WebKit/mobile/manual evidence; zero unresolved critical/high findings |
| Stage 5 launch | owner approval, exact reviewed SHA, production smoke/TLS/DNS/rollback evidence |

Default test identities are synthetic user A and user B in a disposable local or
preview Supabase project. Tests never read or mutate production data.

## Public catalog and actions

| ID | Acceptance requirement | Verification method | Gate / owner |
|---|---|---|---|
| PUB-01 | Manifest schema is v1; it has ≥500 unique, sorted records and every referenced asset/hash/tag/generator/rights/provenance record exists | generator fixture + `npm run validate:manifest`; regenerate deterministic fixtures twice in clean directories and compare bytes | Foundation / Frontend |
| PUB-02 | Every MVP DiceBear style is on the approved CC0 allowlist and generated notices preserve creator/source/package/version separately from software licenses | manifest/rights validator plus human diff against official DiceBear license inventory | Foundation + Stage 4 / Frontend, QA |
| PUB-03 | IDs derive from the normalized published bytes and generator ID; full-hash prefix collisions and hand-edited/hash-mismatched assets fail | unit fixtures for media normalization/content hashing and negative manifest fixtures | Foundation / Frontend |
| PUB-04 | Catalog renders all records below visible search/tag controls at desktop and mobile widths | component count assertion and Playwright at 1440×900, 768×1024, 390×844, 320×568 | Integrated + Stage 4 / Frontend, QA |
| PUB-05 | Labelled input and explicit Search button run case/diacritic-insensitive AND-token matching over ID/generator/preset/alt/labels/aliases; any live result uses the same predicate | table-driven unit tests including punctuation, Unicode, multi-token, button/Enter submission, live parity, and no-match cases | Foundation / Frontend |
| PUB-06 | Tag toggle buttons expose selected state and use AND semantics; tags and text combine with AND semantics | table-driven unit/component tests with zero/one/multiple tags, `aria-pressed`, and query combinations | Foundation / Frontend |
| PUB-07 | `q`/sorted `tags` URL state round-trips, deduplicates, removes unknowns, supports back/forward, and reproduces results after reload | URL codec unit tests and Playwright copied-URL/back-forward scenario | Integrated / Frontend |
| PUB-08 | Result count, clear-all, and informative no-results state are accurate and keyboard reachable | component assertions and Playwright keyboard scenario | Integrated + Stage 4 / Frontend, QA |
| PUB-09 | Download saves the selected valid asset as `<id>.<assetExtension>`, verifies its declared media type and manifest hash, and never saves a tampered/HTML/error response | action unit mocks plus Playwright download filename/media/content/hash assertion and failure fixtures | Integrated / Frontend |
| PUB-10 | Open uses the canonical absolute asset URL in a new opener-isolated context | unit URL/feature assertion plus Playwright popup URL/opener check | Integrated / Frontend |
| PUB-11 | Copy writes the same canonical absolute URL; unavailable/denied clipboard exposes usable fallback | Clipboard API success/denial component tests and manual Safari fallback | Integrated + Stage 4 / Frontend, QA |
| PUB-12 | Each action reports visible and screen-reader-readable success/failure without stale stacked messages | fake-timer component tests plus keyboard/screen-reader live-region inspection | Integrated + Stage 4 / Frontend, QA |
| PUB-13 | Broken manifest or Supabase outage gives a contained useful error; Supabase failure never removes the valid public catalog | manifest failure component test, blocked Supabase network Playwright scenario | Integrated + Stage 4 / Frontend, QA |

## Generator extensibility, rights, and provenance

| ID | Acceptance requirement | Verification method | Gate / owner |
|---|---|---|---|
| GEN-01 | The source-controlled registry accepts only API-v1 registrations and runs both the DiceBear adapter and a dependency-free synthetic raster fixture; generator/descriptor/policy IDs and approved rights must agree, while catalog/search/actions consume mixed generator/media records without generator-specific branches | registry and adapter contract suite, unsupported/mismatched/unregistered-rights fixtures, mixed-manifest tests, and PNG fixture download test | Foundation / Frontend, QA |
| GEN-02 | DiceBear generation uses exact DiceBear 10 `@dicebear/core` and `@dicebear/styles` versions, current `Style`/`Avatar` APIs and current option names; public HTTP, collection, legacy package, and legacy API use fails review/tests | lockfile/import lint, adapter unit tests, and generated provenance inspection | Foundation / Frontend, QA |
| GEN-03 | The same normalized bytes from one generator retain an ID, distinct stochastic outputs receive distinct IDs, and the full hash detects truncated-prefix collisions | deterministic/stochastic fixtures and forced-collision unit tests | Foundation / Frontend, QA |
| GEN-04 | Every asset resolves to immutable generator, rights, provenance, and exact publication-policy records; mutable provider terms have an unexpired re-review deadline; approved non-sensitive recipes and transient provider responses are excluded from the public manifest while canonical hashes and review references contain no personal data or secrets | schema/relationship tests, snapshot review, PII/secret scan, expired/stale rights-and-policy tests, and broken-reference fixtures | Foundation + Stage 4 / Frontend, QA & Security |
| GEN-05 | Unknown adapters, unapproved/restricted rights, oversized/malformed media, mismatched signatures/extensions, or validator failures stop publication without affecting an existing valid catalog; v1 publishes only records allowing all exposed public actions | registry/rights/media negative and decompression-bomb tests, restricted-rights fixtures, and atomic publication integration test | Foundation + Stage 4 / Frontend, QA & Security |
| GEN-06 | No AI adapter can publish without a provider-specific ADR and complete, immutable, unexpired owner/access/rights/safety/privacy/spend approval references linked through each asset's publication policy; hosted calls have scoped secrets, host/redirect allowlists, bounded request/concurrency/timeout/retry/spend, redacted logs, and no arbitrary provider-returned URL fetch; generation remains offline/build-time | missing/expired/mismatched approval-policy and hostile-provider fixtures plus independent ADR, terms, privacy, SSRF, resource-limit, secret, bundle, log, and release-ledger review | Adapter onboarding + Stage 4 / Owner, Engineering Lead, QA & Security |
| GEN-07 | A C2PA credential is validated when claimed; otherwise internal hashes/ledger records are described only as provenance evidence | credential-present/absent fixtures and generated notice review | Adapter onboarding + Stage 4 / QA & Security |
| GEN-08 | RFC 8785 canonical UTF-8 JSON produces the recipe hash across key order/Unicode/number fixtures; duplicate keys and non-JSON values fail before an adapter runs | cross-implementation canonicalization vectors and negative parser fixtures | Foundation / Frontend, QA |
| GEN-09 | An explicit append-only withdrawal removes an asset from the manifest and origin, purges only its exact CDN URL and proves origin/edge 404-or-410 without image bytes, preserves DB/favorite/team references, blocks new favorite/team inserts, permits owner removal, and renders an action-free unavailable tombstone; omission alone never withdraws and sensitive incident details never publish | atomic catalog-sync, origin/edge cache-purge, asset-absence, DB/RLS/function, saved-collection UI, remove-after-withdrawal, and accidental-omission fixtures | Foundation + Stage 4 / Backend, Frontend, Platform, QA & Security |

## Authentication, favorites, and Agent Teams

| ID | Acceptance requirement | Verification method | Gate / owner |
|---|---|---|---|
| AUTH-01 | Email/password sign-up validates 254-character email and 12–72 UTF-8-byte password boundaries (including multibyte input), provider minimum is 12, returns confirmation-required, and confirms through the cleaned `/auth/confirm` token-hash fragment without exposing provider details | Auth adapter/boundary/callback tests plus provider-config inspection and local Mailpit current-tab/new-tab Playwright flows, including reused/expired/malformed link | Integrated / Backend, Frontend |
| AUTH-02 | Sign-in failure is useful and non-enumerating; valid sign-in exposes authenticated controls | adapter mapping tests and Playwright invalid/valid credentials | Integrated + Stage 4 / Frontend, QA |
| AUTH-03 | Sign-out clears private UI/cache and leaves anonymous catalog usable | component cache reset test and Playwright sign-out/reload | Integrated + Stage 4 / Frontend, QA |
| AUTH-04 | Startup restores a valid session; expired/missing session becomes anonymous without blocking catalog | Auth event/state-machine tests and Playwright storage/reload fixtures | Integrated / Frontend |
| AUTH-05 | Favorite set/clear is idempotent, reflects optimistic state, persists after reload, and rolls back visibly on failure | repository/unit tests, DB duplicate tests, Playwright success and forced-network-failure flows | Integrated + Stage 4 / Backend, Frontend, QA |
| AUTH-06 | Favorites-only view contains exactly the signed-in user's saved valid avatars and has an empty state | integration test with users A/B and Playwright persisted collection | Integrated + Stage 4 / Frontend, QA |
| AUTH-07 | Team create uses one client intent UUID, trims/validates a 1–80 character name, prevents case-insensitive duplicate names, is retry safe, and database-enforces at most 50 teams per user under concurrent creates | client/DB tests for same/different payload retries, boundary names, 50/51 count, and concurrent attempts | Integrated / Backend, Frontend |
| AUTH-08 | User can list, rename, and delete only owned teams; delete requires confirmation and removes membership | DB policy/cascade tests and Playwright CRUD including cancel/confirm | Integrated + Stage 4 / Backend, Frontend, QA |
| AUTH-09 | User can add/remove unique valid avatars and persist an empty or populated team | RPC constraint tests and Playwright add/remove/reload | Integrated + Stage 4 / Backend, Frontend, QA |
| AUTH-10 | Reorder is atomic, persists exact order after reload, and rolls back UI on network/validation failure | pgTAP transaction/ordering tests, concurrent request test, Playwright drag/keyboard reorder and failure | Integrated + Stage 4 / Backend, Frontend, QA |
| AUTH-11 | A team accepts at most 100 unique valid IDs and reports actionable validation at 101, duplicate, null, or missing avatar input | pgTAP/RPC boundary cases and component error mapping tests | Integrated / Backend, Frontend |
| AUTH-12 | Team listing uses stable cursor pagination with a default 25/maximum 50 and has no duplicates or omissions across equal timestamps | repository tests over multiple pages and component load-more/end-state test | Integrated / Backend, Frontend |

## Security and privacy

| ID | Acceptance requirement | Verification method | Gate / owner |
|---|---|---|---|
| SEC-01 | RLS is enabled and grants are least-privilege on every exposed table/view/function; authenticated direct DML on all private tables fails even for owned rows/protected timestamp or ID columns | pgTAP catalog inspection and direct PostgREST DML matrix; `supabase db lint`; independent SQL review | Foundation + Stage 4 / Backend, QA & Security |
| SEC-02 | `anon` can select avatars and cannot read/write profiles, favorites, teams, or membership | pgTAP as anon for every operation | Foundation + Stage 4 / Backend, QA & Security |
| SEC-03 | User A cannot select/insert/update/delete user B's profile, favorites, teams, or membership, including guessed IDs | pgTAP matrix as users A/B plus direct REST-client negative tests | Foundation + Stage 4 / Backend, QA & Security |
| SEC-04 | Authenticated users cannot mutate `avatars`; privileged catalog sync fails rather than deleting referenced IDs | grant tests, sync integration tests with favorite/team references | Foundation / Backend |
| SEC-05 | Security-definer functions are owned by the non-table-owner `NOLOGIN NOBYPASSRLS` writer role, use empty search paths/qualified names, have exact grants/policies, validate ownership, make rename/delete/membership cross-owner indistinguishable from missing, return only generic create-collision conflict, lock transactions, reject invalid arrays, and cannot be bypassed by direct same-owner DML | pgTAP cross-owner/missing/create-collision/concurrent/rollback/direct-DML tests; inspect table/function ownership, `rolbypassrls`, writer grants/policies, execute grants, and search paths | Foundation + Stage 4 / Backend, QA & Security |
| SEC-06 | No service-role/secret key, privileged/access/refresh token, DB password, user email, or private data appears in source, generated assets, client bundle, URLs, or logs | secret scan, `dist/` string inspection, log assertions, manual DevTools network/storage review; one-time SEC-13 fragment is the documented exception | Every PR + Stage 4 / Platform, QA & Security |
| SEC-07 | Environment/Auth callback allowlists separate local, preview, and production; preview uses non-production data | configuration inspection and attempted disallowed redirect; record project refs without keys | Stage 4 + Launch / Platform, QA & Security |
| SEC-08 | Generated media passes its allowlisted bounded validator: SVG disables DTD/entities and rejects script/events, `foreignObject`, CSS/animation/filter, embedded raster, arbitrary URL/data references, invalid local fragments, and excess size/node/depth; raster media is decoded/re-encoded with disallowed metadata removed; invalid media fails generation | hostile XML entity-expansion/active-content/reference/limit and raster/polyglot/decompression-bomb fixtures, metadata scan, and browser CSP/DOM review | Foundation + Stage 4 / Frontend, QA & Security |
| SEC-09 | Team names and URL/search input render as text and cannot inject HTML/script or unsafe URLs | component/property tests with XSS payload corpus and Playwright DOM assertion | Integrated + Stage 4 / Frontend, QA & Security |
| SEC-10 | Dependency lockfile is reproducible and release has no unresolved critical/high production vulnerability without documented owner decision | `npm ci`, dependency audit/scanner, lockfile review and Stage 4 finding ledger | Every PR + Stage 4 / Platform, QA & Security |
| SEC-11 | Browser security headers meet the static-app policy: restrictive CSP, `nosniff`, referrer policy, frame denial, and appropriate permissions policy | header config test and `curl -I`/browser security panel against immutable preview | Stage 4 / Platform, QA & Security |
| SEC-12 | Auth errors do not enumerate accounts or display raw provider/SQL errors; retry rules preserve original create intent | adapter tests for provider error fixtures and manual invalid-auth review | Integrated + Stage 4 / Frontend, QA & Security |
| SEC-13 | Browser sessions use the approved session-scoped storage adapter and clear on sign-out/tab close; access/refresh tokens never enter URLs/logs, and the one-time confirmation hash is fragment-only and removed before exchange; CSP has no third-party script source | storage/callback tests plus DevTools history/network/referrer/storage/CSP/sign-out inspection and access-token string scan | Integrated + Stage 4 / Frontend, QA & Security |
| SEC-14 | Supabase Auth rate limits/abuse controls and production SMTP are configured; repeated auth attempts receive bounded non-enumerating behavior | provider configuration review and safe disposable-account rate-limit test | Stage 4 + Launch / Platform, QA & Security |
| SEC-15 | Personal/private data is minimized; account export/deletion removes Auth user and cascades app rows; retention/privacy contact is documented | schema cascade test, disposable-user deletion/export rehearsal, backup-retention and privacy runbook review | Stage 4 + Launch / Backend, QA & Security, Owner |

## Accessibility and responsive behavior

| ID | Acceptance requirement | Verification method | Gate / owner |
|---|---|---|---|
| A11Y-01 | Critical pages have semantic landmarks, one useful H1, programmatic control names, and no automated serious/critical axe violations | Testing Library role/name assertions and axe on catalog/auth/team states | Integrated + Stage 4 / Frontend, QA |
| A11Y-02 | Every action, filter, auth form, dialog, team editor, and reorder operation works with keyboard alone in logical order | manual keyboard script in Chromium, Firefox, and Safari/WebKit; Playwright keyboard coverage | Stage 4 / QA |
| A11Y-03 | Focus is always visible; opening/closing dialogs and deleting items moves/returns focus predictably; route/state changes do not strand focus | component focus assertions and manual keyboard inspection | Integrated + Stage 4 / Frontend, QA |
| A11Y-04 | Async action/auth/favorite/team success and failure are announced once with appropriate live-region urgency | DOM/live-region unit tests and screen-reader spot check (VoiceOver or NVDA) | Stage 4 / QA |
| A11Y-05 | Text, controls, focus indicators, and meaningful graphics meet WCAG 2.2 AA contrast; state is not conveyed by color alone | automated contrast scan plus manual computed-color/focus review | Stage 4 / QA |
| A11Y-06 | At 320 CSS px and 200% zoom, required content/actions remain available with no two-dimensional page scrolling | manual Chromium/Firefox zoom and 320×568 Playwright screenshots | Stage 4 / QA |
| A11Y-07 | Reduced-motion preference removes nonessential animation; no flashing or motion-dependent instruction exists | media-query component test and manual OS preference inspection | Integrated + Stage 4 / Frontend, QA |
| A11Y-08 | Avatar alternatives are concise and distinguish visible traits; decorative duplicates are hidden from assistive technology | manifest validator plus manual sample of each generator/preset/tag adapter | Foundation + Stage 4 / Frontend, QA |
| A11Y-09 | Validation associates messages to fields, identifies required format, and keeps entered non-secret values after failure | form component tests and manual screen-reader/form-error flow | Integrated + Stage 4 / Frontend, QA |

## Performance and compatibility

Release measurements use a production build with the full manifest, an empty
cache, a 390×844 viewport, Lighthouse mobile defaults (or recorded equivalent),
and at least three runs; report the median and worst run.

| ID | Acceptance requirement | Verification method | Gate / owner |
|---|---|---|---|
| PF-01 | LCP ≤2.5 s and CLS ≤0.10 on the release profile | Lighthouse/DevTools trace, three-run artifact against immutable preview | Stage 4 / QA, Platform |
| PF-02 | Total blocking time ≤200 ms on the release profile; filter input remains responsive with 500+ records | Lighthouse trace plus scripted worst-case query/filter interaction | Stage 4 / QA, Frontend |
| PF-03 | Initial application JavaScript ≤200 KiB gzip and public manifest ≤150 KiB gzip | build-size script fails above budget and publishes sizes | Every PR + Stage 4 / Frontend, Platform |
| PF-04 | Off-screen avatars use native/equivalent lazy loading and every card reserves 1:1 space before image load | component assertion, network waterfall, and CLS trace | Integrated + Stage 4 / Frontend, QA |
| PF-05 | Static content-addressed image assets have cacheable immutable headers where safe; HTML/manifest update policy cannot pin stale incompatible data | preview response-header integration test across each media type and browser cache/reload inspection | Stage 4 / Platform, QA |
| PF-06 | Critical public/authenticated flows pass current Chrome, Edge, Firefox, Safari, iOS Safari, and Android Chrome policy (automation may substitute matching Chromium/Firefox/WebKit engines) | Playwright Chromium/Firefox/WebKit desktop+mobile plus manual real-browser spot checks recorded with versions | Stage 4 / QA |
| PF-07 | Supabase outage/slow response does not delay first usable public catalog and produces bounded, cancellable authenticated loading | blocked/throttled-network Playwright trace and component timeout/abort tests | Integrated + Stage 4 / Frontend, QA |

## Preview, launch, and operations

| ID | Acceptance requirement | Verification method | Gate / owner |
|---|---|---|---|
| OPS-01 | PR CI installs with `npm ci` and runs format, lint, type-check, tests, DB tests, and production build using the documented commands | workflow inspection and successful check links for release SHA | Foundation onward / Platform |
| OPS-02 | Non-production branch produces an immutable Cloudflare Pages preview from `dist/` without production DNS mutation | preview URL, commit SHA, build log, and DNS diff/no-change evidence | Integrated / Platform |
| OPS-03 | Preview public URL, Supabase URL/key, Auth callbacks, and environment label validate against the environment contract | configuration test and preview sign-up/sign-in smoke | Integrated + Stage 4 / Platform, QA |
| OPS-04 | Runbook identifies provider/project ownership, secret locations by name (not value), build limits, failure diagnosis, and rollback | documentation review by QA/Engineering Lead | Stage 4 / Platform, QA |
| OPS-05 | Owner explicitly approves production provider access, DNS/nameserver changes, SMTP readiness, and any spend after Stage 4 passes | approval link recorded in launch issue; absence blocks Stage 5 | Launch / Owner, Platform |
| OPS-06 | Production deploy uses the exact independently approved commit and configuration; no rebuild from unreviewed source | Pages deployment SHA/artifact evidence matched to Stage 4 SHA | Launch / Platform, QA |
| OPS-07 | `https://agent-avatars.dev` serves valid TLS; apex/custom-domain and optional `pages.dev` redirect preserve path/query; no redirect loop | DNS/TLS lookup, Cloudflare custom-domain state, HTTP/browser probes | Launch / Platform, QA |
| OPS-08 | Production Auth site URL/redirects and least-privilege public key work; secret keys are absent from client/network/logs | production sign-up/sign-in smoke and repeated SEC-06 inspection | Launch / Platform, QA & Security |
| OPS-09 | Production smoke passes search/tags/download/open/copy/sign-up/sign-in/favorite/team CRUD/reorder on desktop and mobile | tagged Playwright smoke plus manual mobile check against production | Launch / QA |
| OPS-10 | Rollback to the previous known-good Pages deployment is documented, exercised or safely simulated, timed, and preserves database compatibility | rollback log/screenshot and forward-migration compatibility review | Launch / Platform, QA |
| OPS-11 | Launch record captures production URL, release SHA, Pages deployment URL, Supabase project ref, DNS/TLS evidence, known limitations, and named rollback owner | final release checklist review; no secret values | Launch / Platform, Engineering Lead |

## Release decision rule

Stage 4 passes only when every applicable row through `PF-*` and `OPS-01` through
`OPS-04` has evidence and no critical/high security, privacy, accessibility,
data-loss, or core-flow finding is unresolved. Medium/low findings need an owner,
issue, and explicit release disposition. Stage 5 passes only after `OPS-05`
approval and all `OPS-*` launch rows succeed against the exact reviewed commit.
