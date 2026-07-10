---
name: manifests/gmail/gmail.md
version: 0.18.0
cdn_schema_version: 70.0.0
authored_by: cd2k + claude
authored_at: 2026-05-27
changelog:
  - "0.18.0 (2026-06-08): investigated a reported `outcome: drafted` on a commit:false reply. RESOLUTION — it is CORRECT nav-away behavior, NOT a bug: switching threads (or otherwise navigating away) genuinely removes the inline reply composer and Gmail autosaves the draft, and `drafted` is defined as exactly that (close / navigate-away → autosaved draft persists). Proven by two live drives: a full 10-min quiet sit (no nav) produced NO drafted (resolved `cancelled`), then switching threads produced `drafted` — so drafted requires a real composer removal, it never fires on a quiet open composer. SEPARATELY (defense-in-depth, while investigating): `selector_disappears` resolved its terminal on the FIRST absent 100ms poll (chrome-signal-driver.ts), so any single transient re-render could fire `closed`; it now requires 3 consecutive absent polls (~300ms) before firing (a flicker resets the counter; seedPresent intentionally NOT required so a fast commit:true auto-close still fires). This does NOT change the correct nav-away result; it hardens a fragile single-sample fire for ALL compose/modal-close atoms across gmail + salesforce/calendar/outlook. NOTE: the inline-reply HITL 'review & Send' wait does NOT survive a thread switch (composer gone → drafted); the docked compose (send_email) DOES survive nav — an open product question if that matters. See gotcha #13 closed-signal note. Full runtime drive of reply_all/forward/draft is still the open follow-up."
  - "0.17.0 (2026-06-08): CANONICAL ACTION FORM v71 migration COMPLETE, gmail is 16/16. The compose family (reply_email / reply_all_email / forward_email / draft_email) migrated, mirroring send_email: tab_mode (reply/reply_all/forward = current, was runs_in_home_tab:true; draft = new); flat typed inputs with fill_fields and NO `from` (fills from the flat inputs, the writable-field filter drops InReplyTo); result.outcome replacing the per-terminal booleans; per-terminal literal extracts dropped; ready_to_* outcomes dropped. Live-DOM-validated on a real thread 2026-06-08: the reply recipe chain is current (.ams.bkH Reply trigger, composer region visible h~234, Message Body textbox, Send (Ctrl-Enter) button), the Body fill target accepts input, and the `discarded` ('Draft discarded.' in div[role='alert']) + `closed` (composer region disappears) signals fired live on discard; subjectbox re-confirmed collapsed 0x0. DOM facts UNCHANGED (no selector/snackbar drift). parity-validator now gates its '>=1 extract block per browser flavor' check on a NON-NULLABLE schema-typed result, because forward_email's browser flavor legitimately returns only result.outcome (it cannot read the forwarded message's destination ids: a forward creates a NEW thread and Gmail keeps the user on the SOURCE thread). See planning/tech_design/integrations/CANONICAL_ACTION_FORM.md."
  - "0.16.0 (2026-06-08): CANONICAL ACTION FORM v71 migration (12/16 gmail atoms). The v71 shape: tab_mode: current|new (replacing runs_in_home_tab/reads_in_fresh_tab); result.outcome auto-populated from the winning action (replacing per-terminal booleans); terminals-only outcomes via when:/not: over a named signals: map, dropping the ready_to_* pseudo-outcomes (a ready gate is not an LLM-consumable outcome); flat typed compose inputs. 5 distinct patterns LIVE-PROVEN (send 3 terminals, delete, star aria-label toggle, read cloned-tab, apply_label submenu+typeahead). DOM facts UNCHANGED: the migration preserved all selectors + snackbar text; the live tests re-confirmed them with no drift. The tab section below is annotated for the tab_mode mapping. reply/reply_all/forward/draft still use the booleans until migrated. See planning/tech_design/integrations/CANONICAL_ACTION_FORM.md."
  - "0.15.0 (2026-06-07): reply/reply_all message_id is now extractable — it's the LAST div.adn.ads[data-legacy-message-id] (the just-sent reply), grabbed via the NEW from_selector_last extract (the twin of the click step's pick_last). from_selector took the oldest = wrong, so it was stubbed null pre-0.14.0. reply/reply_all 0.14.0 now return the flat {message_id, thread_id} pair across all flavors for MCP parity (gmail.send_email output_schema). Documented in the snackbar/id-extraction note. Also: reply_all's More-menu now targets the LAST message (gmail.widgets 3.16.0 pick_last)."
  - "0.14.0 (2026-06-07): CORRECT gotcha #13's inline-composer `closed` signal. The doc said the inline reply composer's collapsed `subjectbox` is the shared `closed` signal — WRONG: it's collapsed to 0px, so `selector_disappears` fires the instant the composer opens → reply's `drafted` resolved immediately + the HITL wait vanished before the user could act (reply/reply_all/forward 0.12.0). Inline composer's `closed` = the REGION `div[role='main'] div[role='region'][data-compose-id]` (visible while open, gone on close). General lesson noted: selector_disappears keys on VISIBILITY, so present-but-0px = disappeared — probe size, not just presence. Caught on the 2026-06-07 reply re-drive."
  - "0.13.0 (2026-06-07): runs_in_home_tab matrix — reply/reply_all/forward moved from own-tab to HOME-tab (atoms 0.11.0). The 2026-06-07 reply re-drive surfaced a latent regression: ThreadView's 0.7.0 entry redesign (current-view row-click, no nav, pairing with read_email's cloned fresh tab) broke the three thread-dependent writes, whose wantsOwnTab blank edit tab has no list → await_row 15s timeout. Fix = runs_in_home_tab:true (cd2k's choice over a clone-list-for-writes runtime mode). Only send_email/draft_email keep their own tab (new compose, no thread dep). Matrix + rule + warning callout updated."
  - "0.12.0 (2026-06-07): send_email 0.13.0 SIGNALS MODEL live-verified end-to-end with cd2k. Drove send_email_hitl_tester and resolved all 3 terminals in one session (Send→sent, trash→discarded, X/Save&close→drafted); the drafted draft_id round-trips (reopened at ?compose=Cllg…, a 70-char [A-Za-z0-9]{20,} token). Confirmed the runtime is CDP-FREE (synthetic events, never chrome.debugger — chrome-step-driver.ts:101), so the re-drive ran WITH chrome-devtools MCP attached; the 'MCP-vs-runtime CDP conflict' only bites if heal fires. Closes pickup follow-up 1 (the clean-no-MCP-session premise was unnecessary). Note added to gotcha #13."
  - "0.11.0 (2026-06-07): recipient (To) extraction section + read_email 0.9.0. Live-probed 2026-06-07: the ThreadView recipient summary `span.hb` holds one `span.g2[email]` chip per recipient and the `email` attribute carries the full address even when display shows a name — so the browser flavor CAN cheaply enumerate To (disproves the prior 'UI buries it' comment). Extract via from_selector_all+attr in the outcome block (read_fields collapses lists). Collapse caveat (bulk-recipient threads lazy-render into the details table) + attachments still cross-flavor-stubbed, both documented. Also: star_email + create_label re-confirmed correct as-is (selector_appears polls+latches an aria-label flip; no Label_<n> id exists anywhere in the Gmail DOM, so create_label's null id is honest). 8 mutate/read atoms selector-liveness-swept (no drift); their L4 snackbar text stands from the 2026-05-27/28 verify."
  - "0.10.0 (2026-06-07): DOM gotcha #13 (live-probed) — compose autosave + the three-terminal close model that backs the spec-70 signals-model migration of the compose family. Key facts: the docked compose flips ?compose=new -> ?compose=<handle> ONLY once a recipient lands (the browser draft_id); the inline reply composer never flips the URL (drafted draft_id:null); the three terminals (sent / discarded / drafted) share div[role='alert'], and a DISCARD DOES TOAST ('Draft discarded.') — correcting the old 'a draft discards silently' assumption (which had reached the integration-completeness Trap-2 allowlist). Save&close is img.Ha in the title bar (outside data-compose-id), silent. Reply snackbar has no #link_vsm (only send_email's does)."
  - "0.9.0 (2026-06-06): DOM gotcha #12 (live-probed, first /map-saas map crawl) — modal close is NOT uniform: the 'New label' dialog is NOT role=dialog (a role=dialog detector reports 0 while it is open, so it is never closed and pollutes downstream views), and compose is SERVER-STICKY (survives tabs.reload + clean-url reload; only a trusted CDP click on Discard clears it). Lesson: verify modal open/closed from a SCREENSHOT, not the DOM. Feeds doc 26 resetToCleanState."
  - "0.8.1 (2026-06-05): DOM gotcha #11 — the bulk SELECTION toolbar (appears when >=1 row checked, any view incl. search) marks all selected at once via div[role='button'][aria-label='Mark as {{mode}}']; distinct from gotcha #7's per-thread context menu, which list-shifts on is:unread. Recovered from git history + user observation; verify live before authoring mark_selected_read_unread."
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
  to a right-click context-menu item on the row (the toolbar path is
  absent in search and the toolbar Labels button was removed in 2025;
  the context menu works in all list views). `star_email` is the
  exception — it toggles the per-row star directly. See
  [app_model.yaml](app_model.yaml) `context_menu` + gotcha #7.

