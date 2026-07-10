---
name: manifests/github/github.md
version: 0.1.0
cdn_schema_version: 70.0.0
authored_by: cd2k + claude
authored_at: 2026-06-01
---

# GitHub

Web app at `https://github.com`. Server-rendered MPA + Turbo (NOT a
SPA) — navigation between screens is full-page / Turbo-frame
navigation keyed on URL, not hash routing. The web UI authenticates via
the user's logged-in session cookie; the REST + GraphQL API at
`https://api.github.com` authenticates via OAuth bearer token or a
Personal Access Token (PAT); the MCP server authenticates via OAuth 2.1
or a PAT.

Primary objects (`schemas/`): **Issue** PK `(owner, repo, number)`,
**PullRequest** PK `(owner, repo, number)` — both composite — plus
**Repository** PK `(full_name)` and **User** PK `(login)`. Issues and
PRs share one number sequence per repo (PRs are issues at the REST
layer), so `/issues/{n}` redirects to `/pull/{n}` when `{n}` is a PR.

> STATUS (2026-06-01): github has NOT had a live browser-flavor
> hardening session. Everything in the **DOM gotchas** and **L4 commit
> signals** sections below that would normally hold live-probed facts is
> a placeholder. The L4 table reflects only the signals the
> `actions/*.yaml` browser flavors ALREADY declare (not yet validated
> against a real tab). Selectors live in `widgets.yaml`; capture
> per-action L4 signals + real DOM gotchas here when github is first
> hardened (use `/harden-browser-flavor github <verb>`).

## Sources feeding propose

The three upstream sources (per the top-level CLAUDE.md flywheel):

