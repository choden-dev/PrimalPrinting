# Agent Instructions

## Environment Variable Sync

Ensure all environment variables are defined, consistent, and up-to-date across **every** touchpoint in the project. Apply this rule whenever adding, renaming, or removing an env var.

### Process

When an env var change is requested:

1. **Discover all touchpoints** — scan the project for every file that references env vars.
2. **Apply changes holistically** — update every touchpoint in a single pass.
3. **Verify consistency** — confirm no stale names, missing entries, or duplicates remain.

### Discovery: finding env var touchpoints

Search the project for all locations that define, declare, or consume environment variables:

#### Source code
- Grep for `process.env.`, `import.meta.env.`, `env.`, `os.environ`, `os.Getenv`, `System.getenv`, or equivalent patterns for the project's language/framework.
- Check for typed env declarations (e.g. `env.d.ts`, `.env.d.ts`, `environment.d.ts`, `config.ts`, `settings.py`, etc.).

#### Configuration & infrastructure
- **Env files**: `.env`, `.env.local`, `.env.example`, `.env.production`, `.env.development`, `.env.test`, etc.
- **Docker**: `Dockerfile` (`ENV`, `ARG`), `docker-compose.yml` (`environment:`, `env_file:`), entrypoint scripts.
- **CI/CD**: GitHub Actions (`.github/workflows/*.yml`), GitLab CI, Bitbucket Pipelines, etc. — look for `env:` blocks and secret references.
- **IaC**: Terraform (`variables.tf`, `*.tfvars`), CloudFormation, Pulumi, etc.
- **Platform config**: `wrangler.toml`/`wrangler.jsonc` (Cloudflare), `vercel.json`, `netlify.toml`, `app.yaml` (GCP), `fly.toml`, etc.
- **Container orchestration**: Kubernetes manifests (`env:`, `envFrom:`, ConfigMaps, Secrets), Helm `values.yaml`.
- **Worker/edge entrypoints**: Files that pass env vars from a runtime into a container or subprocess (e.g. Cloudflare Container workers, Lambda handlers).

#### Client-side env vars (framework-specific)
- **Next.js**: `NEXT_PUBLIC_*` — inlined at build time, needs special handling in Docker (placeholder + entrypoint replacement).
- **Vite**: `VITE_*` — same build-time inlining concern.
- **Create React App**: `REACT_APP_*` — same concern.
- If the project uses Docker, check for a placeholder/entrypoint pattern and keep it in sync.

### Rules

1. **One canonical name per value.** Never maintain two separate secrets/vars that hold the same value. If compatibility aliases are needed, derive them from the canonical var in a single location.

2. **Client-exposed vars** (e.g. `NEXT_PUBLIC_*`, `VITE_*`) that are inlined at build time need special handling in Docker:
   - Placeholder `ENV` in the Dockerfile build stage.
   - Entrypoint script replacement entry to swap placeholders with real values at container startup.

3. **Server-only vars** only need entries in the type declarations, runtime config, and env files — no build-time placeholder pipeline.

4. **When removing a var**, check every discovered touchpoint and remove from each.

5. **When renaming a var**, treat it as a remove + add. Update all touchpoints and note the rename in the PR/commit description so deployment configs (cloud dashboards, CI secrets, etc.) can be updated.

6. **Defaults** should be consistent — if the code falls back to `"2"`, the entrypoint script default, Docker placeholder default, and env file value should all agree.

### Checklist

After discovering the project's specific touchpoints, use a checklist like this (adapt to the project):

```
- [ ] Type declarations (e.g. env.d.ts) — added/updated/removed
- [ ] Runtime config / worker entrypoint — added/updated/removed
- [ ] Dockerfile — placeholder ENV added/removed (client-exposed vars only)
- [ ] Docker entrypoint script — replacement entry added/removed (client-exposed vars only)
- [ ] Local env file (.env.local / .env) — added/updated/removed
- [ ] Example env file (.env.example) — added/updated/removed
- [ ] CI/CD workflows — secret references added/updated/removed
- [ ] IaC (Terraform, etc.) — variable added/updated/removed (if applicable)
- [ ] Platform config (wrangler, vercel.json, etc.) — added/updated/removed
- [ ] No duplicate/alias env vars introduced
- [ ] Defaults are consistent across all touchpoints
```
