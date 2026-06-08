---
name: manifests/google-calendar/google-calendar.md
version: 0.6.0
cdn_schema_version: 70.0.0
authored_by: cd2k + claude
authored_at: 2026-05-28
---

# Google Calendar

Web calendar at `https://calendar.google.com`. Single-page application;
landmark navigation is **path-based** (NOT hash-based like Gmail):
`/calendar/u/<N>/r/<range>` where `<range>` is `day` / `week` / `month` /
`year` / `agenda` / `schedule` and `<N>` is the multi-account index
(`u/0` = first signed-in account). The event editor is its own route
(`/r/eventedit/<eid>`), the search results live at `/r/search?q=<query>`.
Authenticated by the user's Google session cookie — no separate OAuth
step at run time.

> Authoring status (0.1.0, 2026-05-28): this doc was seeded from the
> existing hand-authored manifest (2026-05-22/24), the 2026-05-15
> `/onboard-saas` CRUD-chain session, and the verified
> `reference_google_workspace_api_paths` probe (2026-04-16). It has NOT
> yet been through the `/harden-browser-flavor` live loop under the
> current methodology. Items below are tagged **[verified]**,
> **[research-only]**, or **[needs-live-probe]** so the next session
> knows what to trust.

## Three sources feeding propose

1. **MCP catalog** (`_mcp_tools.yaml`) — 11 tools mirrored from
   `nspady/google-calendar-mcp` (chosen 2026-05-22 over the official
   `calendarmcp.googleapis.com` server for the richer surface:
   `search-events` + `get-freebusy` matter for the scheduling
   blueprints). 9 of the 11 map to atoms; `list-colors` and
   `get-current-time` have no atom yet (see Known gaps). Each atom
   carries `mcp_tool: google-calendar.<tool>`.

2. **Web research** — the Google Calendar API v3 Event / CalendarListEntry
   resources ground the schemas; the calendar.google.com DOM grammar
   (aria-labels, `data-eventid`, the `/r/<range>` URL scheme) grounds the
   widget selectors.

3. **Live DOM** — calendar uses kebab-hashed CSS, so every selector is
   anchored on `aria-label` / `role` / `data-eventid`, never class names.
   The widget library header is explicit: selectors are
   **research-grounded, NOT live-DOM-verified**. Heal patches them on the
   first onboarding run.

## Transport priority (spec 70 §7) — and the calendar reality

The spec-70 priority strings in the atoms say:

- **Writes** (`commits_changes: true`) prefer `browser > oauth_api > mcp`:
  the user sees the event appear / change / vanish in their own calendar.
- **Reads** (`commits_changes: false`) prefer `oauth_api > mcp > browser`
  (search/get) or `session_api > mcp > browser` (list_events).

**But the available-auth reality differs sharply from Gmail, and this is
the single most important fact about calendar:**

`reference_google_workspace_api_paths` (verified 2026-04-16) established:

- The public REST host `https://www.googleapis.com/calendar/v3/...` —
  which **every** `oauth_api` flavor in this manifest targets — returns
  **403 "Method doesn't allow unregistered callers"** when called with
  only the user's session cookie. It requires a real OAuth bearer token.
- The **`gapi` JavaScript client**, loaded by Calendar's own UI and run
  from a `calendar.google.com` MAIN-world `executeScript`, gives **full
  Calendar CRUD + freebusy with NO OAuth** — it piggy-backs on the
  session cookie. This is the `session_api` flavor
  (`call_platform_api kind: gapi`).

So in the **default posture** (Google session cookie, no configured
OAuth token, no running MCP server) the flavor-picker skips `oauth_api`
(no token) and `mcp` (no server), leaving:

- **Reads:** `browser` (degraded — see table) OR `session_api` — **but
  only `list_events` currently has a `session_api` flavor.**
- **Writes:** `browser` (works).

### Transport reality table (what actually works with only a session cookie)

