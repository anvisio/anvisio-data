---
name: manifests/salesforce/salesforce.md
version: 0.2.0
cdn_schema_version: 70.0.0
authored_by: cd2k + claude
authored_at: 2026-05-29
verified_at: 2026-05-31
---

# Salesforce (Lightning Experience)

CRM at `https://<org>.lightning.force.com`. Single-page Aura/LWC app;
landmark navigation is path-based deeplinks (`/lightning/o/{Object}/list`,
`/lightning/o/{Object}/new`, `/lightning/r/{Object}/{Id}/view`,
`/lightning/r/{Object}/{Id}/edit`). Authenticated via the user's Lightning
session cookie — no OAuth at run time for the browser flavor.

This is the canonical per-integration knowledge for Salesforce, loaded ON
TOP of `atom-methodology.md` (the L0 cross-integration methodology). The
runtime ignores this file; propose / heal / Claude read it before authoring
or patching any SF atom, widget, or outcome.

## Three sources feeding propose

1. **MCP catalog** (`_mcp_tools.yaml`) — KirtiJha salesforce MCP:
   `dml_records` (insert/update/delete), `search_all` (SOSL), record
   describe, etc. Write atoms carry `mcp_tool: salesforce.dml_records`.
2. **Web research** — SF Lightning URL grammar + the Aura endpoint surface
   (the only stateless session-cookie API path; see below).
3. **Live DOM** — `records-record-layout-item[field-label=...]` field
   anchors, the toast contract, combobox shadow structure. Live-verified
   each onboarding/harden pass.

## Transport priority (spec 70 §7)

- **Writes** (`commits_changes: true`) prefer `browser > session_api > mcp`:
  the user sees the record filled + sees the HITL Save gate. Trust +
  visibility matter for writes.
- **Reads** (`commits_changes: false`) prefer `session_api > mcp > browser`:
  the Aura `ListUiController.postListRecordsByName` path (session cookie +
  CSRF, MAIN-world) is the only stateless read proven to work.

**API reality:** SF REST (`/services/data/...`) 401s `INVALID_SESSION_ID`
on the Lightning cookie (SOQL / SOSL / GraphQL / LWC wire adapters all
route through it). Only the `/aura` endpoint (MAIN-world, CSRF token from
`window.$A.clientService`) and classic-domain REST authenticate via the
session cookie. OAuth bearer works on REST but there's no token at
onboarding time. Writes go through the DOM, never REST/Aura — by design.

## L4 confirmation toasts per write action (LIVE-PROBED 2026-05-29, dev org)

The decisive spec-72 finding — the positive rung of every write atom's L4
consequence ladder. **You cannot author this text from research; it was
captured by committing throwaway records and reading the toast.**

- **Selector:** `.toastMessage` (inner text element) inside
  `.slds-notify_container` / `.slds-notify--toast`, success theme
  `.slds-theme--success`.
- **`role` is `null`** — NOT `[role='alert']`. (Same surprise as Calendar's
  `[aria-live='polite']` announcer in spec 72; do not assume `[role=alert]`.)
- **Text:** `<ObjectLabel> "<Name>" was <verb>.` — the object label
  prefixes the string, so `must_contain_text` is **object-agnostic**.

| Action | `must_contain_text` | Full text (Opportunity example) | Post-action nav |
|---|---|---|---|
| create | `was created` | `Opportunity "X" was created.` | → `/lightning/r/{id}/view` (object-LESS redirect, no `/Opportunity/`) |
| update | `was saved` | `Opportunity "X" was saved.` | → org **Welcome page** unless `backgroundContext` (gotcha 2) |
| delete | `was deleted` | `Opportunity "X" was deleted. Undo` | → `/lightning/o/{Object}/list` |