## Known gaps

- **`list_inbox`** has no direct MCP equivalent. The Gmail MCP
  catalog assumes you `search_emails` for the inbox label rather than
  navigating; the anvisio browser flavor wraps this as a navigation
  recipe so wizard flows can land on Inbox before per-row actions.
- **`forward_email`** / **`reply_email`** / **`reply_all_email`** are
  thin wrappers over `send_email` (with `inReplyTo` + `threadId`).
  Authored as separate atoms in the browser flavor for UI clarity;
  the MCP flavor can collapse them to `send_email`.

---

## DOM Gotchas (added 2026-05-27 — read before authoring widgets OR proposing heal patches)

Each of these was learned the hard way and cost ~30-60min of debugging on first encounter. The cross-integration methodology lives in [atom-methodology.md](../../onboarding/prompts/atom-methodology.md) (5 layers, signal-type table, 5 traps, authoring rules A-G); THIS section is the Gmail-specific table of "selectors that DON'T match modern Gmail and the right ones." Apply the methodology to interpret WHEN to use each gotcha; this section names WHAT the gotcha is.

### 1. Typeahead menuitems carry text in `textContent`, NOT `aria-label`

Gmail's typeahead menus (Move-to ▼, Label-as ▼, etc.) render each option as:

```html
<div role="menuitem">anvisio-hardening-2026-05-25</div>
```

No `aria-label` attribute. Selectors like `div[role='menuitem'][aria-label*='X']` silently match zero elements. Use the runtime's `must_contain_text` filter on `div[role='menu'] [role='menuitem']`.

**WRONG:**
```yaml
selector:
  - div[role='menu'] div[role='menuitem'][aria-label*='{{value}}']
  - div[role='menu'] div[role='menuitem']:nth-of-type(1)  # FOOTGUN
```

**RIGHT:**
```yaml
selector: div[role='menu'] [role='menuitem']
must_contain_text: "{{value}}"
```

**Footgun fallback to AVOID:** `:nth-of-type(1)` / `:first-child` on menuitems silently clicks the FIRST item regardless of input — false-success bug. Strict `must_contain_text` only.

**Affected widgets** (history of the same bug, two widgets):
- `gmail.label_menu_search` — fixed widget 3.6.0 (2026-05-25)
- `gmail.move_menu_search` — fixed widget 3.11.0 (2026-05-27, re-learned)

### 2. Action-button `act='N'` attributes drift; use exact `aria-label` instead

Gmail's toolbar action buttons historically carried an `act` attribute (`act='8'` = Move-to, etc.) — internal action codes that change without notice.

Live-probed 2026-05-27: the current Move-to button has `act=null`. Worse, `act='8'` was reassigned to the INVERSE button `aria-label='Move to Inbox'` shown in Archive/Sent views. So old `[act='8']` selectors now silently match the WRONG button on those views.

**WRONG:** `div[role='button'][act='8']`
**WRONG:** `div[role='button'][aria-label^='Move to']` (prefix match → also matches "Move to Inbox")
**RIGHT:** `div[role='button'][aria-label='Move to'][data-tooltip='Move to']` (exact aria-label match + tooltip belt-and-suspenders)