| Atom | kind | browser flavor | session_api (gapi) | oauth_api (googleapis.com) | mcp | works w/ session cookie alone? |
|---|---|---|---|---|---|---|
| `list_events` | read | lands on grid, `events:null` | ✅ `events.list` **[verified]** | 403 (needs token) | needs server | ✅ via session_api |
| `search_events` | read | URL→`/r/search`, `events:null` | ✅ **`events.list`+`q`** (added 0.3.0, live-verified) | 403 | needs server | ✅ via session_api |
| `get_event` | read | opens editor, reads 5 fields | ✅ **`events.get`** (added 0.3.0; no chip needed) | 403 | needs server | ✅ via session_api |
| `list_calendars` | read | sidebar rendered, `calendars:null` | ✅ **`calendarList.list`** (added 0.3.0, live-verified) | 403 | needs server | ✅ via session_api |
| `get_freebusy` | read | (none — not in DOM) | ❌ still **MISSING** (`freebusy.query` works but needs `items:[{id}]` shaping) | 403 | needs server | ❌ **nothing works** — add session_api (B1 follow-up) |
| `create_event` | write | fill editor (via More options) + Save; recurrence via RRULE | (browser-first) | 403 | needs server | ✅ via browser (incl. recurring) |
| `update_event` | write | edit pencil + Save + scope dialog **[recurring handled]** | (browser-first) | 403 | needs server | ✅ via browser (incl. recurring) |
| `delete_event` | write | trash + confirm + scope dialog **[recurring handled]** | (browser-first) | 403 | needs server | ✅ via browser (incl. recurring) |
| `respond_to_event` | write | RSVP button **[research-only]** | (no oauth RSVP endpoint) | n/a | needs server | ⚠️ browser only, unverified |

**The headline finding:** calendar is **gapi-first for reads**, the
opposite of Gmail (which is browser-first / OAuth-required for reads
because Gmail's gapi is blocked — see that memory). The browser read
flavors are intentional **degraded fallbacks** that return `null` event
data (except `get_event`, which reads the editor form). The
`/harden-browser-flavor` loop's usual goal ("make the browser scrape
correct") therefore does NOT apply to calendar reads — the right move is
to **add `session_api`/gapi flavors**, mirroring `list_events 0.3.0`.
**Done 2026-05-28** for `search_events` (`events.list`+`q`), `get_event`
(`events.get`), and `list_calendars` (`calendarList.list`) — all
live-verified 200 on cd2k's account. **`get_freebusy` remains** (gapi
`freebusy.query` works but needs `items:[{id}]` shaping that the recipe
DSL can't do per-element — the same gap its existing `oauth_api` flavor
has), so `schedule_meeting` still cannot run on a session cookie alone
until that's fixed.

## Authoring conventions

- **Create / update** open the **EventEditor** (`/r/eventedit`). create
  goes CalendarGrid → Create button → "Event" menuitem → editor; update
  goes via the **EventDetail** popup's edit pencil. The recipe fills the
  form; commit mode clicks Save, preview mode stops at the filled editor
  for the user to Save themselves (spec 71 HITL).
- **get / delete / respond** all operate on the **EventDetail** popup,
  reached by clicking the event's **chip on the grid**
  (`event_chip[data-eventid={{event_id}}]`). This means the event must be
  **visible on the currently-rendered grid range** for the browser flavor
  to find its chip — see DOM gotcha #2.
- **list / search / list_calendars** are read-landing recipes in the
  browser flavor (navigate + wait for landmark); structured data comes
  from the API flavor.
- Writes use `commit: true` on the committing step (`event_save` /
  `event_delete_button` / `rsvp_button`). The widget library flags
  `event_save` and `event_delete_button` `irreversible: true`.

## Known gaps

- **`session_api` flavors** — DONE 2026-05-28 for `search_events`,
  `get_event`, `list_calendars` (all 0.3.0; `call_platform_api kind: gapi`,
  `url_matches` outcome since the gapi call completes inside the recipe).
  **`get_freebusy` STILL MISSING**: gapi `freebusy.query` works (200
  live) but wants `items:[{id}]` while the atom input `calendars` is
  `[string]` — the recipe DSL can't map per-element, and the existing
  `oauth_api` flavor has the same latent bug. Fix needs either an input
  contract change (accept `[{id}]`) or runtime list-shaping support.
