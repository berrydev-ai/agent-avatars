# Cloudflare Pages preview runbook

## Purpose and safety boundary

This runbook publishes a reviewed non-production commit as a Cloudflare Pages
Direct Upload preview. It does not create or update a production deployment,
custom domain, DNS record, nameserver, Cloudflare zone, Supabase production
project, or paid plan.

The workflow uses a branch named `preview-<full-commit-sha>`. Cloudflare gives
each upload an atomic hash URL, while the SHA-specific branch alias is never
reused for different source. Record both the deployment URL and commit SHA as
release evidence; do not use a moving branch alias as immutable evidence.

## Ownership

| Responsibility | Owner |
|---|---|
| Approve provider access and any spend | Workspace owner |
| Maintain CI, preview workflow, Pages limits, and this runbook | Platform Engineer |
| Own the non-production Pages project and scoped API token | Workspace owner / Platform Engineer |
| Own the non-production Supabase project and Auth callback allowlist | Backend Engineer |
| Verify preview behavior and evidence independently | QA & Security Engineer |
| Resolve shared package/script contract changes | Frontend Engineer / Engineering Lead |

The GitHub environment is named `cloudflare-preview`. Configure it with required
human reviewers so a manual dispatch cannot deploy until the owner approves it.

## One-time setup

1. Obtain explicit owner approval for non-production Cloudflare access and
   confirm the selected account/project stays within the intended free plan.
2. Create a dedicated Direct Upload Pages project. Set an unused production
   branch such as `production`; this workflow rejects `main`, `master`, and
   `production` and always passes a SHA-specific preview branch to Wrangler.
3. Create the protected GitHub environment `cloudflare-preview` with required
   reviewers and no deployment branch matching `main`, `master`, or
   `production`.
4. Add these environment secrets:
   - `CLOUDFLARE_API_TOKEN`: scoped to Account / Cloudflare Pages / Edit for the
     one preview account. Exclude Zone DNS, domain, billing, and unrelated
     account permissions.
   - `CLOUDFLARE_ACCOUNT_ID`: the selected preview account identifier. The value
     is not browser data and remains in the protected environment.
5. Add these environment variables:
   - `CLOUDFLARE_PAGES_PROJECT`: the dedicated Direct Upload project name.
   - `VITE_SUPABASE_URL`: the non-production Supabase HTTPS origin.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: the public publishable key, never a
     secret/service-role key.
6. In non-production Supabase Auth, allow the exact SHA preview URL for
   `/auth/confirm`. Use a reviewed `https://*.agent-avatars.pages.dev` callback
   pattern only if the provider supports and the team approves it.

All `VITE_*` values are public because Vite embeds them into browser JavaScript.
Never store `CLOUDFLARE_API_TOKEN`, `SUPABASE_ACCESS_TOKEN`,
`SUPABASE_DB_PASSWORD`, a Supabase secret key, or a service-role key in a
`VITE_*` variable, repository file, workflow output, or deployment artifact.

## Deploy a preview

1. Confirm the pull request CI check is green for the exact commit.
2. Select **Actions → Cloudflare Pages preview → Run workflow**, and choose the
   non-production branch containing that commit.
3. Approve the `cloudflare-preview` environment deployment.
4. Record the workflow summary's commit SHA, deployment ID, immutable deployment
   URL, and SHA alias.
5. Verify the root page, a client-side route, an avatar asset, the manifest,
   Auth callback configuration, CSP, cache headers, and Cloudflare's
   `X-Robots-Tag: noindex` preview header.

The workflow reruns all repository quality gates, builds from the lockfile,
derives `VITE_PUBLIC_SITE_URL` from the SHA-specific Pages URL, generates
environment-specific `_headers`, rejects production branches, scans common
secret markers, and checks provider file limits before upload.

## Failure diagnosis

| Symptom | Check | Recovery |
|---|---|---|
| `npm ci` fails | `package-lock.json` matches `package.json`; Node matches `.nvmrc` | Regenerate and review the lockfile on its owning scaffold branch |
| Formatting, lint, types, tests, or build fail | First failing named step and the same local command | Fix the underlying gate; do not skip it |
| Database tests fail | Docker availability, Supabase CLI output, migration order | Reproduce with `npm run test:db`; never point the test at production |
| Preview context is rejected | Branch name, full SHA, Pages URL, public Supabase URL/key | Correct protected environment configuration; never substitute production values |
| Wrangler returns unauthorized | Token scope, account ID, project ownership, expiration | Rotate/re-scope the protected token; do not broaden it to DNS |
| Auth callback fails | Exact preview origin and `/auth/confirm` allowlist | Add only the reviewed non-production callback |
| CSP blocks Supabase | Generated `dist/_headers` HTTPS/WSS origins | Correct `VITE_SUPABASE_URL`, rebuild, and inspect response headers |
| Pages rejects the upload | File count, largest file, project plan, Wrangler output | Reduce/split artifacts or seek explicit owner approval for a plan change |
| Root or client route returns 404 | `dist/index.html` exists and no top-level `404.html` disables Pages SPA fallback | Fix the build output and redeploy the same reviewed commit |

## Limits and budgets

The wrapper enforces the Cloudflare Pages Free-plan artifact limits relevant to
this static site: at most 20,000 files and at most 25 MiB per file. As of
2026-08-27, Cloudflare also documents 500 builds per month, one concurrent build,
a 20-minute build timeout, 100 `_headers` rules with 2,000 characters per
line, 2,100 redirects, and unlimited active preview deployments on the Free
plan.

Paid plans can raise the file count to 100,000 when configured as documented,
but changing plans or enabling paid capacity is out of scope without owner
approval. Recheck the current limits before launch:
<https://developers.cloudflare.com/pages/platform/limits/>.

## Rollback and cleanup

A preview rollback does not touch production. Return testers to the previously
recorded immutable deployment URL, or dispatch the workflow at the earlier
reviewed commit to create fresh evidence. Database migrations must remain
forward-compatible; a static preview rollback does not reverse remote schema.

Deleting preview deployments is optional cleanup, not rollback. It is a
destructive provider action and requires approval. Cloudflare does not allow the
latest deployment for a branch to be deleted. Never use this preview workflow to
promote, roll back, or mutate a production project.

## Local and configuration verification

Run the same quality commands used by CI:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:db
node --test scripts/pages-config.test.mjs
npm run build
npm audit --audit-level=high
```

To exercise only the Pages wrapper locally, supply safe non-production values
for `CF_PAGES=1`, a non-production `CF_PAGES_BRANCH`, a full
`CF_PAGES_COMMIT_SHA`, a `*.pages.dev` `CF_PAGES_URL`,
`VITE_APP_ENV=preview`, and the public non-production Supabase values, then run
`node scripts/pages-build.mjs`. Never paste credentials into shell history.

Validate workflow syntax with `actionlint` and inspect `dist/_headers` before the
first provider deployment.

## Production separation

Production remains a separate launch task. It requires the independently
approved release commit, explicit owner authorization for provider access,
custom-domain/DNS or nameserver changes, credentials, and spend. This preview
workflow contains no custom-domain or DNS command and rejects production branch
names.
