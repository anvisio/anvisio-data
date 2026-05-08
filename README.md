# anvisio-data

Public data CDN for the [Anvisio](https://anvisio.com) Chrome plugin: prompts, widget libraries, manifest schemas, and (over time) per-SaaS manifests that anyone can contribute to.

## What lives here

```
prompts/                     LLM prompts the plugin loads at runtime
  intent.md                  Stage 1: research SaaS → produce intent.yaml
  propose.md                 Stage 3: discovery + intent → produce manifest bundle
  heal.md                    Heal LLM system prompt (probes DOM via tools)
  eval.md                    Post-onboarding eval (session log → improvement proposal)

widget-libraries/            Per-platform widget vocabularies
  lightning.widgets.yaml     Salesforce Lightning (9 widgets, all SF orgs reuse)
  gmail.widgets.yaml         Gmail
  microsoft365.widgets.yaml  (future) Outlook + To Do + Teams
  google-workspace.widgets.yaml (future) Drive + Calendar + Docs

schemas/                     JSON Schema definitions
  manifest-v60.json          Spec 60 manifest format (generated; do not hand-edit)
  intent-v60.json            intent.yaml shape
  test-catalog-v60.json      test_catalog.json shape

tools/                       Tool catalogs for tool-using LLMs
  heal-tools.json            Anthropic tool definitions for heal LLM (per spec 60.2)

manifests/                   (future, Phase 9) Per-SaaS complete manifests
  <saas>/
    <saas>.md                Human description
    apis.yaml                API endpoint definitions
    widgets.yaml             Per-SaaS widget overrides (extends widget-libraries/<platform>.widgets.yaml)
    schemas/                 Entity schemas
    views/                   View definitions
    actions/                 Per-verb action recipes (one file per verb)
    test_catalog.json        Generated test enumeration
```

## How the plugin uses this repo

The Anvisio Chrome plugin fetches data from this repo via [jsDelivr](https://www.jsdelivr.com/):

```
https://cdn.jsdelivr.net/gh/anvisio/anvisio-data@<channel>/<path>
```

`<channel>` is one of:
- `release` — what end-users get (default; updated weekly from `main`)
- `beta` — power users with "early access" toggled (auto-cut from `main` daily)
- `main` — internal Anvisio team + maintainers (direct merges land here first)

Plugin checks for updates at boot + every 24h. Bundled fallback ships with each plugin release so nothing breaks if jsDelivr is down.

## Contributing

**This repo is not yet open for external PRs.** v0 launches with internal-only contributions while Anvisio validates the end-to-end pipeline (Phases 2-8 of [spec 60.1](https://github.com/anvisio/anvisio/blob/main/planning/impl_plans/60.1-plugin-runtime-pivot.md)). Phase 9 opens contributions publicly after the first SaaS validations land clean.

When the repo opens, see [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- The three contribution flows (new SaaS, bug fix, prompt refinement)
- DCO sign-off requirements
- CI gates (8 automated checks before merge)
- CODEOWNERS for per-directory maintainers

## Architecture

For the full design, read the spec docs:
- [Spec 60.1 — Verbose session logging schema](https://github.com/anvisio/anvisio/blob/main/planning/tech_design/architecture/60.1-verbose-logging-schema.md)
- [Spec 60.2 — Tool-use heal LLM schema](https://github.com/anvisio/anvisio/blob/main/planning/tech_design/architecture/60.2-tool-use-heal-schema.md)
- [Spec 60.3 — Data CDN schema (this repo)](https://github.com/anvisio/anvisio/blob/main/planning/tech_design/architecture/60.3-data-cdn-schema.md)

## File format conventions

Every file carries machine-readable metadata in a format native to its file type:

| File type | Container |
|---|---|
| Markdown (`.md`) | YAML frontmatter (`---` block at top) |
| YAML (`.yaml`) | Top-level `_meta:` key |
| JSON (`.json`) | `$comment.data_cdn_meta` field |

All three carry the same fields: `name` (path with extension), `version` (semver), `cdn_schema_version`, `description`, `authored_at`, optional `authored_by`, `changelog`, `related_*` cross-refs.

## License

[MIT](./LICENSE). Pull request authors retain copyright on their contributions; merging is governed by the project's DCO sign-off requirement.

---

*This repo's tooling, CI, and release process is documented in [CONTRIBUTING.md](./CONTRIBUTING.md). The data files themselves are governed by [spec 60.3](https://github.com/anvisio/anvisio/blob/main/planning/tech_design/architecture/60.3-data-cdn-schema.md).*