- **create/update set the event date AND time — DONE** (datetime_split
  archetype, 2026-05-28; widget lib 0.3.0). The editor splits Start/End into
  separate date + time inputs (gotcha #4b); event_start/event_end fill both
  from one ISO datetime.
- **`search_events` session_api ignores `time_min`/`time_max`** — gapi
  `events.list` rejects empty-string time bounds (live-confirmed) and the
  recipe can't conditionally include them, so the gapi flavor is q-only.
  `oauth_api`/`mcp` still honor the window. Conditional-arg support is the
  fix.
- **Recurring-event scope — DONE** (2026-05-28). update_event / delete_event
  carry a `recurring_scope` input (single/all/following) → MCP
  `recurringUpdateScope`, and the browser flavors drive the "This event /
  This and following / All events" radio dialog via `resolve_recurring_scope`
  (commit-mode only; user-resolved in preview). See gotcha #3.
- **`get_freebusy` has no browser flavor** (correct — free/busy is not in
  the DOM). But with no `session_api` flavor either, it's API/MCP-only,
  so it's unusable in the default posture. Adding gapi `freebusy.query`
  fixes this.
- **`respond_to_event` has no `oauth_api` flavor** — the Calendar API v3
  has no first-class RSVP endpoint (RSVP is `events.patch` on the
  attendee's `responseStatus`, awkward). browser + mcp only, as authored.
- **`list-colors` / `get-current-time` MCP tools have no atom.**
  `get-current-time` would help the orchestrator resolve relative dates
  ("tomorrow") — low priority since `create-event` accepts natural-language
  times and the orchestrator can compute now() itself.
- **Hardcoded account index `u/0`** in browser-flavor navigate URLs
  (`list_events`, `list_calendars`) and the view `entry.url`s. Breaks for
  users whose calendar is `u/1`+. Should use an `{account_index}`
  placeholder resolved via `view-url-resolver.ts` (cross-cutting — same
  anti-pattern flagged for outlook). [needs-live-probe to confirm the
  resolver handles calendar's path scheme]

## DOM gotchas

The cross-integration methodology lives in
[atom-methodology.md](../../onboarding/prompts/atom-methodology.md); this
section is the Calendar-specific table.

### 1. Event id confusion: API id vs grid `data-eventid` vs `eid` (HIGH)

Three id forms, and they are NOT interchangeable (live-verified 2026-05-28):

- the **API event id** returned by `events.list` / `events.get` / search
  (e.g. `ac8o6863b3vuumkcpteqhopr68`) — what `get_event` / `delete_event`
  / `update_event` take as `event_id`,
- the grid chip's **`data-eventid`** = `base64url(apiId + " " + calendarId)`
  (e.g. `YWM4...QG0`, which `atob`s to `ac8o6863b3vuumkcpteqhopr68 damarlachanu@m…`),
- the editor route's **`eid`** in `/r/eventedit/<eid>` — the **same** eid
  form as the grid `data-eventid`.

So `event_chip`'s old primary `[data-eventid='{{event_id}}']` (with
`event_id` = the API id) **matched zero chips** (verified
`document.querySelector('[data-eventid="<apiId>"]') === null`). The chip's
**`jslog` attribute embeds the RAW API id** (`2:["<apiId>",…]`) and
`div[role='button'][jslog*='<apiId>']` matched **uniquely** — so
`event_chip` was reordered to make the jslog selector PRIMARY (widget
library 0.2.0). The browser flavors of `delete_event` / `respond_to_event`
depend on this. **For by-id READS, prefer `get_event`'s `session_api`
flavor (gapi `events.get`) — it needs no chip at all** and sidesteps the
encoding entirely.

### 2. EventDetail requires the chip on the currently-rendered grid range [research-only]

`event_chip` only matches if the event is visible on the grid view that's
currently loaded (a specific week/month). "Get arbitrary event by id"
fails if the event is in another week. The 2026-05-15 CRUD chain sidestepped
this by creating then immediately operating in the same week. Real-world
get/delete/rsvp-by-id needs either a nav-to-the-event's-date step first,
or (better) the gapi `session_api` path for reads. Reinforces the
"add session_api" recommendation.

### 3. Recurring-event Save / delete pops a scope dialog (handled in commit mode)

Saving an edit to, or deleting, a **recurring** event opens a second
radio dialog ("This event / This and following / All events") before the
change commits. `update_event` / `delete_event` now carry a
`resolve_recurring_scope` step (after Save/trash, `commit: true`) that
picks the radio matching the `recurring_scope` input and clicks OK; it
no-ops on single events (no dialog). In **preview** mode (Save skipped)
the user resolves the dialog themselves — the launch posture, so this only
matters for automated commit-mode runs. Detection keys on a scope option
label, not a bare `[role='dialog']`, because the EventDetail popup is also
a `role=dialog` (would otherwise false-match after a single-event delete).

### 4. Editor field selectors (live-verified 2026-05-28)

The aria-labels often differ from the placeholder text — note `'Title'`
vs `'Add title'`, `'Guests'` vs `'Add guests'`, `'Add location'` vs
`'Location'`. Don't author selectors from placeholders.

| Widget | Selector |
|---|---|
| `event_title` | `input[aria-label='Title']` (id `#xTiIn`) |
| `event_start` (date) | `input[aria-label='Start date']` (id `#xStDaIn`) |
| `event_end` (date) | `input[aria-label='End date']` (id `#xEnDaIn`) |
| `event_location` | `input[aria-label='Add location']` |
| `event_guests` | `input[aria-label='Guests']` |
| `event_description` | `[aria-label='Description']` (textbox) |
| `event_edit_button` | `button[aria-label='Edit event']` |
| `event_delete_button` | `button[aria-label='Delete event']` |
| `event_save` | `button[aria-label='Save']` (real `<button>`; the `[role='button']` form does not exist on this page) |

### 4b. The editor splits Start/End into separate date + time inputs (datetime_split archetype)

The event editor has FOUR datetime inputs, not two:
`aria='Start date'` (`#xStDaIn`) + `aria='Start time'` (`#xStTiIn`,
combobox) and `aria='End date'` (`#xEnDaIn`) + `aria='End time'`
(`#xEnTiIn`). `event_start`/`event_end` use the **`datetime_split`**
archetype (date_target + time_target): `fill_text` formats one ISO datetime
into the locale date + time strings and fills BOTH, committing each
(Enter + blur — the combobox doesn't register the typed value on `input`
alone). `fill_fields` fills in SCHEMA order so StartTime lands before
EndTime (setting start auto-shifts end to preserve duration).

**Picker dismiss (Trap 7):** the time + date pickers do NOT close on
Enter/blur — the dropdown lingers open over the editor (looks broken,
though the value committed). The runtime's commit-fill path dispatches an
OUTSIDE click on `document.body` after blur to dismiss the popover
(live-confirmed 2026-05-28: closes the picker, retains the value, the
full-route editor is unaffected; `Escape` does NOT close Google's picker
and can close the whole editor). See
[atom-methodology.md Trap 7](../../onboarding/prompts/atom-methodology.md).

### 5. The create-flow buttons have NO aria-label

The three buttons the create flow clicks (`Create` → `Event` →
`More options`) are plain TEXT-labeled `<button>`s — no `aria-label`,
no `role='button'`, only an obfuscated `jsname` + visible text. Match
by visible text via `click_reveals`' `trigger_text` override
(→ `must_contain_text`), except the Event item which has a stable
`data-key`:

| Affordance | Widget | Live DOM | Selector |
|---|---|---|---|
| Create | `create_button` | `<button aria-haspopup='menu'>` text "Create" | `[aria-haspopup='menu']` + `trigger_text: "Create"` (unique — does NOT collide with "Create appointment schedule") |
| Event (menu item) | `create_event_menuitem` | `<li role='menuitem' data-key='event'>` text "Event" | `[role='menuitem'][data-key='event']` (stable, no text) |
| More options | `more_options` | `<button>` text "More options" | `[role='dialog'] button` + `trigger_text: "More options"` |

The full editor's own controls (title, Recurrence combobox, Custom
dialog) have correct aria-labels — only these three create-*navigation*
buttons need text matching.

### 6. Guests typeahead commits on ENTER, not Tab (live-probed 2026-05-30)

The Guests input is `input[aria-label='Guests']`, archetype `typeahead_chip`. **Calendar Guests does NOT commit a chip on Tab — Tab just moves focus, the typed email is left in the input, no chip forms.** Diagnosed in one read from the first heal-screenshot (commit c0137dee, validated 2026-05-30 on `create_event_with_attendees_tester`): the screenshot showed the email typed in the Guests input, the suggestion dropdown OPEN with the same email highlighted, and NO chip below — Tab had moved focus without picking the suggestion.

**Fix:** `event_guests` widget (google-calendar.widgets 0.7.0) declares `overrides.submit_key: "Enter"`. Enter picks the highlighted suggestion (or commits the raw typed email) → chip forms → `verify_target: [role='treeitem'][data-email='{{value}}']` matches.

**UPDATE 2026-05-31 — Tab is wrong EVERYWHERE, not just Calendar.** The earlier note here claimed Gmail recipients commit correctly on the Tab default. That was false: a controlled live A/B proved synthetic Tab commits NO chip on Gmail compose To either (a synthetic Tab can't trigger the browser's native focus-move, so nothing commits). The archetype default is now **Enter** as of archetype-templates **1.6.0** — so `event_guests`'s explicit `submit_key: Enter` override is now redundant-but-harmless (kept as defense + documentation; also means a stale cached widget predating 0.7.0 still gets Enter from the new default). Gmail additionally needed the `pressKeyInPage` keyCode fix (Calendar tolerates keyCode-less Enter because its handler checks `e.key`; Gmail's PeopleKit checks `e.keyCode`). See gmail.md gotcha #10. If you ship a new typeahead_chip widget for any field, Enter is the right default; only override if a specific picker proves to need a different key against a live input.

