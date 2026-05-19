---
name: manifests/gmail/gmail.md
version: 0.1.0
cdn_schema_version: 70.0.0
authored_by: cd2k + claude
authored_at: 2026-05-19
---

# Gmail

Web mail at `https://mail.google.com`. Single-page application; landmark
navigation is hash-based (`#inbox`, `#search/<query>`, `#sent`,
`#label/<name>`). Authenticated via the user's Google session cookie —
no separate OAuth step at run time.

## Three sources feeding propose

1. **MCP catalog** (`_mcp_tools.yaml`) — 19 atoms covering messages
   (send / draft / read / search / modify / delete), batch ops, labels,
   filters, and attachments. Anchored on
   `github.com/GongRzhe/Gmail-MCP-Server` for now; the official
   Google Workspace MCP servers may publish an alternative shape
   later. **Each atom action whose verb maps to an MCP tool carries
   `mcp_tool: gmail.<tool>` pointing back at the catalog entry.**

2. **Web research** — Gmail's UI is well-documented (selectors,
   shortcut keys, URL grammar) and stable enough that research-phase
   web_search rarely surfaces drift. We lean on it mostly for new
   surfaces (workspace updates, A/B'd toolbars).

3. **Live DOM** — Gmail's class-hash CSS (e.g. `.zA`, `.T-I.J-J5-Ji`)
   forces every selector to be live-verified. `enumerate_widgets`
   reads the current toolbar layout each onboarding pass; heal patches
   selectors when Google ships a new build.

## Transport priority (spec 70 §7)

- **Writes** (`commits_changes: true`) prefer `browser > mcp`: the
  user sees the email get filled and sent in their actual Gmail tab.
  Trust + visibility matter for writes (esp. send_email).
- **Reads** (`commits_changes: false`) prefer `mcp > browser`: the
  MCP `search_emails` / `read_email` / `list_email_labels` tools are
  faster than driving the DOM, and the user doesn't need to see the
  scrape.

## Authoring conventions

- **Compose actions** (`send_email`, `draft_email`, `reply_email`)
  open the ComposePanel view via `gmail.compose_button` on Inbox. The
  recipe takes the user from "panel open" → "form filled" → (commit
  step) "Send clicked". Preview mode stops at "form filled"; commit
  mode runs the final Send click.
- **Read actions** assume the user has navigated to ThreadView (via a
  prior atom or a wizard nav). They use `read_fields` against the
  Message / Thread schema — no commit step.
- **Modify-label actions** (`archive_email`, `star_email`,
  `mark_read_unread`, `apply_label`, `move_email`) all share the
  underlying MCP `modify_email` tool with different
  `addLabelIds` / `removeLabelIds`. In the browser flavor, each maps
  to a single toolbar widget click.

## Known gaps

- **`list_inbox`** has no direct MCP equivalent. The Gmail MCP
  catalog assumes you `search_emails` for the inbox label rather than
  navigating; the anvisio browser flavor wraps this as a navigation
  recipe so wizard flows can land on Inbox before per-row actions.
- **`forward_email`** / **`reply_email`** / **`reply_all_email`** are
  thin wrappers over `send_email` (with `inReplyTo` + `threadId`).
  Authored as separate atoms in the browser flavor for UI clarity;
  the MCP flavor can collapse them to `send_email`.
