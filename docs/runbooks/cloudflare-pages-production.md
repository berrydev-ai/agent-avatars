# Cloudflare Pages production deployment

## Trigger and safety boundary

`.github/workflows/pages-production.yml` deploys after the `CI` workflow
completes successfully for a push to `main`. Before credentials are available,
the workflow verifies that the exact CI commit is the merge commit of a pull
request whose base branch is `main`.

Direct pushes, failed CI runs, manual CI dispatches, and commits that are not
associated with a merged pull request do not deploy. The workflow uploads the
verified commit to the Cloudflare Pages project's configured `production`
branch. It does not change DNS, domains, Supabase data, or Cloudflare project
settings.

## GitHub environment

Create an unreviewed GitHub environment named `cloudflare-production`. A
required reviewer would turn the automatic deployment into a manual deployment.
Restrict the environment deployment branch policy to `main`.

Store these environment secrets:

- `CLOUDFLARE_API_TOKEN`: a dedicated token with Account / Cloudflare Pages /
  Edit for the Berry Development account. Do not grant DNS, zone, billing, or
  unrelated product permissions. The current `agent-avatars-github-pages`
  token expires September 1, 2027; rotate it before that date.
- `CLOUDFLARE_ACCOUNT_ID`: the Berry Development account identifier.

Store these environment variables:

- `CLOUDFLARE_PAGES_PROJECT`: `agent-avatars`.
- `VITE_SUPABASE_URL`: the production Supabase HTTPS origin.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: the public production publishable key. Never
  use a secret or service-role key.

All `VITE_*` values are embedded into browser assets and are public. Rotate the
Cloudflare token in both Cloudflare and the GitHub environment if it is exposed.

## Deployment path

1. Merge a pull request into `main` after its required checks pass.
2. Confirm the push-triggered `CI` run succeeds for the merge commit.
3. Confirm `Cloudflare Pages production` verifies the associated pull request,
   builds with the production environment contract, and deploys `dist/`.
4. Record the workflow summary's commit, deployment ID, and immutable URL.
5. Verify `https://agent-avatars.dev` serves the new commit's application.

The production build rejects the wrong Pages branch, a non-40-character commit
SHA, a non-production app environment, any canonical URL other than
`https://agent-avatars.dev`, an invalid Supabase URL/key, common secret markers,
and Pages artifact-limit violations.

## Failure diagnosis

| Symptom | Cause to check | Recovery |
|---|---|---|
| Workflow is skipped | Upstream CI was not a successful push run on `main` | Fix CI or merge through a pull request |
| Merge verification fails | The commit was pushed directly or is not the PR merge commit | Revert the direct push and use a pull request |
| Environment values are empty | Missing `cloudflare-production` secrets or variables | Add the named setting; never print its value in logs |
| Production context is rejected | Wrong Pages branch, SHA, site URL, or public Supabase value | Correct the protected environment or workflow contract |
| Wrangler is unauthorized | Missing, expired, or incorrectly scoped Cloudflare token | Rotate a Pages Edit token scoped to the intended account |
| Deployment is a preview | Wrangler branch differs from the project's `production` branch | Restore `--branch=production` |

## Rollback

Cloudflare Pages retains immutable deployments. In Cloudflare Pages, select the
previous known-good production deployment and use **More actions → Rollback**.
Verify `https://agent-avatars.dev` after rollback. A static rollback does not
reverse Supabase migrations, so database changes must remain backward
compatible.

The latest known-good deployment and its commit must be recorded before merging
a release. Do not delete production deployments as part of rollback.

## References

- [Cloudflare Pages Direct Upload with CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- [Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [GitHub Actions workflow run event](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run)
- [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