1. **MCP catalog** (`_mcp_tools.yaml`) — 25 tools (the daily-driver
   subset of the official server's 80+ tools across 17 toolsets),
   `transport: http`. Anchored on the official
   `github/github-mcp-server` (remote `https://api.githubcopilot.com/mcp/`,
   or local Docker stdio); `server.source_url` + `server.fetched_at` are
   stamped for provenance. Covers context (`get_me`), repos
   (`search_repositories`, `get_file_contents`, `create_or_update_file`,
   …), issues (`issue_read`, `issue_write`, `add_issue_comment`,
   `list_issues`, `search_issues`, …), pull_requests (`create_pull_request`,
   `merge_pull_request`, `pull_request_read`, …), actions/CI, and users.
   Each atom whose verb maps to an MCP tool carries
   `mcp_tool: github.<tool>` pointing back at the catalog entry
   (e.g. `create_issue` → `issue_write`, `update_issue` → `issue_write`,
   `get_issue` → `issue_read`).

2. **Web research** — GitHub's REST v3 / GraphQL v4 surface is
   exhaustively documented, so research grounds the endpoint patterns,
   auth scopes, search syntax, and merge-method constraints captured in
   `apis.yaml`.

3. **Live DOM** — the `widgets.yaml` selectors were seeded from
   `planning/tech_design/integrations/platform-notes/dom-selectors-github.md`
   (2026-03-21) + GitHub's stable role/aria patterns. They have NOT been
   re-verified live in a hardening session; `enumerate_widgets` / heal
   will confirm or patch them on first run.

## Transport priority (spec 70 §7)

Derived from how each atom orders its `flavors:` blocks (read
`actions/*.yaml`):

- **Writes** (`commits_changes: true`) declare flavors in the order
  **browser > mcp > oauth_api**, so spec 70 §7 prefers the **browser**
  flavor — the user sees (and, per the launch contract, clicks the
  final Submit / Confirm / Comment on) the actual write in their GitHub
  tab. Trust + visibility matter for writes. The mcp + oauth_api flavors
  cover the headless / batch path.
  - `create_issue`, `update_issue`, `add_issue_comment`,
    `merge_pull_request` — all browser → mcp → oauth_api.
- **Reads** (`commits_changes: false`) declare **mcp > oauth_api** with
  **NO browser flavor** — one REST/MCP call returns the canonical object
  shape, far more reliable than scraping paginated MPA HTML. (An early
  browser read flavor that returned `literal:[]` / `literal:{}` was
  dropped because it broke callers expecting real objects — see
  `get_issue` / `list_issues` changelog 0.2.0.)
  - `get_issue`, `list_issues`, `search_issues` — mcp → oauth_api only.
- **`open_record`** is a pure navigation primitive: **browser-only**, no
  `mcp_tool`, read-only (`commits_changes: false`). It just navigates to
  `/{owner}/{repo}/{record_path}`.

This is the inverse-by-kind pattern (writes prefer browser, reads prefer
API) — the same shape as Gmail, but note GitHub's reads are
API-ONLY (Gmail keeps a browser read flavor; GitHub deliberately does
not, because there's a clean public REST and the DOM list is paginated).

A `session_api` transport exists in `apis.yaml` in principle (the web
app would take the session cookie), but **no atom wires a `session_api`
flavor** — the public REST (`oauth_api`) is the cleaner default. If
session-cookie writes are added later they'd target undocumented
internal endpoints.

## DOM gotchas

**None consolidated yet — github has not had a live browser-flavor
hardening session as of 2026-06-01.** Selectors live in
`widgets.yaml`; capture per-action DOM gotchas here when github is first
hardened (real selector drift, state-dependent buttons, shadow DOM,
detached-list caches, etc.). The cross-integration methodology to apply
when you do is [atom-methodology.md](../../onboarding/prompts/atom-methodology.md)
(5 layers, signal-type table, traps, authoring rules A-H).

Known-FRAGILE-but-UNVERIFIED selectors already flagged in the manifest
(probe these FIRST when hardening — do not treat as confirmed gotchas
until a live probe lands):

- **Merge buttons are text-anchored.** `github.merge_pull_request_button`
  and `github.confirm_merge_button` use
  `:has-text('Merge pull request' | 'Squash and merge' | 'Rebase and merge')`
  (and the matching Confirm variants). Text anchors are brittle to i18n,
  label rewording, and the button being disabled by branch protection.
  See [app_model.yaml](app_model.yaml) `known_dead_paths.merge_button_has_text_fragility`.
- **`/issues/new` template-picker interstitial.** On repos with issue
  templates, `/issues/new` shows a chooser before the form mounts, so
  `create_issue`'s title-input landmark may be absent until a template is
  picked. The browser recipe does NOT handle this yet. See
  `known_dead_paths.new_issue_template_picker_unhandled`.
- **Sidebar pickers (Assignees / Labels / Milestones / Projects) have no
  widget** — deferred because they need an open-picker + select-option +
  verify composite the current archetypes don't model. Those edits route
  through mcp/oauth_api today; heal-time will author the browser pickers.
  See `known_dead_paths.sidebar_pickers_deferred`.

## L4 commit signals

These are the L4 outcome signals the browser-flavor write atoms ALREADY
declare in `actions/*.yaml` — summarized here verbatim, **not yet
validated against a live tab**. When github is first hardened, confirm
each one with the discard test (per [atom-methodology.md](../../onboarding/prompts/atom-methodology.md)
Rule A) and capture the real success surface (a GitHub toast/flash, the
state-badge flip, or the timeline delta) below.

| Atom | commits_changes | Browser L4 signal (as declared) | Kind |
|---|---|---|---|
| `add_issue_comment` | true | `selector_appears "[data-testid='issue-comment'], .timeline-comment"` (the posted comment renders) | positive rung (selector_appears) |
| `create_issue` | true | `url_matches "/issues/(?<number>[0-9]+)$"` (lands on the new issue's page; `number` is extracted from the URL) | positive rung (url_matches) |
| `merge_pull_request` | true | `selector_appears "[class*='State']:has-text('Merged')"` (the PR state badge flips to Merged) | positive rung (selector_appears) |
| `update_issue` | true | `network_response github.com/*/*/issues/* status 200` (observes the real PATCH-equivalent write rather than an already-on-page badge) | positive rung (network_response) |
| `open_record` | false (nav) | `url_matches "^https://github\\.com/[^/]+/[^/]+"` | n/a (read/nav) |

All four write atoms carry a POSITIVE rung (not a lone
`selector_disappears`), so they pass the Trap-2 gate in
`integration-completeness.test.ts` (check 5). NOTE these signals are
plausible-but-unprobed: the comment/merge selectors should be confirmed
against the real DOM, and `update_issue`'s `network_response` pattern
(`github.com/*/*/issues/*`) targets the web app's own write traffic — a
hardening session must verify GitHub actually fires a matching request
on Close and that the pattern isn't too broad. The READ atoms
(`get_issue`, `list_issues`, `search_issues`) and the API flavors use
`network_response` on the api.github.com / `*/mcp/*` endpoints with the
documented status codes (200 for GETs, 201 for the REST create/comment
POSTs) — see each action file.

## Known gaps

- **No live hardening session.** The single biggest gap: no atom has
  been driven against a real signed-in GitHub tab. DOM gotchas + true L4
  success surfaces are unknown until then.
- **Issue/PR sidebar pickers** (Assignees, Labels, Milestones, Projects)
  have no browser widget — `create_issue` / `update_issue` route those
  fields through mcp/oauth_api only (deferred to heal-time authoring).
- **`update_issue` browser flavor is close-only.** Reopen + title/body/
  metadata edits route through mcp/oauth_api (the reopen + edit-title
  widgets exist but aren't wired into a recipe).
- **No PR create / list / review atoms.** The MCP catalog +
  `apis.yaml` carry `create_pull_request`, `list_pull_requests`,
  `pull_request_read`, `update_pull_request`, `pull_request_review_write`,
  but only `merge_pull_request` is wrapped as an atom so far.
- **No repo / actions / users atoms.** `search_repositories`,
  `get_file_contents`, `create_or_update_file`, the Actions/CI tools, and
  `get_me` / `search_users` are in the catalog but unwrapped.
- **No blueprints yet** — no multi-atom orchestrations authored
  yet (e.g. "find issue → comment → close").
- **No `session_api` flavors** anywhere — the public REST is the default;
  session-cookie writes would target undocumented internal endpoints.

## See also

- [app_model.yaml](app_model.yaml) — the github semantic-layer map
  (screens / affordances / dead-paths / transitions), authored alongside
  this doc.
- [atom-methodology.md](../../onboarding/prompts/atom-methodology.md) —
  CANONICAL L0 methodology (5 layers, signal-type table, traps, authoring
  rules A-H). SaaS-agnostic. Apply it when hardening github.
- [/harden-browser-flavor skill](../../../../.claude/skills/harden-browser-flavor/SKILL.md)
  — the 8-step loop to run the FIRST github hardening session (start with
  the write pair create_issue + add_issue_comment, then merge_pull_request).
- [gmail.md](../gmail/gmail.md) — the gold-standard hardened
  per-integration doc this file mirrors in shape; read it for what a
  fully-hardened DOM-gotchas + L4 section looks like.
- `_mcp_tools.yaml` / `apis.yaml` / `widgets.yaml` / `views/` /
  `schemas/` / `actions/` — the single sources of truth for the MCP
  catalog, endpoints, selectors, screen landmarks, fields, and atoms
  respectively (this doc references them, never restates them).
