---
name: manifests/slack/slack.md
version: 0.1.0
cdn_schema_version: 70.0.0
authored_by: cd2k + claude
authored_at: 2026-06-01
---

# Slack

Team-messaging SPA at `https://app.slack.com`. Navigation is path-based
and workspace-scoped: `/client/{workspace_id}/{channel_id}`, where the
`channel_id` prefix encodes the conversation kind (`C`=public/private
channel, `D`=DM, `G`=group DM, `M`=multi-party im — see
[schemas/Channel.yaml](schemas/Channel.yaml)). A thread expands the URL
to `/client/{workspace_id}/{channel_id}/thread/{channel_id}-{ts}`.

Authentication in-tab is the user's existing Slack session: the web SPA
calls its own `/api/*` endpoints with `xoxc-*` + `xoxd-*` cookies on the
workspace subdomain (`<workspace>.slack.com`). For headless / cross-context
flows there is a public Web API (token-auth) and an official MCP server.

> Status (2026-06-01): Slack has NOT had a live browser-flavor hardening
> session. The manifest (schemas, views, widgets, actions, MCP catalog)
> is authored and internally consistent, but every `apis.yaml` entry is
> `confidence: low` / `verified_at: null` and the `widgets.yaml`
> selectors are unverified against a real DOM. The DOM-gotchas and
> per-action L4 sections below say so honestly rather than inventing
> specifics. See **Known gaps**.

## Sources feeding propose

Per CLAUDE.md, three upstream sources ground the propose pass. For Slack:

1. **MCP catalog** ([`_mcp_tools.yaml`](\_mcp_tools.yaml)) — **8 tools**
   over the daily-driver subset: workspace context (`list_users`,
   `get_user_profile`), channels (`list_channels`, `get_channel_info`),
   messages (`read_channel`, `get_thread_replies`, `search_messages`,
   `post_message`). The official Slack MCP server is at
   `https://mcp.slack.com` (`source_url` in the catalog `server` block;
   `fetched_at: 2026-05-23`); `transport: http`, `auth: oauth2_pkce`.
   Each atom whose verb maps to an MCP tool carries `mcp_tool:
   slack.<tool>` pointing back at the catalog entry (list_channels /
   list_users / read_channel / search_messages / post_message do;
   `open_channel` does NOT — it is a browser-only navigation primitive
   with no API equivalent).

2. **Web research** — Slack's Web API is well documented (the
   `conversations.*`, `users.*`, `chat.postMessage`, `search.messages`
   methods + the Slack search query grammar). `apis.yaml`'s endpoint
   inventory was seeded from
   `planning/tech_design/audits/41-slack-primitive-mapping.md`. The
   Real-Time Search API (GA 2026-02-17, alongside the MCP server) is the
   preferred backend for `search_messages` when available.

3. **Live DOM** — NOT yet performed. `widgets.yaml` selectors come from
   inspection notes + the role/aria structure of the current SPA, not a
   driven session. `enumerate_widgets` / `query_dom` against a signed-in
   tab is the missing step (see **Known gaps**).

## Transport priority (spec 70 §7)

Derived from the order of the `flavors:` blocks in each
[`actions/*.yaml`](actions/) — NOT asserted abstractly. Slack splits
cleanly along the spec-70 read/write axis:

- **Reads** (`commits_changes: false`). `list_channels`, `list_users`,
  `read_channel` declare **`session_api` > `mcp` > `oauth_api`**: when
  the user has Slack open in a tab, the workspace-subdomain `/api/*`
  endpoints work off the `xoxc` cookie with no token exchange, so they
  are the daily driver. `mcp` / `oauth_api` cover headless /
  cross-context.
- **Search** (`search_messages`, also a read) is the exception:
  **`mcp` > `session_api` > `oauth_api`**, because the MCP server fronts
  Slack's Real-Time Search API (better relevance) while the API flavors
  fall back to `search.messages`.
- **Writes** (`commits_changes: true`). `post_message` declares
  **`browser` > `mcp` > `oauth_api`**: the user sees the message typed
  into their actual channel composer and (under the user-clicks-Send
  launch contract) sends it. `mcp` / `oauth_api` cover headless posting
  and the cases the browser flavor deliberately punts (thread replies —
  see DOM gotchas).
- **Navigation primitive.** `open_channel` is `browser`-only (a
  `navigate` to the channel SPA URL); there is no API analogue.

`apis.yaml` documents three transports backing these flavors:
`session_api` (workspace subdomain, `xoxc`/`xoxd` cookies),
`oauth_api` (`slack.com`, `xoxp` user / `xoxb` bot token), and `mcp`
(`mcp.slack.com`). Endpoint patterns + scopes live in
[`apis.yaml`](apis.yaml) — not restated here.

## Primary keys (composite-key gotcha)

Slack's native identifiers are unusual and worth flagging for anyone
chaining atoms (full field tables live in [`schemas/`](schemas/)):

- **Message** is keyed by a **composite `[channel, ts]`** (see
  [schemas/Message.yaml](schemas/Message.yaml)). `ts` is a string with
  microsecond precision (e.g. `"1700000000.000100"`) and is unique only
  *within* a channel — `ts` alone is NOT a global id. `post_message`
  builds the PK from the input `channel` + the `ts` returned by
  `chat.postMessage`. A subtlety baked into `read_channel`:
  `conversations.history` items do NOT carry the `channel` field, so the
  caller must inject it (the action notes this; a flatten pass belongs at
  the runtime extract layer). `search.messages` items DO carry `channel`,
  so search results arrive PK-complete.
