# Agent Avatars

A searchable library of deterministic, pre-generated agent avatars. The MVP
adds public download/open/copy actions, Supabase-backed accounts and favorites,
and user-owned Agent Teams, delivered as a React/Vite application on Cloudflare
Pages.

## Architecture baseline

Implementation starts from these approved documents:

- [`tasks/plan.md`](tasks/plan.md) — staged delivery plan and ownership
- [`docs/specs/mvp.md`](docs/specs/mvp.md) — product and engineering specification
- [`docs/decisions/0001-mvp-architecture.md`](docs/decisions/0001-mvp-architecture.md) — architecture decision record
- [`docs/contracts/mvp-contracts.md`](docs/contracts/mvp-contracts.md) — avatar, data, client, environment, and licensing contracts
- [`docs/acceptance-test-matrix.md`](docs/acceptance-test-matrix.md) — executable release requirements

The application scaffold and executable commands are delivered in Stage 2.
Until then, documentation integrity is checked with:

```sh
git diff --check
```
