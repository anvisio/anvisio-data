---
name: manifests/asana/asana.md
version: 0.1.0
cdn_schema_version: 70.0.0
authored_by: cd2k + claude
authored_at: 2026-06-01
---

# Asana

Work-management SPA at `https://app.asana.com`. Projects contain tasks
(the work primitive); tasks group into sections; tasks can be multi-homed
across projects. The web app is a React single-page app — landmark
navigation is URL-path based (`/0/{projectId}/list`, `/0/{projectId}/board`,
`/0/{projectId}/{taskId}`, `/0/{userId}/list` for My Tasks). See
`views/*.yaml` for the landmark definitions and `app_model.yaml` for the
screen/transition map.

Every Asana id is a `gid` (global id): a numeric string. Same shape for
tasks, projects, sections, users, workspaces, custom fields, and stories
(comments). Object schemas live in `schemas/` (Task, Project, Section,
User, Workspace), each keyed `primary_key: [gid]`.

## Sources feeding propose

Three upstream sources ground this manifest (per CLAUDE.md):

1. **MCP catalog** (`_mcp_tools.yaml`) — the official Asana MCP V2 server
   at `https://mcp.asana.com/v2/mcp` (the older `/sse` beta retired
   2026-05-11). Transport `http`, auth OAuth 2.1 / PKCE. The catalog seeds
   12 daily-driver tools: `search_tasks`, `get_task`,
   `list_tasks_in_project`, `create_task`, `update_task`, `delete_task`,
   `add_task_comment`, `move_task_to_section`, `list_projects`,
   `get_project`, `list_sections`, `get_me`. The full surface (30+ tools)
   is enumerable via `tools/list` at the endpoint. Each atom whose verb
   maps to an MCP tool carries `mcp_tool: asana.<tool>` pointing back at
   the catalog.

2. **Web research** — Asana's public REST is well-documented and shares
   its envelope with the SPA's own `/api/1.0/*` endpoints, so research
   grounds the endpoint patterns, the `gid` convention, the cursor
   pagination shape (`next_page.offset`), and the `opt_fields` field-
   selection mechanic. See `apis.yaml` for the endpoint catalog.

3. **Live DOM** — a single list-view inspection on 2026-03-21
   (platform-notes/dom-selectors-asana.md) seeded the role/`data-testid`
   selector patterns now in `widgets.yaml`. This was a pre-spec-70 probe,
   NOT a runtime hardening session (see DOM gotchas below).

## Transport priority (spec 70 §7)

Derived from how each atom orders its `flavors:` block, gated by
`commits_changes`:

- **Writes** (`commits_changes: true` — `create_task`, `update_task`,
  `add_task_comment`) declare flavors in order **`browser` > `mcp` >
  `oauth_api`**. The user sees the task get created / updated / commented
  in their actual Asana tab (trust + the user-clicks-Enter / user-confirms
  launch contract on commit:true steps); `mcp` / `oauth_api` cover headless
  / cross-context callers.
- **Reads** (`commits_changes: false` — `get_task`, `search_tasks`,
  `list_tasks_in_project`, `list_projects`) declare **`session_api` > `mcp`
  > `oauth_api`**. `session_api` hits `/api/1.0/*` on `app.asana.com` with
  the user's existing session cookie (no OAuth round-trip) when Asana is
  open in Chrome — the fastest path and no scrape the user has to watch;
  `mcp` and `oauth_api` are the headless fallbacks. (`list_projects`'s
  changelog states this priority explicitly.)
- **`open_task`** is a browser-only navigation primitive (no MCP tool, no
  API flavor) — it just deeplinks to the TaskDetail URL.

Note on the two cookie transports (per `apis.yaml`): `session_api` and
`oauth_api` hit the SAME `/api/1.0/*` shape on `app.asana.com`; they
differ only in auth (session cookie vs OAuth bearer / PAT). `mcp` is the
separate `mcp.asana.com/v2/mcp` host.

## DOM gotchas

None consolidated yet — asana has NOT had a live browser-flavor hardening
session in the spec-70 runtime as of 2026-06-01. The only DOM inspection
on record is the 2026-03-21 list-view probe
(platform-notes/dom-selectors-asana.md), which seeded the role-based and
`data-testid`-based selectors now in `widgets.yaml` but did not drive the
recipes against a live tab.

Selectors live in `widgets.yaml` (single source of truth — do not restate
them here). What is known from the seed probe, as authoring context only:

- Asana is a React SPA; the list view is spreadsheet-style
  (`[role='grid']` / `[role='row']` / `[role='columnheader']`) with
  inline cell editing; the task detail opens as a right-side overlay pane
  (`[class*='TaskPane']`).
- `data-testid` is used primarily for icons, not interactive controls, so
  `widgets.yaml` leans on `aria-label` + role + `[class*='...']` patterns.
  These are UNVERIFIED against current Asana builds.