The atoms compose this as `all:[transient_appears .toastMessage <text>,
<corroborating rung>]`. The toast fires regardless of where Save lands
(it's app-shell-level), so the ladder is welcome-redirect-robust AND not a
Trap-2 fake-success.

## `abandon_signal` per write atom (spec 72 R1)

The HITL discard detector, raced against the commit outcome with a grace
window (`raceWithGrace`).

| Atom | `abandon_signal` | Discard behavior (live-confirmed) |
|---|---|---|
| create_record | `selector_disappears button[name='SaveEdit']` | cancel New modal → Save gone, no toast, nav to list |
| update_record | `selector_disappears button[name='SaveEdit']` | cancel edit modal → Save gone, no "was saved" toast |
| delete_record | `selector_disappears div[role='dialog']` | Cancel confirm → dialog closes, no toast, stays on `/view` |

## DOM gotchas

### 1. Success toast is `role=null` (`.toastMessage` / `.slds-theme--success`)
See the toast table above. Watch via `transient_appears` (the runtime's
latch is shadow-piercing + descendant-matching, so the toast subtree-insert
is caught even though `.toastMessage` is nested).

### 2. `/edit` deeplink post-save redirects to the org Welcome page
`/lightning/r/{Object}/{Id}/edit` (even with `?count=1`) post-save-redirects
to `/lightning/n/<app>__Welcome`, NOT back to `/view`. Fix: append
`&backgroundContext=<urlenc /lightning/r/{Object}/{Id}/view>`. Baked into
`RecordEditModal.entry.url` (v1.1.0). A `sf_edit_url` transform
(`transform-interpreter.ts`) already did this for the wizard/notes path, but
the v70 view-entry navigates `entry.url` raw — so it's fixed in data there.

### 3. Field anchor: `records-record-layout-item[field-label='<on-page label>']`
ONE uniform anchor across all archetypes (inner control varies: input /
textarea / `button[role=combobox]` / checkbox). **`field-label` is the
ON-PAGE label, which often differs from the API name:** `Name` →
"Opportunity Name", `StageName` → "Stage", `CloseDate` → "Close Date". The
runtime's `fill_fields` maps API names → labels via `schemas/<Object>.yaml`.

### 4. Opportunity Stage picklist needs a special widget
The Stage picklist is wrapped in an `sfa-input-stage-name` custom element
(it drives the closed-stage sales-path UI) and lacks the
`records-record-layout-item` field-label anchor. Use `salesforce.stage_picklist`
(same `picklist_select` archetype, Stage-specific trigger), wired via a
per-field `widget:` ref on `Opportunity.StageName`. Live options
2026-05-29: Prospecting / Qualification / Needs Analysis / Value Proposition
/ Id. Decision Makers / Perception Analysis / Proposal/Price Quote /
Negotiation/Review / Closed Won / Closed Lost.

### 5. Delete confirm dialog
`div[role='dialog']` (class `panel slds-modal slds-fade-in-open`) with copy
"Are you sure you want to delete this {object}?" and three buttons:
`button[title='Cancel and close']` (× icon), `button[title='Cancel']`,
`button[title='Delete']`. The Delete button is class **`slds-button_neutral`**
(NOT `slds-button_brand`) — anchor on `title='Delete'`, never a class fallback
(a neutral-class fallback would ambiguously match Cancel).

**`position:fixed` gotcha (live-probed 2026-05-30, forced a runtime fix).**
The modal is `position:fixed`, so its `offsetParent` is `null` even while
fully on screen (probed: 917x937, `display:block`, `visibility:visible`,
`offsetParent` null). The runtime's `isVisible()` (chrome-signal-driver.ts)
used to gate on `offsetParent===null`, so `selectorPresentInPage` reported the
OPEN modal as ABSENT. That made the spec-72 `abandon_signal`
(`selector_disappears div[role='dialog']`) fire on the first poll → the delete
HITL step false-`cancelled` before the user could confirm ("dialog came up then
disappeared"). Fixed by dropping the `offsetParent` gate (rect-size still
excludes `display:none`); regression test in chrome-signal-driver.test.ts
("position:fixed element ... SLDS modal/toaster case"). Applies to every SLDS
modal AND toaster — the success toasts (`.toastMessage`) only dodged it because
`transient_appears` catches them via the mutation-observer path, which skips the
visibility check.

### 6. "Sorry to interrupt / CSS Error" interstitial
A `ignoreCache` / hard reload of a Lightning page can desync the loaded
app-version vs the versioned CSS static resource, producing a persistent
"Sorry to interrupt — CSS Error — Refresh" `div[role='dialog']` overlay. The
page WORKS behind it (rows render, in-app nav works) — synthetic `.click()`
bypasses the overlay backdrop. **Don't hard-reload SF.** Recover via in-app
SPA navigation (click a link) or a normal cache-respecting reload. When
probing, scope dialog queries to exclude `CSS Error` (e.g. the delete dialog
is the `div[role='dialog']` containing `button[title='Delete']`).

### 6a. `postListRecordsByName` listview indexing lag (newly-created records)
Aura `ListUiController.postListRecordsByName` against a standard listview
(e.g. `AllOpportunities`) does NOT immediately reflect records created
seconds-to-minutes earlier in the same session — even though the Lightning
UI shows them. Live-confirmed 2026-05-30 with opportunity_crud (the
search_for_created_opp step returned `searched · 0 matches` for a record
that had just been created → updated in the same blueprint run; an
out-of-band probe confirmed the new record was absent from
postListRecordsByName's response while older records with the same name
substring were present). The Lightning UI's Lightning Data Service (LDS)
caches reads on a different path than the raw fetch() POST to /aura, so
LDS sees the new row immediately but the listview API doesn't.

Implications for `search_record`:
- A search for a JUST-CREATED record by name may legitimately return 0
  matches without it being an atom/filter bug.
- Two hardening options:
  (1) **Blueprint-level (LANDED 2026-05-30).** Switch the caller's
      `list_view_api_name` to a per-user listview like
      `RecentlyViewedOpportunities` when the blueprint opens the record
      before searching. Per-user RecentlyViewed populates immediately on
      record open via LDS, so the listview API sees the just-created row
      via the same fresh cache path. Applied to
      `opportunity_crud.search_for_created_opp`; other callers that search
      pre-existing records still use `AllOpportunities` / `AllAccounts`.
  (2) **Atom-level (NOT LANDED).** Add a retry-with-backoff on
      `searched · 0` inside the recipe. More general (works regardless
      of whether the blueprint opened the record), but needs a new recipe
      primitive (`retry_on_empty` or a `loop_until` construct). Deferred
      until more blueprints hit the lag.
- The per-object recipe shape is correct, but the RUNTIME silently dropped
  the filter until 2026-05-31 (commit a3e22f1c). The recipe's
  `filter.contains` is a template (`{{inputs.query}}`); `call_platform_api`
  passed the `api_def` to the transport WITHOUT substitution, so the filter
  compared names against the literal string `{{inputs.query}}` and returned
  0 matches for any non-empty query. `step-executor.ts` now substitutes the
  whole `api_def` first. With a real query the filter works as expected;
  with an EMPTY query (a bare `/run-blueprint` that passes no inputs) the
  substituted contains is blank and matches everything, which is the
  expected consequence of no input, not a filter bug.

### 6c. `postListRecordsByName` read shape (the `fields` param + relationship fields)
Live-probed 2026-05-31 against the dev org:
- The `fields` param in `listRecordsQuery` does NOT restrict the response.
  Requesting `fields: [Contact.Id, Contact.Name]` returns the FULL listview
  column set (Email, Phone, Title, Account, Owner, timestamps) with VALUES
  populated, identical to passing no `fields` at all. So `search_record`
  needs no explicit `fields`; the listview's columns always come back
  populated. (The org's named contacts carry real email/phone; the bulk
  "James Wong" seed dupes are genuinely blank, so an empty display sub on
  those rows is the data, not a read bug.)
- `from_aura_records` (flattenAuraRecords) flattens EVERY key under
  `fields{}`: scalar fields (Name, Amount, StageName, CloseDate) become
  top-level scalars, but RELATIONSHIP fields (Account, Owner) have no
  top-level `value`, so each flattens to the whole NESTED record object.
  A display or synthesize reading `${ $item.Account }` gets an object, not
  a string; use `${ $item.Account.fields.Name.value }` or project the
  scalar you need. Seen 2026-05-31 in pipeline_review's synthesize
  `with: { selected: ${ .chosen.selected } }`, which dumped the full nested
  Account/Owner records into the prompt (noisy but harmless).

### 6b. Modal DOM lives 6+ shadow roots deep — probe with a piercing helper
The New/Edit Opportunity modal renders as standard LWC: every
interactive control sits inside the host chain
`records-modal-lwc-detail-panel-wrapper → records-lwc-detail-panel →
records-base-record-form → records-lwc-record-layout →
forcegenerated-detailpanel_<obj>___…___recordlayout2 →
records-record-layout-base-input → lightning-input →
lightning-primitive-input-simple → <input>`. Live-verified 2026-05-30
in the cd2k dev org (19 `records-record-layout-item` instances with
correct field-label attrs).

The runtime's `chrome-step-driver` + `chrome-signal-driver` pierce all
of this via their own `qsPiercing` / `qsaPiercing` walkers, so widget
selectors that target `records-record-layout-item[field-label='…']`,
`sfa-input-stage-name button[role='combobox']`, or `button[name='SaveEdit']`
work at runtime without special handling.

**Hand-probing trap (chrome-devtools MCP):** `evaluate_script` does
**not** pierce shadow DOM, so `document.querySelectorAll('records-record-layout-item')`
returns 0 against this modal even though 19 instances exist. When
probing live, paste this helper first:

```js
function qsPiercing(root, sel) {
  try { const d = root.querySelector(sel); if (d) return d } catch { return null }
  for (const el of root.querySelectorAll('*'))
    if (el.shadowRoot) { const f = qsPiercing(el.shadowRoot, sel); if (f) return f }
  return null
}
function qsAllPiercing(root, sel) {
  const out = []
  try { for (const e of root.querySelectorAll(sel)) out.push(e) } catch { return out }
  for (const el of root.querySelectorAll('*'))
    if (el.shadowRoot) for (const e of qsAllPiercing(el.shadowRoot, sel)) out.push(e)
  return out
}
```

**One field-fill gap to know:** the Description textarea on the modal
has no `name=` attribute, so neither
`records-record-layout-item[field-label='Description'] textarea` (the
primary — the wrapper IS there) nor `textarea[name='Description']` (the
generic fallback) discriminate it cleanly from other textareas on
recipe runs that depend on field_name. The universal LWC anchor is
`[data-target-selection-name$='.{{field_name}}'] textarea`, which works
for every field on the layout, with or without a `name=` attr. Worth
adding to the `salesforce.text` widget's fallback chain as the
second-line selector after the records-record-layout-item primary.

### 7. Combobox / picklist open + select
Click the `button[role='combobox']` trigger to open; the dropdown renders
async (~200–450ms). Click `lightning-base-combobox-item[data-value='<v>']`
(deep shadow walk). Retry the item-click if the dropdown hasn't rendered.

### 8. `runs_in_home_tab` — SF writes open their OWN edit surface
create/update/delete navigate to a dedicated `/new` or `/edit` URL (a
separate edit surface), so they do **NOT** set `runs_in_home_tab` — the
runtime's own-tab gate (`commits_changes && browser && !runs_in_home_tab`)
correctly spawns the edit tab for them. (Contrast Gmail's in-place row
actions, which DO set it.)

## Heal hints

- A write atom's L4 outcome reverting to a bare `selector_disappears` is the
  Trap-2 fake-success — re-author as the ladder using the toast text above.
  The validator WARNs on it; `salesforce-write-ladder.test.ts` guards the
  three write atoms.
- Selector drift on field fills: re-anchor on
  `records-record-layout-item[field-label='<on-page label>']`, not
  `input[name=]` (the name attr is less stable across layouts).
- A `tab_not_ready` on a write atom is usually the cold edit tab loading SF
  from `about:blank` — default to 8s dialog-open timeouts (cold load is
  2–4s slower than the warm tab).

## See also

- `atom-methodology.md` — L0 cross-integration methodology (5 layers,
  the L4 ladder, the 7 traps).
- `planning/tech_design/integrations/INTEGRATION_FORMAT.md` — canonical
  format (single-source-of-truth: selectors live in the manifest, platform
  notes LINK here).
- `app_model.yaml` — the screen / affordance / dead-path catalog.
