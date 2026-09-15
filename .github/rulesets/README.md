# Repository rulesets

GitHub **rulesets** are configured on the repository (not applied automatically from this folder). This directory holds the intended policy and a script to apply it.

## Policy (`config.json`)

For branches **`main`** and **`develop`**:

| Rule | Behavior |
|------|----------|
| **Required status check** | CI workflow job `test` must pass before merge |
| **Pull request reviews** | 1 approving review required |
| **Owner bypass** | The **repository owner** may bypass **review** requirements only (`pull_request` bypass mode). CI is still required on their PRs |

When you run the apply script, it looks up the owner via the GitHub API:

- **User-owned** repos: bypass is granted to the owning user account.
- **Organization-owned** repos: bypass is granted to **organization admins** (GitHub’s `OrganizationAdmin` bypass actor).

## Apply the ruleset

After pushing `.github/workflows/ci.yml`, run CI at least once on a PR so the `test` check exists in the branch protection UI.

```bash
# Fine-grained or classic PAT with Administration (write) on the repo
export GITHUB_TOKEN=ghp_...
node scripts/apply-github-rulesets.mjs
```

Dry-run (prints JSON without creating/updating the ruleset):

```bash
GITHUB_TOKEN=ghp_... node scripts/apply-github-rulesets.mjs --dry-run
```

Override owner/repo:

```bash
node scripts/apply-github-rulesets.mjs --owner my-account --repo blessMeter
```

## CI workflow

Tests run via [`.github/workflows/ci.yml`](../workflows/ci.yml) on push and pull requests targeting `main` or `develop`.