- Per-custom-field widgets (Priority, Status, Assignee picker, due-date
  picker) are deliberately NOT authored — they need label-scoped selectors
  that heal-time learning will derive from each project's custom-field
  metadata (see `widgets.yaml` description + Known gaps below).

When the first hardening session runs, capture the gmail-style gotcha
table HERE (selectors that DON'T match modern Asana + the right ones,
each with a discovered date), and the affordance detail in
`app_model.yaml` (currently `status: undocumented`). Follow
[atom-methodology.md](../../onboarding/prompts/atom-methodology.md) for the
SaaS-agnostic 5-layer / signal-type / trap framework, and use the
[harden-browser-flavor](.claude/skills/harden-browser-flavor/SKILL.md) +
[debug-atom](.claude/skills/debug-atom/SKILL.md) skills.

## L4 commit signals

None captured from a live UI yet — asana has not been live-hardened, so
there are NO verified success-toast / snackbar strings (do not invent
any). Capture per-action L4 signals here when first hardened, the way
gmail.md tabulates them.

What the browser-flavor write atoms use TODAY (read from `actions/*.yaml`,
authoring context only — these are network signals, not snackbar matches):

| Atom | Browser-flavor L4 signal | Notes |
|---|---|---|
| `create_task` | `network_response` on `app.asana.com/api/1.0/tasks` status 201 | Observes the SPA's real POST instead of a brittle `:has-text()` selector; extracts the Task from `data`. |
| `update_task` | `network_response` on `.../api/1.0/tasks/*` status 200 | Catches the SPA-side PUT for the when:-gated mark-complete / rename steps. |
| `add_task_comment` | `network_response` on `.../api/1.0/tasks/*/stories` status 201 | Asana calls comments "stories." |

These signals are POSITIVE rungs (a real network write), so the write
atoms already satisfy the integration-completeness Trap-2 gate (the
terminal signal is NOT a lone `selector_disappears`). When a hardening
session probes the live UI, ADD the visible success affordance (per
[atom-methodology.md Rule A](../../onboarding/prompts/atom-methodology.md),
snackbar-first): probe what Asana shows on a successful manual create /
update / comment and corroborate the network signal with it (or, if Asana
proves silent, the appropriate negation-ladder rung). The probe has not
been done; the snackbar strings are unknown.

## Known gaps

- **No live hardening session.** DOM gotchas + L4 snackbar strings +
  `app_model.yaml` affordance detail are all placeholders pending a first
  spec-70 browser-flavor hardening pass. This is the single biggest gap.
- **Per-field write widgets are deferred.** The browser flavors fill only
  the simplest paths: `create_task` fills the inline Add-task row's NAME
  (assignee / due / description / custom fields skipped); `update_task`
  wires only mark-complete + rename (notes / assignee / due / custom-field
  updates go through `mcp` / `oauth_api`). The Assignee / Due-date /
  custom-field (Priority, Status) pickers need label-scoped selectors
  heal-time will author from `project.custom_field_settings`.
- **`add_task_comment` browser flavor cannot surface `comment_gid`.** Asana
  puts the story gid only in the POST response body, not the DOM, so the
  browser flavor's extract is empty; callers needing the gid must pick the
  `mcp` or `oauth_api` flavor (both extract `data.gid`).
- **Board drag-to-move is unwired.** `ProjectBoard` is read/navigation
  context only; no browser-flavor atom maps the card-drag equivalent of
  the MCP `move_task_to_section` tool.
- **No blueprints yet.** There is no `blueprints/definitions/asana/` directory — only the 8 standalone
  atoms exist.
- **Catalog tools without an atom.** `delete_task`, `move_task_to_section`,
  `get_project`, `list_sections`, and `get_me` are in `_mcp_tools.yaml` but
  have no `actions/*.yaml` atom yet. (`get_me` is the natural source of the
  `workspace` gid that `search_tasks` / `list_projects` require.)

## See also

- [app_model.yaml](app_model.yaml) — the semantic-layer screen / affordance
  / transition map for Asana (affordances currently `status: undocumented`).
- [_mcp_tools.yaml](_mcp_tools.yaml) — the 12-tool MCP catalog (provenance:
  `server.source_url` + `fetched_at`).
- [apis.yaml](apis.yaml) — the `session_api` / `oauth_api` / `mcp` endpoint
  catalog (URL patterns live here, not in this doc).
- [widgets.yaml](widgets.yaml) — DOM widget primitives (selectors live here,
  single source of truth).
- [atom-methodology.md](../../onboarding/prompts/atom-methodology.md) —
  CANONICAL L0 methodology (5 layers, signal-type table, traps, authoring
  rules). SaaS-agnostic; follow it when the first hardening session runs.
- [platform-notes/asana.md](../../../../../planning/tech_design/integrations/platform-notes/asana.md)
  — human-orientation notes (account / tier / sample data / quirks); links
  back here for the canonical manifest facts.