### 7. Committed Guest chip is `[role='treeitem'][data-email=<email>]`, not listitem

Live-probed 2026-05-30 on cd2k's account: the committed chip is `<div role='treeitem' aria-label='<email>' data-email='<email>'>`. The earlier (pre-0.6.0) `[role='listitem'][data-email], div[data-hovercard-id]` selector pair matched zero elements and would have failed regardless of any commit-key fix (no chip = no selector). The `{{value}}` substitution in `verify_target: [role='treeitem'][data-email='{{value}}']` ties the verify to the SPECIFIC email just typed — required because `fill_fields` iterates `list<email>` schema fields once per item (each chip is verified individually).

### 8. Guests suggestion `[role=listbox]` orphans open after the last chip commits (live-diagnosed 2026-05-31)

After a multi-guest fill, the chips commit correctly but Calendar can leave its autocomplete `[role=listbox]` (class `Jiyx5`, `id=":g"`) **open**, showing the last query (e.g. `james.wong@globalind.com`) even though the Guests input is blurred (`document.activeElement === body`) and empty. The user sees a "stuck" suggestion dropdown over a correct guest list. The `blur_focus` dismiss step's body-click (phase 1) does NOT close it; neither does a real click on another field (both live-tested). The ONLY reliable dismiss is **Escape dispatched on the owning combobox** (`input[aria-label='Guests']`, which carries `aria-controls=":g"`).