- **Channel / User / Workspace** use a simple `[id]` PK (`C…`/`D…`/`G…`/`M…`,
  `U…`/`W…`, `T…`/`E…` respectively).

## DOM gotchas

None consolidated yet — Slack has not had a live browser-flavor
hardening session as of 2026-06-01. The selectors live in
[`widgets.yaml`](widgets.yaml) (global search, quick switcher, sidebar
channel/DM items, the channel + thread composers, the send button, the
open-thread button); they are authored from aria/role + `data-qa`
structure but UNVERIFIED against a real DOM. Capture per-action DOM
gotchas + corrected selectors here when Slack is first hardened
(mirror the gmail.md "DOM Gotchas" table format).

One hazard is already DECLARED in the manifest (in
[actions/post_message.yaml](actions/post_message.yaml)) and worth
recording up-front, though it is not yet live-confirmed:

- **Dual composers when a thread is open.** With a thread expanded,
  Slack mounts BOTH the channel composer (`slack.channel_composer`) and
  the thread composer (`slack.thread_composer`) in the DOM at the same
  time. Disambiguating which to fill via DOM is brittle, so
  `post_message`'s **browser flavor handles only top-level channel
  posts**; thread replies (`thread_ts` set) route through `mcp` /
  `oauth_api`, which take `channel` + `thread_ts` cleanly. First thing to
  verify if a browser thread-reply flavor is ever attempted.

When hardening, the cross-integration methodology to apply lives in
[atom-methodology.md](../../onboarding/prompts/atom-methodology.md)
(5 layers, signal-type table, traps, authoring rules A–H); this section
is the place for the Slack-SPECIFIC "selectors that don't match + the
right ones" table once they exist.

## L4 commit signals

`post_message` is the only `commits_changes: true` atom. Its browser
flavor's terminal L4 signal is **REAL and already in the action**: a
`network_response` on `slack.com/api/chat.postMessage` with `status:
200` (timeout 8000ms), from which it extracts `message.ts` (the request
`channel` completes the composite PK). This is an observe-the-actual-send
signal, not a passive DOM selector — chosen deliberately (the 0.2.0
changelog records switching off a passive message-pane selector).

What is NOT yet captured: a **positive success snackbar / toast string**
the way gmail.md tabulates one per write. Slack's web client may surface
a confirmation affordance on a successful send (or it may be silent —
the message simply appearing in the pane); that has not been live-probed.
Per [atom-methodology.md Rule A](../../onboarding/prompts/atom-methodology.md)
(snackbar-first), the next hardening session should: (a) manually post a
message and observe what the UI shows on success, (b) if a toaster
exists, add it as a `selector_appears [role='alert']` + `must_contain_text:`
rung corroborating the XHR; (c) if the send is proven silent, the
`chat.postMessage` 200 is the honest signal and stands as-is. Capture
the finding (toaster text OR "proven silent") in a table here, one row
per write atom, when hardened.

The read atoms (`list_channels`, `list_users`, `read_channel`,
`search_messages`) are not writes; their flavors signal on the API
response (`network_response` / `url_matches`) and extract the typed
result — no L4 commit marker applies.

## Known gaps

- **No live DOM-hardening session (the big one).** No Slack atom has
  been driven against a real signed-in tab. `apis.yaml` entries are all
  `confidence: low` / `verified_at: null`; `widgets.yaml` selectors and
  `views/*.yaml` landmark probes are unverified. First hardening pass:
  drive `open_channel` + `read_channel` + `post_message` (the
  search→read→post core) via chrome-devtools MCP, then promote the probed
  screens in [app_model.yaml](app_model.yaml) from `status:undocumented`
  and fill its `known_dead_paths` (currently `[]` precisely because
  nothing has been disproven).
- **Thread replies have no browser flavor.** By design (dual-composer
  hazard above) `post_message` punts `thread_ts` to `mcp` / `oauth_api`.
  A browser thread-reply flavor would need an `open_thread` step +
  reliable thread-composer scoping.
- **`conversations.history` is `channel`-less.** `read_channel` returns
  Message items missing the `channel` half of the composite PK; a
  runtime-extract flatten pass to inject it is noted as a follow-up in
  the action, not yet wired.
- **MCP catalog is the daily-driver subset, not exhaustive.** 8 tools.
  Reactions, channel create/archive/invite, file upload, scheduled
  messages, etc. are intentionally out of the v0.1 seed (see the
  `_mcp_tools.yaml` changelog).
- **`session_api` read signals are coarse.** The session_api flavors
  verify on `url_matches: "slack\\.com"` (the tab is on a Slack URL)
  rather than a tight per-endpoint network match; the extract still
  pulls from the API response. Tighten to a `network_response` on the
  specific `/api/...` path when hardening.

## See also

- [app_model.yaml](app_model.yaml) — Slack semantic-layer map (screens /
  affordances / dead-paths / transitions). Read alongside this file.
- [_mcp_tools.yaml](\_mcp_tools.yaml) / [apis.yaml](apis.yaml) /
  [widgets.yaml](widgets.yaml) / [schemas/](schemas/) / [views/](views/)
  / [actions/](actions/) — the manifest (single source of truth for
  catalog / endpoints / selectors / fields / landmarks / recipes).
- [atom-methodology.md](../../onboarding/prompts/atom-methodology.md) —
  CANONICAL L0 methodology (5 layers, signal-type table, traps, authoring
  rules). SaaS-agnostic; apply when hardening any Slack atom.
- [gmail/gmail.md](../gmail/gmail.md) — the gold-standard per-integration
  doc this file mirrors in shape; its DOM-Gotchas + L4-snackbar tables are
  the templates to fill once Slack is hardened.