**General rule:** AVOID Gmail's `act=` codes in selectors. Use exact `aria-label` match. Use prefix-match only when you've verified no collision with sibling buttons in other views.

**Affected widget:** `gmail.toolbar_move_button` — fixed widget 3.10.0 (2026-05-27).

### 3. Compose dialog has NO `aria-label` (verified 2026-05-08)

```html
<div role="dialog" class="nH Hd">  ← no aria-label
```

**WRONG:** `div[role='dialog'][aria-label='New Message']` — never matches.
**RIGHT:** `div[role='dialog']` (just the role) or anchor on a stable child like `input[aria-label='To recipients']`.

Note: AFTER the user types a Subject, the compose region's `aria-label` IS populated with the Subject text (mutable). Don't rely on it — use `[data-compose-id]` (stable through subject changes).

### 4. Typeahead chip is `role='option'`, NOT `role='listitem'`

The committed recipient chip in compose To/Cc/Bcc renders as:

```html
<div role="option" data-hovercard-id="user@example.com" data-name="...">
```

**WRONG:** `div[role='listitem'][data-hovercard-id]` — Gmail has zero `div[role='listitem']` in compose.
**RIGHT:** `div[role='option'][data-hovercard-id]`

### 5. Compose `To` input has no `name` attribute

**WRONG:** `input[name='to']` / `textarea[name='to']`
**RIGHT:** `input[aria-label='To recipients'][role='combobox']`

### 6. Search results keep the previous list (inbox) DETACHED in the DOM — scope every row selector to `div[role='main']`

Gmail does NOT destroy the inbox list when you run a search. It keeps the prior list as a DETACHED `tr.zA` cache OUTSIDE `div[role='main']` (`closest("div[role='main']") === null`) for instant back-navigation. Live-probed 2026-05-28: a `from:sadie bamboohr` search showed **52 `tr.zA` rows in the document but only 2 inside `div[role='main']`** (the real results); the other 50 were the detached inbox, DOM-ordered FIRST.

A document-global row selector therefore matches the stale inbox cache, inbox-first. This made `search_emails` return inbox ids for a 2-result query → the `/agent` read loop (the model tried to read inbox threads that aren't in the search).

**WRONG:** `tr.zA span[data-legacy-thread-id]` (document-global) — matches all 52.
**RIGHT:** `div[role='main'] tr.zA span.bog span[data-legacy-thread-id]` — the 2 live results only. The `span.bog` (subject) qualifier also de-dupes: each row carries TWO `data-legacy-thread-id` spans, so the unqualified form double-counts.

Applies to BOTH `search_emails` (scrape) AND `ThreadView` row-click (`await_row` / `open_thread`) — scope every Gmail row selector to `div[role='main']`. `[data-query]` (the search-refinement chip) renders INSIDE main as part of the search render (`dqInsideMain === true`), so waiting for `div[role='main'] [data-query]` gates "main has repainted from inbox to this query's results" before scraping. (search_emails 1.4.0 / ThreadView 0.7.1.)

This is a GENERAL SPA pattern, not a Gmail quirk — frameworks cache the prior virtualized list rather than tear down + re-layout a large table. See [atom-methodology.md Trap 6](../../onboarding/prompts/atom-methodology.md) for the SaaS-agnostic rule.

### 7. Right-click context-menu items are STATE-dependent; disabled = `display:none` (live-probed 2026-05-28)

The row right-click context menu (the canonical path for archive / delete / move / mark_read_unread / apply_label since the toolbar Labels button died and the toolbar is absent in search) renders EVERY possible item, then enables only the ones valid for the thread's current state. A DISABLED item is:

```html
<div role="menuitem" class="J-N J-N-JE" aria-disabled="true" aria-hidden="true" style="display: none;">Archive</div>
```

`display:none` → height 0 → the runtime's click/contextmenu visible-filter (`height > 0`, chrome-step-driver) skips it. An ENABLED item is `class="J-N"`, `aria-disabled="false"`, no `display:none`.

**Why this matters for selectors:** you do NOT need `:not([aria-disabled='true'])` or exact-text matching to disambiguate enabled-vs-disabled lookalikes — `must_contain_text:'<verb>'` on `[role='menuitem']` lands on the visible (enabled) one. In particular `must_contain_text:'Delete'` correctly hits "Delete" (→Trash) and not "Delete forever", because the two are mutually exclusive by thread state (only one is ever enabled+visible). See [app_model.yaml](app_model.yaml) `context_menu.state_dependence` for the full per-state matrix.

**Move-to typeahead input drift (same as Label-as):** the context-menu "Move to►" submenu input is `input.bqf[aria-label='Move-to menu open']` — `placeholder='Move to:'` is DEAD (predicted in widgets 3.6.0, confirmed 2026-05-28). Fixed in `gmail.move_menu_search`. Picking a Move-to destination commits immediately + closes (NO Escape, unlike Label-as).

**WRONG:** `div[role='menu'] input[placeholder='Move to:']`
**RIGHT:** `div[role='menu'] input[aria-label='Move-to menu open']` (or `input.bqf` fallback)

### 8. Compose restores in MINIMIZED state when leftover drafts exist (live-probed 2026-05-31)

Open Compose with leftover drafts in the sidebar ("Drafts N") and Gmail can mount the compose drawer **minimized** — only a 328x40 strip at the bottom-right (`<div class="nH Hd">` at ~(518, 897)) with `<span>` "New Message" + Maximize/Pop-out/Close buttons. The drawer matches `div[role='dialog']` BUT every input inside (`To recipients`, `subjectbox`, body editor) has `getBoundingClientRect()` of 0x0.

This silently passed `gmail.compose_button`'s `verify_target: div[role='dialog'], input[name='subjectbox']` (the dialog frame exists) and then the next typeahead_chip / text_input fill timed out at `focus_input` with `click: no selector matched (visible+settled)`.

**Fix:** `gmail.compose_button` (widgets 3.14.0) declares `overrides.expand_selector: "[aria-label='Maximize']"`. The click_reveals archetype's new `expand_if_collapsed` step (archetype 1.5.0, click step's `optional: true` arg) clicks Maximize after the reveal verify; no-op when compose opened maximized (button absent). The Maximize button sits at `~(778, 909)` in minimized state.