**Fix (chrome-step-driver `blurFocusInPage`, 2026-05-31):** phase 2's reaper also closes an orphaned autocomplete listbox — find a *visible* `[role=listbox]` with an id, find the `[role=combobox]` that owns it via `aria-controls`/`aria-owns`, focus it, dispatch Escape (keyCode 27). Scoped by VISIBILITY + OWNERSHIP, not `aria-expanded` (the orphan can be collapsed yet still rendered). Live-proven safe: Escape on the Guests combobox does NOT discard the event editor even with no dropdown logically open, and Gmail compose has no visible listbox post-commit so the reaper never fires a window-closing Escape there. NOTE: this orphan is timing-dependent in the live runtime (it did not reproduce in synthetic chrome-devtools repros where phase-1 blur closed the listbox first); the reaper is the durable safety net.

### What's reliable (Google convention)

- `aria-label` (`'Add title'`, `'Start date'`, `'Save'`, `'Edit event'`,
  `'Delete event'`, `'Create'`, `'Search'`)
- `role` (`grid`, `dialog`, `button`, `menuitem`, `textbox`)
- `data-eventid` on grid chips (but see gotcha #1 re: id format)
- the path URL scheme `/calendar/u/<N>/r/<range>` (but see `u/0` gap)

### What to AVOID

- kebab-hashed generated classes (change with builds)
- assuming the API id == grid `data-eventid` (gotcha #1)
- hardcoded `u/0` account index (Known gaps)

## L4 confirmation signals (spec 72 ladder, live-probed 2026-05-28)

Each write atom's L4 is the Rule A composite ladder:
`all: [transient_appears [aria-live='polite'] + must_contain_text,
selector_disappears <surface>]`. On a discard the surface closes
(rung 2) but no toaster fires (rung 1), so `all:` misses and the atom
correctly reports not-committed.

Two calendar-specific facts that make the ladder work:

1. **Snackbar selector is `[aria-live='polite']`, NOT `[role='alert']`.**
   Calendar's toast is a TEXT update into a Closure live-region
   announcer (`div[aria-live='polite']`, id like `goog-lr-67`,
   `role=null`) — a screen-reader announcer mirrored as the visible
   snackbar. The runtime's `transient_appears` latch catches text-node
   insertions + characterData specifically for this case (see
   chrome-signal-driver `installLatchObserverInPage`).
2. **Create emits "Event saved", NOT "Event created".** The editor's
   Save button emits the SAME toast for both create AND edit.

| Action | L4 toaster text | Full L4 signal (composite) |
|---|---|---|
| create_event | "Event saved" | `all:[transient_appears [aria-live='polite'] "Event saved", selector_disappears input[aria-label='Title']]` |
| update_event | "Event saved" | `all:[transient_appears [aria-live='polite'] "Event saved", selector_disappears input[aria-label='Title']]` |
| delete_event | "Event deleted" (+ Undo affordance) | `all:[transient_appears [aria-live='polite'] "Event deleted", selector_disappears [role='dialog']]` |
| respond_to_event | (RSVP reflected in popup) | `selector_appears [role='button'][aria-pressed='true']` — speculative, needs live probe |

**Regression guard:** each write tester carries a `*_discard` variant
(commit mode, then cancel/Escape instead of Save) that MUST report
not-committed. Bake it into any new calendar write atom.

## In-place vs separate-tab writes (`runs_in_home_tab`) [OPEN — needs-live-probe]

Calendar writes open the **EventEditor route** (`/r/eventedit`) in the
SAME calendar tab (create) or the EventDetail popup overlay (delete/rsvp).
None of the current atoms set `runs_in_home_tab` or `reads_in_fresh_tab`,
so the runtime's default `commits_changes:true` → fresh-edit-tab behavior
(spec 71 §3.3) applies. Whether that's right for calendar (vs. running the
editor in the home tab like Gmail's in-place writes) is an **open design
question** to settle during the live write-atom pass — see
atom-methodology **Rule H** (in-place writes pick a view-portable
affordance + `runs_in_home_tab`). The editor being a full route (not a
modal) may make the fresh-tab default acceptable here.

## Recurring events (browser path SHIPPED + LIVE-VALIDATED 2026-05-28)

The time-widget fix (datetime_split) handles single events; the browser
recurring path is now built on top. **Create + edit + delete of recurring
events work via the browser flavor:**

> **Live-validated 2026-05-28** (chrome-devtools MCP, cd2k's account):
> `set_recurrence` drove the real Custom dialog correctly for
> `FREQ=WEEKLY;BYDAY=TU,TH;COUNT=6` → "Weekly on Tuesday, Thursday, 6 times"
> and `FREQ=DAILY;INTERVAL=2;UNTIL=20260815` → "Every 2 days, until Aug 15,
> 2026". `resolve_recurring_scope` drove the live "Delete recurring event"
> dialog (`scope=all` → whole series deleted). Two runtime fixes were
> needed and are in (see Heal hints #4/#5): Google's Custom-dialog number
> spinbuttons (Occurrence count, interval) ignore a plain native value set —
> `setInput` now does `focus()`+`select()`+`InputEvent{data}`; and the
> interval/end-condition fields re-render after the frequency change / radio
> click, so the runtime settles + polls (`waitVisible`) before setting them.

- **Create / edit recurrence** — the `Event.Recurrence` field (an RFC 5545
  RRULE) maps to the `event_recurrence` widget (`recurrence_picker`
  archetype). `fill_fields` drives it via the `set_recurrence` runtime
  primitive, which parses the RRULE (FREQ/INTERVAL/BYDAY/COUNT/UNTIL) and
  reconciles the Custom recurrence dialog. Pass nothing → no-op (single
  event). create_event reaches the full editor (where the combobox lives)
  via the new "More options" entry step.
- **Scope dialog (commit mode)** — `update_event` / `delete_event` carry a
  best-effort `resolve_recurring_scope` step (after Save/trash, commit-mode
  only) that drives the "Edit/Delete recurring event" radio from the
  `recurring_scope` input. No-op on single events; in preview mode the user
  picks the scope themselves (launch posture).

The probe findings + the one remaining gap (oauth recurring create) follow.

### Two create surfaces (IMPORTANT)

- **Quick-create popup** — what `Create → Event` actually opens (NOT the full
  editor). Title is `input[aria-label='Add title']` (also `placeholder='Add title'`,
  generated id like `#c320`). It DOES carry separate `Start date`/`Start time`
  inputs in the DOM, but condensed behind a single date/time/recurrence button.
- **Full editor** (`/r/eventedit`) — reached via the popup's **"More options"**
  button OR (for an existing event) the EventDetail edit pencil. Title is
  `input[aria-label='Title']` (`#xTiIn`); Start/End split into `Start date`/
  `Start time`/`End date`/`End time`; Recurrence is `combobox[aria-label='Recurrence']`.

`create_event`'s view entry (create_button → create_event_menuitem) lands on the
**quick-create popup**. The EventEditor entry now clicks **"More options"**
(the `more_options` widget) to reach the full editor, so datetime_split + the
corrected field widgets (event_title='Title') + the recurrence combobox all
apply uniformly with update_event. The entry's landmark is now the full
editor's title `input[aria-label='Title']` (was the popup's `'Add title'`).
**The exact "More options" selector is [needs-live-probe]** — it ships with an
aria-label best-guess + fallbacks (negation ladder); verify on the next live pass.

### Recurrence control + scope dialog (live-probed)

- **Recurrence field:** `combobox[aria-label='Recurrence']` (value "Does not repeat"
  / "Weekly on Thursday, 3 times"). Opening it shows a `listbox[aria-label='Recurrence']`
  of `[role='option']` items (matched by text): "Does not repeat", "Daily",
  "Weekly on <day>", "Monthly on the <nth> <day>", "Monthly on the last <day>",
  "Annually on <date>", "Every weekday (Monday to Friday)", **"Custom…"**. Presets
  are date-relative to the event's start day — pick by text via picklist_select.
- **Custom recurrence dialog** (probed 2026-05-28): `[role='dialog']` heading
  "Custom recurrence". Controls (all stable aria-labels):
  - interval spinbutton `[aria-label$='to repeat']` (label changes with frequency:
    "Days/Weeks/Months/Years to repeat")
  - `combobox[aria-label='Frequency']` (values: day / week / month / year)
  - weekday toggles `button[aria-label='<DayName>']` (Sunday…Saturday, aria-pressed;
    shown for weekly)
  - ends radios `[aria-label^='Recurrence never']` / `[aria-label^='Recurrence ends on']`
    (+ `[aria-label='Date on which the recurrence ends']`) / `[aria-label^='Recurrence ends after']`
    (+ `[aria-label='Occurrence count']` spinbutton)
  - buttons "Cancel" / "Done" (text-matched)
  An RRULE → dialog mapping: FREQ→Frequency, INTERVAL→interval spinbutton,
  BYDAY→weekday toggles, COUNT→"After"+count, UNTIL→"On"+date, else "Never".
- **Scope dialog** (on Save of an edit, AND on Delete): `[role='dialog']`, heading
  **"Edit recurring event"** / **"Delete recurring event"**. Radios are bare
  `<input type=radio>` with GENERATED `name`/`value` (no stable attr) → match by
  LABEL TEXT: "This event" / "This and following" / "All events". The **first
  instance shows only 2 options** ("This event" + "All events"); middle instances
  show 3. Buttons "Cancel" / "OK" (text-matched; classes are generated Material
  suffixes). Single (non-recurring) events show NO dialog.
- **HITL note:** in preview mode (recipe fills, USER clicks Save), the user handles
  the scope dialog themselves — no recipe automation needed. Only commit-mode
  recipes (recipe clicks Save) must drive the scope dialog.

### API facts (live-verified)

- `events.insert` with `recurrence: ["RRULE:…"]` works BUT **requires a `timeZone`
  on start/end** (400 "Missing time zone definition" without it — live-confirmed).
  The current create_event API flavors set neither.
- `events.patch` honors `recurringUpdateScope` (single/all/following) for scoped
  updates. The recurring-instance editor eid is `<masterId>_<instanceUTC>` (a bare
  master-id deeplink loads a blank editor).
- **MCP `create-event` has NO recurrence param** — you cannot create a recurring
  event via the MCP flavor; only oauth_api (recurrence array) or browser (the
  Recurrence combobox). MCP `update-event` does expose `recurringUpdateScope`.

### Runtime-capability gaps (still open)

**Conditional body-field inclusion (oauth recurring create).** oauth_api
`create_event` needs `recurrence`/`timeZone` only WHEN set; the recipe
DSL can't conditionally include a body field (sending `recurrence: [""]`
errors, and `events.insert` 400s without a `timeZone`). Same class as
search_events' empty-time-bound gap. A `prune_empty` request flag would
unblock it. Browser recurring create works today regardless (default
posture); this only blocks the with-token oauth path. MCP `create-event`
has no recurrence param at all — browser/oauth only.

In place:
- **RRULE↔DOM translation** — the `set_recurrence` runtime primitive
  (`step-executor.ts parseRRule` + `chrome-step-driver.ts
  setRecurrenceInPage`) parses FREQ/INTERVAL/BYDAY/COUNT/UNTIL and
  reconciles the Custom dialog.
- **Scope dialog handling** — `resolve_recurring_scope` polls for the
  scope dialog (keyed on a scope option label, since the EventDetail
  popup is also `role=dialog`), matches the radio by label text,
  confirms, and no-ops when absent. Commit-mode only (`commit: true`).

## Heal hints (forward-looking, not yet wired)

When `heal-context-builder.ts` loads this file
([[project-heal-bootstrap-from-integration-md]]), surface these whenever
heal patches a calendar recipe:

1. If a read flavor returns null/empty and the posture has no OAuth token:
   the fix is to **add a `session_api`/gapi flavor**, not to patch the
   browser scrape (calendar browser reads are designed to be null).
2. If `event_chip` (or any `data-eventid`-keyed step) fails to match:
   suspect the **API-id vs grid-`data-eventid` mismatch** (gotcha #1)
   before assuming selector drift.
3. If a write's `selector_disappears` outcome flaps on a **recurring**
   event: the scope dialog (gotcha #3) is intercepting the commit. The
   `resolve_recurring_scope` step already handles it in commit mode — if it
   is failing, suspect the scope option-label text (`option_label`) or the
   `option_target` selector drifting, NOT the outcome timeout.
4. If `set_recurrence` fails, it is almost always a Custom-dialog selector
   in the `event_recurrence` widget (frequency combobox, interval, weekday
   `{day}` template, end radios) — patch the widget selectors, not the
   primitive. The RRULE parsing is deterministic runtime code.
5. If a recurrence value comes out WRONG (interval/count reverts to default,
   date unchanged) rather than failing: do NOT patch selectors. The runtime
   already handles Google's two Custom-dialog quirks (live-confirmed
   2026-05-28) — Wiz number spinbuttons need focus+select+InputEvent{data}
   (a plain native set reverts to the model default), and the
   interval/end-condition fields re-render after the frequency change /
   radio click so the runtime settles + polls before setting. A "wrong
   value" regression means Google changed that behavior, not selector drift.
6. If `create_event` can't reach the editor: the create-flow buttons
   (Create / Event / More options) are TEXT-labeled with no aria-label
   (gotcha #5, FIXED). The pattern when a Google button has no stable
   attribute: use `click_reveals`' `trigger_text` override (→ must_contain_text),
   NOT an aria-label selector. Prefer a stable `data-key` when present
   (the Event item has `data-key='event'`).

## See also

- [app_model.yaml](app_model.yaml) — screens / affordances / known-dead
  paths / transitions for calendar (the structured sibling of this doc).
- [atom-methodology.md](../../onboarding/prompts/atom-methodology.md) —
  CANONICAL L0 methodology (5 layers, signal table, 5 traps, rules A-H).
- [reference_google_workspace_api_paths.md](.claude/projects/-home-cd2k-work/memory/reference_google_workspace_api_paths.md)
  — the verified gapi-MAIN-world CRUD + freebusy probe (2026-04-16); the
  source of the transport-reality finding above.
- [project_calendar_onboard_2026_05_15.md](.claude/projects/-home-cd2k-work/memory/project_calendar_onboard_2026_05_15.md)
  — the 2026-05-15 `/onboard-saas` CRUD-chain session (create→search→edit→delete
  4/4, zero heal); the source of the EventEditPage `eid` capture + the
  widgets-exercised list.
- [bundled-manifests/gmail/gmail.md](../gmail/gmail.md) — the per-int doc
  template this file mirrors.
