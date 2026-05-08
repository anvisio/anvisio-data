# Contributing to anvisio-data

> **Status:** This repo is not yet accepting external PRs. v0 launches internal-only while Anvisio validates the pipeline. Phase 9 opens external contributions after the first SaaS validations land clean.

## Three ways to contribute

### 1. Add a new SaaS

You use a SaaS Anvisio doesn't yet support? Run the plugin's onboarding pipeline against it, then contribute the resulting manifest:

1. Install the Anvisio plugin
2. Open the side panel on the SaaS in question; run `/onboard-saas <integration_id>`
3. Plugin walks the 5-step pipeline using your BYOK Anthropic key (~10-30 min, ~$2-10 in API costs)
4. After tests pass locally, click **"Contribute to community"** in the side panel
5. Plugin opens a fork + pushes a PR to `anvisio-data:main` titled `feat: add <saas> manifest (X/Y verbs)`
6. Maintainers review, suggest fixes for any surrendered verbs, merge
7. Within 7 days of merge, every Anvisio user has support for that SaaS

### 2. Fix a bug in an existing manifest

Hit a broken recipe? The plugin's heal pipeline catches it locally and may auto-promote a fix:

1. Plugin's heal LLM probes the page, proposes a `manifest_diff` patch
2. Recipe retries with the patch, succeeds (or surrenders)
3. Plugin's eval module reviews the session log, flags high-confidence patches as "promotable"
4. You're prompted: "We learned a fix for `<saas>`. Contribute it?"
5. Click yes — plugin opens a PR against `manifests/<saas>/<file>.yaml` with the patch + session-log evidence link

### 3. Refine a prompt or widget library

Advanced contributors may want to iterate on `prompts/propose.md` or a per-platform widget library. These are shared across all SaaS so PRs require:
- A regression-test claim (multi-SaaS replay against a session-log fixture set)
- `anvisio-core` team approval
- A specific session-log link demonstrating the issue

Open the PR, the CI gates handle validation. Maintainers review.

## CI gates (run on every PR)

All gates must pass before merge. CI runs in `pull_request` mode (sandboxed; no secrets exposed to forks) on first-time contributor PRs.

| # | Gate | What it checks |
|---|---|---|
| 1 | Frontmatter | Every changed file has well-formed `_meta:` / frontmatter / `$comment.data_cdn_meta`; required fields present per [spec 60.3 §3.4](https://github.com/anvisio/anvisio/blob/main/planning/tech_design/architecture/60.3-data-cdn-schema.md#34-required-fields) |
| 2 | Schema | YAML files validate against their JSON Schema (manifests against `schemas/manifest-v60.json`, etc.) |
| 3 | Version bump rule | New `version` is greater than prior; bump type matches change scope per [spec 60.3 §3.5](https://github.com/anvisio/anvisio/blob/main/planning/tech_design/architecture/60.3-data-cdn-schema.md#35-versioning-rules) |
| 4 | Cross-ref integrity | `related_*` fields point at files that exist + are not retired |
| 5 | Manifest test catalog replay | For PRs touching `manifests/<saas>/`, the test catalog runs against a recorded fixture (snapshot replay; not live SaaS) |
| 6 | License | New files carry the MIT license header; no GPL / proprietary content |
| 7 | PII scrub | Session-log artifacts in PRs don't contain emails, phone numbers, names from common fixtures |
| 8 | Size | No file exceeds 200 KB without explicit override (`gate-override: size` label on the PR) |

Gate 5 is the strongest one: a PR that breaks an existing recipe can't merge.

## DCO sign-off

Every commit must include a `Signed-off-by: Your Name <email>` line. This is the [Developer Certificate of Origin](https://developercertificate.org/) — by signing off you confirm you have the right to contribute the change under MIT.

`git commit -s` adds the line automatically. PRs with un-signed commits are blocked by CI.

## Branch policy

- `main` — dev. Internal Anvisio + maintainers merge here first. CI runs on every PR.
- `beta` — auto-cut from `main` daily. Power users with "early access" toggled fetch this channel.
- `release` — weekly cut from `main`. Default channel; what end-users get.

Tags are cut from `release` (e.g. `v2026.5.7`). The plugin's bundled fallback pins to the latest stable tag at build time.

## File format conventions

| Type | Frontmatter container | Required fields |
|---|---|---|
| Markdown (`.md`) | `---` YAML block at top of file | `name`, `version`, `cdn_schema_version`, `description`, `authored_at` |
| YAML (`.yaml`) | Top-level `_meta:` key (real key, parser-friendly) | Same |
| JSON (`.json`) | `$comment.data_cdn_meta` object | Same |

`name` carries the file extension (e.g. `prompts/propose.md`, NOT `prompts/propose`). Aligns with the session-log `prompt_name` so eval can resolve directly.

`cdn_schema_version` refers to the version of the data-CDN protocol this file was authored against (currently `60.3.0`). Distinct from the session-log schema version.

## Versioning rules

Files use semver:

- **Patch** (3.2.0 → 3.2.1): copyedits, typo fixes, clarifications. No behavior change.
- **Minor** (3.2.0 → 3.3.0): new sections, new examples, new optional behavior. Backward-compatible.
- **Major** (3.2.0 → 4.0.0): breaking change in input/output contract. Plugin pins to compatible major; explicit upgrade required.

The CI gate validates that PRs bump the version appropriately.

## Maintainer responsibilities

Per-directory maintainers (CODEOWNERS):

- Review PRs touching their directory within 7 days
- Run the manifest replay locally against a recent live SaaS state when CI's recorded fixture might be stale
- Tag `anvisio-core` for shared-file PRs (prompts, schemas, widget-libraries cross-platform changes)

Inactive maintainers age out after 6 months of no activity.

## Forks for personal / org customization

Anyone can fork this repo and point their plugin at the fork:

```
plugin settings:
  data_origin: github_cdn
  github_repo: my-org/anvisio-data       (default: anvisio/anvisio-data)
  release_channel: release                (default: release)
```

Useful for:
- Industry-specific prompt overlays your org doesn't want to upstream
- Internal SaaS that aren't worth contributing publicly
- Iterating on changes before opening a PR

Forks lose upstream improvements unless synced.

## Spec references

- [Spec 60.3 — Data CDN schema (full design)](https://github.com/anvisio/anvisio/blob/main/planning/tech_design/architecture/60.3-data-cdn-schema.md)
- [Spec 60.3 §13.5 — The three contribution flows in detail](https://github.com/anvisio/anvisio/blob/main/planning/tech_design/architecture/60.3-data-cdn-schema.md#135-contribution-flow)
- [Spec 60.3 §13.7 — Trust model](https://github.com/anvisio/anvisio/blob/main/planning/tech_design/architecture/60.3-data-cdn-schema.md#137-trust-model)