**WRONG (silent pass):** `verify_target: div[role='dialog']`
**RIGHT:** keep the verify_target, ALSO declare `expand_selector` so the widget self-recovers.

### 9. PeopleKit hovercard (`.afC.RuSUmb`) orphans after typeahead chip commit (live-probed 2026-05-31)

Each time the typeahead_chip recipe commits a chip in compose To/Cc/Bcc, Gmail mounts a separate PeopleKit hovercard div at `<body>` level via async fetch — text `"<email> <email> Loading..."`, z-index 999999, anchored to the chip. For unknown contacts (no profile to enrich) the fetch leaves the card in `Loading...` indefinitely. If our recipe finishes before the async mount completes, the hovercard lands AFTER and we never dismiss it — it pins to the viewport corner (0, 0, 344, 68) until the user manually clicks a real interactive element inside the compose. Two compose fields = two stuck hovercards = compose looks frozen even though everything filled correctly.

**Diagnostics (cost ~30 min on first encounter):**
- Chip and hovercard are DIFFERENT elements: chip is `<span email="...">` inside the To region (verified by our `verify_target`); hovercard is the body-level `.afC.RuSUmb` (NOT verified by anything).
- `document.body.click()` does NOT dismiss the hovercard (Gmail's handler ignores body-root events).
- Pressing Escape, blurring active element, mouseleave — none dismiss it.
- The ONLY thing that dismisses: `mousedown` + `mouseup` + `click` sequence on a real interactive descendant (largest visible `[contenteditable=true]` works — i.e. the compose body editor).

**Fix:** `blur_focus` step (runtime 15e3eb66) runs in two phases. Phase 1 = blur active + body click (covers Calendar dropdowns). Phase 2 = 3-second MutationObserver watching for `.afC.RuSUmb`; on detect, dispatches the click sequence on the largest visible contenteditable. The typeahead_chip archetype's recipe ends with `blur_focus`, so it fires after every chip. Observer auto-disconnects after the 3s budget.

### 10. Compose recipient chip commits ONLY on a synthetic Enter that carries keyCode=13 (live-proven 2026-05-31)

This was the real reason compose recipient chips "never worked" across several sessions, hidden behind the gotcha-below fake-success verify. Gmail's PeopleKit recipient input gates its commit handler on `e.keyCode`, NOT `e.key`. The runtime's synthetic `pressKeyInPage` historically built `new KeyboardEvent('keydown', { key })` — which leaves `keyCode === 0` in Chromium (the constructor does not honor a `keyCode` init member). So the typed address sat in the input and no chip formed. Two independent things had to be wrong for it to surface:

- **submit_key was Tab** (archetype default, pre-1.6.0). A synthetic Tab can NEVER commit: untrusted events don't trigger the browser's native focus-move, so neither the focus-blur commit nor any keyCode-9 handler runs. (Same on Calendar.)
- **Even Enter did nothing** until the synthetic event carried `keyCode=13`/`which=13`/`code='Enter'`.

**Controlled live A/B (same compose, same typing, only the press differs):** keyCode-less Enter → no chip; `mapKeyForCdp`-keyed Enter → chip `div[role='option'][data-hovercard-id='<email>']` (class `afV`) forms, input clears. Contrast Calendar, which tolerates keyCode-less Enter (its handler checks `e.key`) but still needs Enter not Tab.

**Fix (2026-05-31):** `chrome-step-driver.pressKeyInPage` now fills `code` + `keyCode`/`which` from `mapKeyForCdp` (the same table the trusted CDP path uses) on every synthetic key event — still 100% CDP-free, just a correctly-shaped synthetic event. Paired with archetype-templates 1.6.0 (submit_key default Tab→Enter). Any future "typed value but no chip / no submit" on a Google surface: first check the synthetic key event carries a keyCode.

### 11. Bulk SELECTION toolbar marks all checked rows at once — distinct from the per-row context menu (recovered 2026-06-05, NOT yet live-re-probed)

There are TWO ways to mark messages read/unread, and gotcha #7's context-menu path is the SINGLE-thread one:
- **Per-thread (context menu):** right-click one row → "Mark as read" (what `mark_read_unread` does today). Marking N threads means N iterations — and on an `is:unread` search each mark REMOVES that thread from the results, so the list shifts and the next per-row selector fails ("no selector matched"). Self-defeating for a multi-selection.
- **Bulk (selection toolbar):** when ≥1 row is CHECKED, Gmail shows a bulk-action toolbar whose "Mark as read"/"Mark as unread" button acts on the WHOLE selection in one click — no iteration, no list-shift. Selector (recovered from the pre-0.6.0 `mark_read_unread.yaml` history, templated by mode): `div[role='button'][aria-label='Mark as {{inputs.mode}}'][data-tooltip*='Mark as {{inputs.mode}}']`.

The v0.6.0 atom changelog's "toolbar absent in search" referred to the **no-selection** state; the bulk toolbar DOES appear in search (and every view) **once ≥1 row is selected** (user-observed 2026-06-05 on a search-results page with 3 selected). This is the basis for a proposed `mark_selected_read_unread` atom (no `thread_id`; acts on the live selection) — see [pipeline/24-notes-processing-redesign.md] P1-P3 findings. **Caveat:** recovered from git history + user observation, NOT live-re-probed this session (debug Chrome was down) — verify the selector + the multi-select success snackbar text ("N conversations marked as read."?) live before authoring.

### 12. Modal close is NOT uniform: "New label" is not `role=dialog`, and compose is server-sticky (live-probed 2026-06-06, first map crawl)

Two findings from the `/map-saas gmail` map crawl that break naive modal handling:

- **The "New label" dialog (from the `+` / "Create new label") is NOT `div[role='dialog']`** (unlike compose, gotcha #3). A `role=dialog` modal-detector reports `0` while it is plainly on screen, so it is never detected, never closed, and pollutes every later view. Its controls are `button.mUIrbf-I-ql-Uw…` ("Create" / "Cancel"). **Do NOT trust `role=dialog` to find every modal** — verify open/closed state from a **screenshot**, not the DOM.
- **Compose is server-sticky.** A `tabs.reload` of `#inbox?compose=new`, and even a navigate to clean `#inbox` THEN reload, both RESTORE compose (Gmail re-adds `?compose=new` from the saved session) — even when it is empty. Synthetic `.click()` on Save&close and `navigate` both fail to close it. Only a **trusted CDP `Input.dispatchMouseEvent`** on Discard (`div[aria-label^='Discard draft']`) / Save&close cleared it. So "reset to clean state" for compose = trusted Discard, not reload.

Consequence for the crawler's `resetToCleanState` (doc 26 §5): hard-reload first, then **screenshot-verify** the clean baseline (catches the non-`role=dialog` create-label AND the reload-surviving compose), then escalate to a trusted Discard/Cancel on the visible surface.

### 13. Compose autosave + the three-terminal close model (live-probed 2026-06-07; the signals-model basis)

The compose family (`send_email` / `reply_email` / `reply_all_email` / `forward_email` / `draft_email`) now uses the spec-70 SIGNALS MODEL — a flavor-level named `signals:` map + `when:`/`not:` outcome predicates (`drafted` = `when:[closed] not:[sent,discarded]`).

> ✅ **LIVE-VERIFIED end-to-end 2026-06-07 (with cd2k).** Drove `send_email` 0.13.0 via `/run-blueprint gmail send_email_hitl_tester` (HITL preview → hand-off) and exercised all THREE terminals in one session, MCP attached: **Send → `sent`**, **trash/Ctrl+Shift+D → `discarded`** ("Draft discarded."), **X/Save&close → `drafted`**. The `drafted` terminal's `draft_id` (captured via `from_signal: autosave.draft_id`) round-trips: the persisted draft reopened at `#…?compose=CllgCKCHVNBjBQxxtmvtCsQT…` (a 70-char token matching the autosave_signal `[A-Za-z0-9]{20,}` pattern). This was the plumbing-confidence check the signals-model migration needed — the `when:`/`not:`/grace routing resolves the right terminal live, not just in the unit-proven runner glue (1b4be9ad). **Drove fine with chrome-devtools MCP attached** — the runtime is CDP-free (synthetic events via chrome.scripting, never chrome.debugger; see chrome-step-driver.ts:101), so the "MCP-vs-runtime CDP conflict" only applies if heal fires (it didn't — proven selectors).

The DOM facts behind it, all live-probed 2026-06-07:

- **Two compose surfaces, and they need DIFFERENT `closed` signals.** `send_email` / `draft_email` open the docked compose (`?compose=` in the URL) with a VISIBLE `subjectbox` → their `closed` signal is `selector_disappears input[name='subjectbox']` (correct for docked). `reply` / `reply_all` / `forward` use the INLINE composer at the thread bottom (`div[role='region'][data-compose-id]`, class `aoI`; triggers `.ams.bkH` reply / `.ams.bkG` forward / the per-message More-menu Reply-all). ⚠️ **CORRECTION (2026-06-07): the inline composer's `subjectbox` is present BUT COLLAPSED TO 0px (`w:0/h:0`)** — so `selector_disappears input[name='subjectbox']` fires the INSTANT the inline composer opens (selector_disappears checks VISIBILITY, and a 0px element reads as gone). That made reply's `drafted` resolve immediately + the commit:false HITL wait vanish before the user could act (caught live; reply/reply_all/forward 0.12.0). **The inline composer's `closed` signal must be `selector_disappears div[role='main'] div[role='region'][data-compose-id]` — the REGION (visible h~234 while open, removed on close; live-verified 1→0 on discard).** Lesson: `selector_disappears` keys on visibility, so a present-but-0px element counts as disappeared — probe SIZE, not just presence (reply 0.10.0's "subjectbox is present" probe missed the collapse). ⚠️ **FOLLOW-ON (2026-06-08, live v71 reply drives): a reported `outcome: drafted` on a commit:false reply is CORRECT nav-away behavior, not a bug.** Switching threads (or navigating away) removes the inline reply composer and Gmail autosaves the draft → `drafted` (the terminal IS defined as close / navigate-away). Proven by two drives: a full 10-min quiet sit (no nav) produced NO drafted (resolved `cancelled`); switching threads produced `drafted`. So `drafted` requires a real composer removal — it does not fire on a quiet open composer. SEPARATELY hardened a fragile runtime pattern found while investigating: `selector_disappears` resolved its terminal on the FIRST absent 100ms poll (chrome-signal-driver.ts), so any single transient re-render could fire `closed`; it now requires 3 consecutive absent polls (~300ms) before firing (defense-in-depth; does NOT change the correct nav-away result). NOTE: the inline-reply HITL 'review & Send' wait does NOT survive a thread switch (composer gone → drafted); the docked compose (send_email) DOES survive nav — an open product question if that matters.
- **Autosave flips the URL — but only with a recipient.** The docked compose flips `?compose=new` → `?compose=<handle>` ONLY once a To recipient lands (subject+body alone stay at `new`). `<handle>` is a long alnum token (`{20,}`); navigating to `#...?compose=<handle>` reopens the EXACT draft. That handle is the browser `draft_id` (web-composer namespace, NOT the REST Draft.id; mcp/oauth return that). The INLINE reply composer does NOT flip the URL at all — no `?compose=` handle, so reply/forward `drafted` returns `draft_id:null` (the in-DOM `input[name='draft']` is a non-reopenable `#msg-a:r…` ref).
- **Three terminals, shared `div[role='alert']` host (`.b8.UC` / inner `.bAq`):** `sent` → "Message sent"; `discarded` → "Draft discarded."; `drafted` → SILENT (the compose closed with NO toast; the autosaved draft persists). **CORRECTION:** a discard DOES toast — for send/reply/forward AND draft. The old "a Gmail draft discards silently" claim (it even lived in the integration-completeness Trap-2 allowlist) was an un-screenshotted assumption; removed 2026-06-07.
- **Docked-compose Save&close = `img.Ha` aria-label "Save & close", in the TITLE BAR (OUTSIDE the `data-compose-id` region).** A raw `.click()` on the img does not trigger it (the handler is on a parent — the `gmail.compose_close_button` widget handles it). Save&close is silent → `drafted`.
- **The reply snackbar has NO `#link_vsm` ("View message"), only `#link_undo`** — reply/reply_all/forward have no post-send nav hook; the reply lands in the current thread and `h2.hP[data-legacy-thread-id]` (== the compose's `input[name='lts']`) is the thread_id throughout. send_email's compose DOES get `#link_vsm` (its `sent` outcome's `then:` clicks it → ThreadView for the 16-hex message_id/thread_id). The reply's own `message_id` (no `#link_vsm` to navigate to) is the **LAST** `div.adn.ads[data-legacy-message-id]` on the thread — the just-sent reply, which lands newest/expanded at the bottom. Extract it with **`from_selector_last`** (the extract twin of the click step's `pick_last`); plain `from_selector` took the OLDEST message = wrong, which is why reply/reply_all `message_id`+`message.Id` were stubbed null before 0.14.0. All three flavors now return the flat `{message_id, thread_id}` pair (MCP parity — `gmail.send_email`'s `output_schema`; mcp/oauth read them from the API response).

### What's reliable across Gmail UIs

- `aria-label` (when present — see gotchas above for exceptions)
- `role` attributes (`combobox`, `option`, `dialog`, `textbox`, `menuitem`)
- `peoplekit-id` (Google's own widget IDs; stable)
- `data-hovercard-id` (always set on resolved recipients)
- `data-legacy-thread-id` (set on row spans)
- `data-compose-id` (stable per compose dialog through its lifecycle)

### What to AVOID

- `name` attribute on most inputs (often null)
- `act=` codes on action buttons (internal, drift)
- generated classes (`afV`, `aGb`, `T-I-ax7` etc. — change with builds)
- `aria-label*=` substring match on menuitems (no aria-label exists)
- `:nth-of-type(1)` / `:first-child` on menuitems (false-success footgun)
- document-global `tr.zA` row selectors (match Gmail's DETACHED inbox cache — always scope to `div[role='main']`; see gotcha #6)

---

## L4 confirmation snackbars per action (live-probed 2026-05-27)

Per [atom-methodology.md Rule A](../../onboarding/prompts/atom-methodology.md) (snackbar-first), every browser-flavor write atom's L4 outcome signal should be a positive snackbar match: `selector_appears [role='alert']` + `must_contain_text:` with the literal Gmail string below. Captured via MCP CDP-trusted click probes.

| Action | Snackbar text (after success) | Atom |
|---|---|---|
| apply_label | `Conversation added to "<label>".` | apply_label 0.8.0 |
| create_label | `The label "<name>" was created.` | create_label 0.2.0 |
| archive | `Conversation archived.` | archive_email 0.7.0 |
| delete (Trash) | `Conversation moved to Trash.` | delete_email 0.7.0 |
| move | `Conversation moved to "<destination>".` | move_email 0.7.0 |
| send / reply / forward | `Message sent` | send/reply/forward_email 0.9.6 |
| discard (compose trash / Ctrl+Shift+D) | `Draft discarded.` | send_email 0.11.0 (positive `discarded` outcome) |
| mark unread | `Conversation marked as unread.` | mark_read_unread 0.5.0 |
| mark read | `Conversation marked as read.` | mark_read_unread 0.5.0 |

mark_read_unread uses `must_contain_text: 'Conversation marked as {{inputs.mode}}.'` — one mode-interpolated signal covers both ux_decision branches (live-probed both modes 2026-05-28).

**Silent actions (no snackbar exists, even on success):**

- `star_email` — starring is SILENT (live-probed 2026-05-28). The honest L4 is the row star's `aria-label` flipping `Not starred` → `Starred` (Gmail also adds class `T-KT-Jp`). Atom uses an entity-scoped `selector_appears tr.zA:has(...) span[role='button'][aria-label='Starred']`. Surprising asymmetry: mark_read_unread (a sibling toggle) DOES snackbar, but starring doesn't — always probe, never assume by analogy.
- `draft_email` save-on-close (the X / "Save & close" icon) — drafts auto-save continuously while typing; **closing is silent** (no toaster). Re-confirmed live 2026-06-07: clicking "Save & close" produced no `[role='alert']` at all, while the Drafts count incremented (the draft had already been autosaved). This is the genuinely-silent terminal — distinct from discard (which DOES toast, see above).

> ⚠️ CORRECTION (2026-06-07, live-probed with cd2k): a prior version of this file listed `discard_draft (the trash icon)` as SILENT. **That was wrong** — it was never screenshotted. Discarding a compose (trash icon OR Ctrl+Shift+D) fires `Draft discarded.` (+ Undo) in the SAME `div[role='alert'][aria-live='assertive'].b8.UC` snackbar host as `Message sent` (inner text node `.bAq`). The captured-via-MutationObserver-poll log: `{role:'alert', live:'assertive', cls:'b8 UC bAp', text:'Draft discarded.\\n  Undo'}`. send_email 0.11.0 makes discard a POSITIVE `discarded` outcome on this text.

**Compose terminals — the spec-70 three-terminal model (send_email 0.11.0, live-probed 2026-06-07 with cd2k).** Creating an email is `autosave → complete | discard`:

- **autosave** — Gmail persists the draft ~190ms after CONTENT (subject/body) is entered; NOT on To alone (a To-only compose sat 53s with no save), NOT on open (open only reserves an internal `thread-a:r-…` token). The compose URL flips `?compose=new` → `?compose=<handle>` (the web-composer handle — a long alphanumeric token, e.g. `GTvVlcSGLPhj…`). `send_email` 0.11.0 captures it via a flavor-level `autosave_signal: { type: url_matches, pattern: "[?&]compose=(?<draft_handle>[A-Za-z0-9]{20,})", extract: { draft_id: { from_url_match: draft_handle } } }`. This handle is NOT the REST/MCP `draft_id` (the browser DOM never exposes that; mcp/oauth flavors return it) and NOT the 16-hex message/thread id (those are network-only, MV3-unreadable). Navigating to `#…?compose=<handle>` reopens the EXACT draft (subject + recipients intact — live-verified) to send/discard.
- **sent** (complete) — `Message sent` toast → ThreadView (16-hex ids, as before).
- **discarded** — `Draft discarded.` toast (positive; see the correction above).
- **drafted** (persist) — close-X ("Save & close") is silent; the autosaved draft just stays. The `abandon_signal: selector_disappears input[name='subjectbox']` is now the NAMED `drafted` fallback (`action: drafted` + `extract: { drafted:true, draft_id: {from_autosave: draft_id} }`), so close-X returns the reopen-able handle instead of a generic `cancelled`.

All three race "all at once" — spec 70 §6 first-to-fire over `outcomes:` (sent, discarded) + the spec-72 grace window arbitrating the shared compose-close (so a silent close falls to `drafted`, a real send/discard's toast wins). **UPDATE 2026-06-07: `reply_email` / `reply_all_email` / `forward_email` are now ALSO on the signals model (all 0.10.0, migrated in 67fdd1b7)** — the earlier "still use the OLD model" note here was superseded the same day. The speculation that "their compose has no `subjectbox`" was DISPROVED live: `input[name='subjectbox']` IS present in the inline reply composer (collapsed, value `Re: …`) and disappears on close, so reply reuses send_email's `closed` signal. The one real reply-vs-send difference: the inline composer never flips the URL to `?compose=`, so reply's `drafted` returns `draft_id: null` (the in-DOM `input[name='draft']` `#msg-a:r…` ref isn't URL-reopenable). See reply_email 0.10.0's changelog (4 findings) + gotcha #13.

For these, the [L4 negation ladder](../../onboarding/prompts/atom-methodology.md) (atom-methodology.md Rule B) applies:
1. Scoped `selector_disappears` on `div[role='dialog'][data-compose-id='<id>']` (entity-specific; the current `draft_email` 0.6.0 uses this)
2. URL transition: `?compose=` parameter is removed from the URL
3. Network observation
4. Read-back via independent atom

---

## Result id extraction: thread_id vs message_id (browser flavor)

Two distinct 16-hex ids exist on a ThreadView, live-verified 2026-05-28.
They are NOT interchangeable; the message_id ≠ the thread_id (the
browser flavor must return the same shape mcp/oauth do, or downstream
atoms chaining on `message_id` get a thread id).

| Id | DOM source | Where it's used |
|---|---|---|
| **thread_id** | `h2.hP[data-legacy-thread-id]` (subject header) | EVERY downstream atom (apply_label, archive_email, move_email, star_email, mark_read_unread, …). Always extract thread ids from here. |
| **message_id** | `div.adn.ads[data-legacy-message-id]` (per-message wrapper, one per message in the thread) | The message-id slot in send/reply/forward results. Matches the format mcp/oauth return. |

Extraction rules per atom:
- `thread_id` / `message.ThreadId` → always `h2.hP[data-legacy-thread-id]`.
- `message_id` / `message.Id` → `div.adn.ads[data-legacy-message-id]` ONLY
  when the post-action ThreadView has a SINGLE message (a fresh
  `send_email` — `from_selector` takes the first = only match).
- For replies (`reply_email`, `reply_all_email`): `div.adn.ads` matches
  oldest-first, so `from_selector` would grab the WRONG message. Return
  `message.Id: literal null` until the extract DSL gains a last-match
  selector (follow-up: `from_selector_last` / nth support, then reply
  atoms can extract `div.adn.ads:last-of-type[data-legacy-message-id]`).
  mcp/oauth flavors return the real message id.
- `forward_email` / `draft_email`: browser flavor returns `message: null`
  (the destination/draft message id isn't readable from the source DOM).

### Recipient (To) extraction — browser flavor (live-probed 2026-06-07)

`read_email` 0.9.0 populates `to` from the open ThreadView (was
`literal: null`). Live-probed on 3 threads (a bounce + 2 self-sends):

| Field | DOM source | Notes |
|---|---|---|
| **From** | `div[role='main'] span.gD[email]` | sender; the `gmail.thread_from` widget already reads the `email` attr. One per message header. |
| **To** | `div[role='main'] span.hb span.g2[email]` | recipient chips inside the "to …" summary line. The `email` attribute carries the FULL address even when the display shows a name ("to me"). |

- Extract via `from_selector_all` + `attr: email` in the **outcome
  extract block**, NOT `read_fields`/`read_field` — those collapse a
  `list<>` field to a single value (step-executor.ts:721), so a
  schema-routed `To` would silently drop all but the first recipient.
  (The write side already iterates `list<>` per item, fill_fields
  step-executor.ts:647 — reads have no equivalent yet; a `read_attribute_all`
  archetype + list-aware `read_field` would be the symmetric fix.)
- **Collapse caveat:** `span.hb` is the always-present summary; Gmail
  lazily renders very large recipient lists into the expand-details
  table (`table.cf`, only after the ▼ "Show details" caret `div.ajy` is
  clicked), so the summary CAN be partial on bulk-recipient threads. For
  guaranteed-complete enumeration use the `oauth_api` flavor (full
  headers) — which is the preferred read path anyway (spec 70 §7).
- **`attachments`** stays `literal: []` in BOTH browser AND oauth (not a
  browser-only gap). oauth has `payload.parts[].filename/attachmentId`
  but the extract DSL path syntax can't filter+map an array; the browser
  would scrape the `.aZo` attachment chips. Tracked follow-up.

---

## In-place vs separate-tab writes (`tab_mode`, was `runs_in_home_tab`)

Most Gmail writes are in-place modals or toolbar actions — they happen on the user's CURRENT Gmail tab, not on a separate edit URL. The runtime defaults to opening a fresh edit tab for `commits_changes:true` writes (spec 71 §3.3, Salesforce pattern); Gmail's in-place writes opt out via `tab_mode: current`.

> **v71 update (2026-06-08): COMPLETE, gmail is 16/16 on `tab_mode`.** The tab model is now the canonical `tab_mode: current | new` field (CANONICAL_ACTION_FORM.md), not the old booleans. Mapping: `tab_mode: current` = act in place on the user's tab (was `runs_in_home_tab: true`, and the default for reads); `tab_mode: new` = a fresh tab (was the own-edit-tab default for compose, and `reads_in_fresh_tab` for a cloned read tab; the runtime derives clone-vs-navigate from `depends_on_view`). The compose family is mapped: reply_email / reply_all_email / forward_email = `tab_mode: current` (the in-thread reasons in the matrix below are why); send_email / draft_email = `tab_mode: new`. The matrix below is the canonical record of WHY each in-place write needs the home tab (still true, now expressed as `tab_mode: current`).

| Atom | Reason for `tab_mode: current` (was `runs_in_home_tab: true`) |
|---|---|
| `apply_label` | Right-click context-menu "Label as►" on the row (any list view) |
| `create_label` | Sidebar Create-new-label modal on inbox |
| `archive_email` | Right-click context-menu "Archive" on the row (any list view) |
| `delete_email` | Right-click context-menu "Delete" on the row (any list view) |
| `move_email` | Right-click context-menu "Move to►" on the row (any list view) |
| `mark_read_unread` | Right-click context-menu "Mark as read/unread" on the row (any list view) |
| `star_email` | In-place row star toggle on the row (any list view) |
| `reply_email` | **In-thread** action (0.11.0): the inline composer opens INSIDE the open thread, so the atom must run where the thread + its list live. ThreadView's entry (0.7.0+) row-clicks the thread in the CURRENT tab's list (no nav); an own blank edit tab has no list → `await_row` timeout. See gotcha below. |
| `reply_all_email` | Same as reply_email (0.11.0) — in-thread, More-menu → Reply-all trigger. |
| `forward_email` | Same as reply_email (0.11.0) — in-thread, `.ams.bkG` Forward trigger (also needs a To recipient, unlike reply). |

Writes that DO open a separate tab (`tab_mode: new`):
- `send_email`, `draft_email` — these compose a NEW message with no thread dependency, so a fresh own compose tab is correct (HITL pattern per spec 71).

> ⚠️ **In-thread writes must run in the home tab (regression fixed 2026-06-07).** reply/reply_all/forward were own-tab until the 2026-06-07 re-drive surfaced a latent break: ThreadView's entry redesign in 0.7.0 (2026-05-29) made the thread open via a current-view row-click (no nav), pairing with read_email's `reads_in_fresh_tab` (which CLONES the home list into the read tab). A write's `wantsOwnTab` blank edit tab has no list, so the row-click's `await_row` timed out at 15s. They weren't re-driven after 0.7.0, so it stayed latent. Fix: `runs_in_home_tab: true` on all three (cd2k chose this over a clone-list-for-writes runtime mode) — the home tab already holds the search/inbox list the row-click needs.

**Rule for new Gmail write atoms:** if the action is a toolbar button / context-menu item / in-place modal / **in-thread composer** on the user's current view, set `tab_mode: current` (it needs the current view's DOM + list). Only a NEW-compose surface with no dependency on the current thread/list (send_email, draft_email) uses `tab_mode: new` (spec 71 §3.3).

### Reads: cloned fresh tab (`tab_mode: new` for reads, was `reads_in_fresh_tab`)

Reads default to the shared home tab. A browser READ whose cold-open would otherwise hijack the user's current view opts into a fresh ephemeral tab via `tab_mode: new` (was `reads_in_fresh_tab: true`; for a read the runtime derives clone-vs-navigate from `depends_on_view`, and a current-view entry like ThreadView clones). The runtime clones the home tab's CURRENT list URL (#search / #inbox / #label) into a fresh tab, runs the read recipe there (ThreadView's current-view row-click), scrapes, then closes the tab — the user's list view never moves.

| Atom | `tab_mode` (was `reads_in_fresh_tab`) | Why |
|---|---|---|
| `read_email` | `new` (v71; was `reads_in_fresh_tab: true` 0.8.0) | The /agent loop's "search → read each result" must not thrash the search list. The clone re-renders the same results so the target row is present; ThreadView 0.7.0 clicks it without force-navigating to Inbox. |

**Why not a URL deeplink:** the 16-hex `data-legacy-thread-id` is NOT URL-routable (live-disproved 3 ways 2026-05-28 — see ThreadView changelog); only a row CLICK mints Gmail's permalink. So the read must run in a list that already contains the row — hence "clone the current list" rather than "deeplink a fresh tab straight to the thread."

**Limitation:** the target thread must be in the cloned list. Threads not in it (archived, beyond the rendered page) use the `oauth_api` read flavor (id-agnostic `users.threads.get`, no tab/nav) — the robust batch path per spec 70 §7. Browser-in-fresh-tab shines for "act on a recent search/inbox result"; oauth shines for "summarize N arbitrary threads."

**Rule for new read atoms:** set `tab_mode: new` only when the browser cold-open would disrupt the user's current view AND the target is reliably in the current list. Otherwise prefer the API flavor for reads (spec 70 §7: reads prefer mcp/oauth > browser).

---

## Heal hints (forward-looking, not yet wired)

When heal-context-builder.ts is extended to load this gmail.md, the following gotchas should be surfaced as system-prompt hints WHENEVER heal is patching a Gmail recipe:

1. If failure is `pick_match` step in a typeahead menu: try `must_contain_text` on `[role='menuitem']`, NOT `aria-label*=`.
2. If failure is a toolbar action button: try exact `aria-label='<X>'` match, NOT `[act='N']` codes.
3. If outcome signal uses `selector_disappears` for a commit: check this gotcha table for the action's snackbar text and switch to positive `selector_appears [role='alert']` + `must_contain_text:`.

---

## See also

- [atom-methodology.md](../../onboarding/prompts/atom-methodology.md) — CANONICAL L0 methodology (5 layers, signal-type table, 5 traps, authoring rules A-G). SaaS-agnostic. Heal LLM + /debug-atom + browser-flavor authors all follow this.
- [/debug-atom skill](.claude/skills/debug-atom/SKILL.md) — procedural wrapper for human-Claude (chrome-devtools MCP probe patterns, snackbar-capture, MCP-vs-runtime CDP conflict).
- [reference_gmail_dom_quirks.md](.claude/projects/-home-cd2k-work/memory/reference_gmail_dom_quirks.md) — same gotchas in cross-session memory form (auto-loads each session)
- [reference_gmail_compose_write_flow_architecture.md](.claude/projects/-home-cd2k-work/memory/reference_gmail_compose_write_flow_architecture.md) — compose flow architecture
- [planning/tech_design/integrations/platform-notes/gmail.md](anvisio/planning/tech_design/integrations/platform-notes/gmail.md) — human orientation, links here for the canonical gotchas
