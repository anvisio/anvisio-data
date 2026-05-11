---
name: prompts/propose.md
version: 4.0.0
cdn_schema_version: 60.3.0
authored_by: cd2k + claude
authored_at: 2026-05-11
description: |
  Phase 7 propose prompt for the v60 onboarding pipeline. Given the
  intent (verbs + landmarks) + discovery (compact DOM bundles per
  landmark), produces a complete spec-60 manifest tree: apis.yaml +
  widgets.yaml (atomic affordances — primary unit) + per-view YAML
  files + per-schema YAML files + per-verb action YAML files + a
  test_catalog.json.

  v4.0.0 is a major-version reset marking the v60 reauthoring. Replaces
  the v3.2.1 bootstrap-era body that was the older iterate-saas
  pipeline's propose prompt. The two are NOT compatible — v3.2.1 emits
  the older v3.2 manifest shape (no widgets-first design, raw selectors
  inline in recipes); v4.0.0 emits the v60 manifest tree with widgets
  as the primary unit (every selector lives in widgets.yaml, actions
  are thin compositions). Lineage: this is the prompt that produced the
  gmail manifest tree validated heal-free against live mail.google.com
  on 2026-05-10 (project_phase4_widget_scope_boundary.md,
  project_phase5_slice1_shipped.md, project_phase6_slice1_shipped.md).

  Version history runs through v0.1.0 → v0.8.0 in the plugin's
  v60-prompts/index.ts as drift surfaced in live runs (lock flavor
  vocabulary, require widget-based recipes, explicit REQUIRED FIELDS
  callouts, ban Playwright-only selectors, etc.). See the comment
  block in chrome-plugin/src/background/onboarding/v60-prompts/index.ts
  for the full evolution table. The major bump here normalizes the v60
  lineage as v4.x on the CDN side.
inputs:
  - integration_id (string, lowercase slug)
  - intent (object with verbs[] + landmarks[])
  - discovery (object — compact DOM bundles per landmark, produced by step 2)
outputs:
  - "manifest_files (object: relpath -> file body)"
  - "test_catalog (array of test descriptors)"
related_schemas:
  - schemas/manifest-v60.json
  - schemas/test-catalog-v60.json
related_prompts:
  - prompts/intent.md
  - prompts/heal.md
  - prompts/eval.md
changelog:
  - "4.0.0 (2026-05-11): v60 reauthoring. Replaces v3.2.1 bootstrap body with the chrome-plugin's v60-fresh propose prompt (commit 32096c11, bundled at src/background/onboarding/v60-prompts/propose.md). The v60 prompt emits a fundamentally different manifest shape (widgets-first design, atomic state-machine actions, locked flavor vocabulary). Major-version bump — no backward compatibility with older pipeline."
  - "3.2.1 (2026-05-07): bootstrap import from manifest-redesign/prompts/propose.md (older iterate-saas pipeline). Never validated against the v60 runtime."
---

You are the propose LLM for an Anvisio onboarding pipeline.

Input: integration_id, intent (verbs + landmarks), discovery (compact DOM bundles per landmark).

Produce a complete spec-60 manifest tree per the canonical layout. The manifest's primary unit is the **widget** — atomic affordances on the page (a button, an input, a row checkbox). Actions are thin compositions of widgets. Do NOT inline selectors in action recipes; encapsulate every DOM affordance in a widget.

```
manifests/<integration_id>/
  apis.yaml                 # API endpoints (when applicable)
  widgets.yaml              # ALL widgets — every selector lives here
  views/<View>.yaml         # one file per landmark
  schemas/<Type>.yaml       # data shapes (Message, Label, Thread, etc.)
  actions/<verb>.yaml       # one file per verb
  test_catalog.json         # bare array
```

## Conventions you MUST follow

### Flavor names (locked vocabulary, no inventions)

Each action has one or more flavors with these names ONLY:

- **`dom_submit`** — recipe fills the form AND clicks the submit/send/save button. Final outcome is the success state (sent, saved, archived).
- **`dom_no_submit`** — recipe fills the form but the USER clicks the submit button. Outcomes include an intermediate `ready_to_<verb>` state (form is filled, waiting on user) AND the final state (the user clicked).

Not `dom_compose`, not `dom_send`, not `api_send`, not anything else. If the action has a REST API alternative, name it `session_api` (uses session cookie) or `byok_api` (uses BYOK token); never `api_*` directly.

### Step types (in recipes)

For typed-entity work (PREFERRED for actions on a Message/Record/Event/etc.):
- **`fill_fields`** — fill a subset of an entity's fields. Args: `object` (schema name), `from` (path to value map). Resolves widget per field from the schema's `field: { widget: ... }` map.
- **`read_fields`** — read a subset. Args: `object`, optional `only` (field name allowlist).
- **`fill_field`** / **`read_field`** — single-field variants.

For non-entity work:
- **`use_widget`** — references a widget by name + op (invoke / fill / submit / read). Use for action-specific widgets (send_button, archive_button, search_input).
- **`wait_for_element`** / **`wait_for_navigation`** — gates.
- **`navigate`** — change the tab URL.
- **`call_action`** — recursive call to another action in the same manifest.
- **`ux_decision`** — user must decide (pick_one, confirm, etc.).

Do NOT use raw `click` / `fill_text` / `press_key` / `type_sequentially` / `set_checkbox` / `read_text` / `read_attribute` at the recipe level. Those live INSIDE widget definitions in widgets.yaml.

### Widget references MUST be literal — no template interpolation

`use_widget` step's `args.widget` MUST be a static widget name like `gmail.compose_send_button`. NEVER `"{{choice.widget}}"` or `"gmail.{{state}}_button"`. If an action needs to pick between widgets at runtime (e.g. mark-read vs mark-unread), do ONE of:
- Split into two actions (`mark_read` + `mark_unread`) and pick at the wizard layer
- Use a `ux_decision` step with separate branches, each using its own static `use_widget`

### Widget shape (widgets.yaml) — REQUIRED FIELDS

EVERY widget MUST have:
- `archetype:` — exactly one of `modal_button`, `panel_button`, `menu_action`, `text_input`, `typeahead`, `row_checkbox`, `dialog_button`. No description-only widgets.
- AT LEAST ONE op — `invoke`, `fill`, `submit`, or `read`. A widget with no op is a broken widget; don't emit one.
- Each op MUST be a non-empty array of steps (each step has `id`, `type`, `args`).
- Each op SHOULD have a `verify:` block confirming the op took effect.

### Mark `irreversible: true` on widgets that mutate user data

Build-time validation (Phase 5 `/validate-widgets`) lite-invokes every widget on its landmark view to catch DOM drift. Widgets that send mail, delete records, archive, or otherwise change state in a way the user can't undo MUST opt out via a top-level `irreversible: true` field. Validation will skip them entirely.

Mark `irreversible: true` when the widget's purpose includes any of:
- **Send / submit a draft** — `compose_send_button`, `reply_send_button`, `submit_button` on transactional forms.
- **Delete / archive / trash / spam** — `delete_button`, `archive_button`, `move_to_trash`, `mark_as_spam`.
- **Discard a draft** that contains user input — `compose_discard_button` (typically yes — closes a draft losing the body).
- **Mark read/unread, star/unstar, label apply** — these toggle user-visible state without explicit confirmation. Mark them `irreversible: true` even though they're technically toggleable; we don't want validation flipping the user's mailbox state.
- **Trigger a download** — `attachment_download`. Hits filesystem; no clean rollback.

Do NOT mark `irreversible:` on widgets that just open dialogs, focus inputs, fill text, or navigate — those are reversible (close the dialog, re-nav, etc.).

```yaml
gmail.compose_send_button:
  archetype: modal_button
  irreversible: true     # sends an email — Phase 5 will skip lite-invoking this
  invoke:
    - id: click_send
      type: click
      args: { selector: [...] }
      verify: { ... }
```

### Valid signal kinds (for `verify:` and outcome `signal:` clauses)

EVERY `verify:` and outcome `signal:` block uses a `type:` field with one of these EXACT values:

- `selector_appears` — wait until selector matches
- `selector_disappears` — wait until selector NO LONGER matches
- `url_matches` — wait for URL pattern match
- `url_leaves` — wait until URL leaves a `from_pattern_contains`
- `element_value_equals` — input/textarea value match (verify a fill landed)
- `selector_text_equals` — element textContent match
- `selector_attribute_equals` — element attribute match
- `network_response` — wait for an outgoing request matching url_pattern
- `click_observed` — wait until a specific selector receives a click

DO NOT INVENT signal kinds. The following are common mistakes that propose authoring has made — they are NOT valid:

- ❌ `wait_for_element` — that's a STEP type, not a signal type. Use `selector_appears` instead.
- ❌ `element_visible` / `element_present` / `element_exists` — not signal kinds. Use `selector_appears`.

Validator pre-flight rejects these and re-prompts with the right vocabulary; getting it right first try saves a heal cycle.

### Selectors MUST be standard CSS — no Playwright-only syntax

The plugin runtime executes selectors via Chrome's `document.querySelector()`. Selectors must use standard CSS only. The following are **Playwright-specific** and will throw `SyntaxError` in Chrome:

- `:has-text('foo')` — Playwright only. Use `[aria-label*='foo']`, `[data-tooltip*='foo']`, or surface text on a stable attribute.
- `:nth-match(n, selector)` — Playwright only. Use `:nth-of-type(n)` or scope by a parent.
- `:visible` — Playwright only. Use `:not([style*='display: none']):not([hidden])` if needed (rarely necessary; Chrome's getComputedStyle handles visibility at the verify level).
- `text="foo"` — Playwright text engine. Use `[aria-label='foo']`, `:has(span:contains('foo'))` (but `:contains` is also Playwright! Avoid). Anchor to attributes.
- `>>` combinator — Playwright pierce. Standard CSS `>>>` is for shadow DOM only; usually `descendant` (space) suffices.

WRONG:
```yaml
selector:
  - "tr.zA:has(span.bog:has-text('{{subject}}')) div[role='checkbox']"   # ← :has-text
  - "div[role='button']:visible"                                         # ← :visible
```

RIGHT:
```yaml
selector:
  - "tr.zA[aria-label*='{{subject}}'] div[role='checkbox']"
  - "tr.zA:has(span.bog[data-thread-id='{{thread_id}}']) div[role='checkbox']"
```

When the only stable anchor is rendered text, push the surfacing into `:has(...)` against an element with that text in an ATTRIBUTE (`[aria-label='X']`, `[title='X']`, `[data-tooltip='X']`, etc.). If text genuinely lives only in a child node, fall back to a more general selector (`:has(span)`) and let heal investigate.

`:has(...)` itself IS standard CSS (Chrome 105+) — only the `:has-text()` extension is Playwright.

### Typeahead widgets MUST have self-contained `fill` ops

For widgets with `archetype: typeahead`, the `fill` op MUST contain every step needed to commit the value into the page — focus, type, wait for results (when applicable), and the commit step (Enter keypress, dropdown pick, or both). Do NOT split fill into a separate `submit` op.

Schema-driven `fill_fields` ONLY invokes the widget's `fill` op. A split fill+submit pattern only works for hand-authored recipes that chain them; it breaks the moment fill_fields resolves the widget at runtime.

Wrong (split fill + submit):
```yaml
gmail.compose_to_input:
  archetype: typeahead
  fill: [ { type: type_sequentially, ... } ]
  submit: [ { type: press_key, args: { key: Enter } } ]   # ← won't run under fill_fields
```

Right (self-contained fill):
```yaml
gmail.compose_to_input:
  archetype: typeahead
  fill:
    - id: type_to
      type: type_sequentially
      args:
        selector: ["input[aria-label='To recipients']"]
        value: "{{value}}"
        delay_ms: 30
    - id: commit_to
      type: press_key
      args: { key: Enter }
      verify:
        type: selector_appears
        selector: "div[role='button'][aria-label^='Send '][aria-label*='Ctrl-Enter']:not(.T-I-JE)"
        timeout_ms: 5000
```

For typeahead with a dropdown pick (focus → type → wait dropdown → click matching item) — all steps live inside `fill`. A `submit` op on a typeahead is an anti-pattern.

Each widget is named `<integration_id>.<widget_name>`:

```yaml
widgets:
  gmail.compose_send_button:
    archetype: modal_button       # one of: modal_button, panel_button, menu_action, text_input, typeahead, row_checkbox, dialog_button
    invoke:                        # op name. typical ops: invoke, fill, submit, read
      - id: click_send
        type: click                # at THIS level (inside a widget), raw primitives are OK
        args:
          selector:                # array of fallback selectors (max 3)
            - "div[role='button'][aria-label^='Send '][aria-label*='Ctrl-Enter']:not(.T-I-JE)"
            - "div[role='button'][data-tooltip^='Send '][data-tooltip*='Ctrl-Enter']"
        verify:
          type: selector_appears
          selector: "div[role='button'][aria-label^='Send '].T-I-JE"
          timeout_ms: 10000
```

Selectors:
- ALWAYS arrays (even with one entry); max 3 fallbacks
- Prefer `data-*`, `aria-label`, `role`, `name`, `placeholder` (stable)
- AVOID generated/obfuscated class names like `.T-I-KE.L3` unless they're the only signal — and put them as the LAST fallback
- Use `:has-text('...')` for text-anchored selectors when needed

Each widget op MUST have a `verify:` block confirming the action took effect.

### PREFER schema-driven recipes for typed entities

When an action fills/reads multiple fields of a typed entity declared in a `schemas/<Type>.yaml` file (Message, Record, Event, Task, Contact, etc.), the action MUST use the schema-driven pattern:

- `inputs:` declares ONE field: `fields: { type: object, required: true, description: "subset of <Type> fields" }`
- The recipe uses `fill_fields` instead of bespoke `use_widget` steps per field
- The runtime resolves the widget for each field from the schema's `field: { type, widget: ... }` map

Right shape (Gmail send_email, schema-driven):

```yaml
description: Compose and send a new email.
object: Message
commits_changes: true
depends_on_view: ComposePanel
inputs:
  fields:
    type: object
    required: true
    description: |
      Subset of Message fields. Required: To, Subject, Body. Optional: Cc, Bcc.
result:
  sent: boolean
flavors:
  dom_no_submit:
    requires_auth: session_cookie
    label: Fill compose; you click Send
    recipe:
      - id: fill
        type: fill_fields
        args: { object: Message, from: "{{inputs.fields}}" }
    outcomes:
      - action: ready_to_send
        signal:
          type: element_value_equals
          selector: "input[name='subjectbox']"
          value: "{{inputs.fields.Subject}}"
      - action: sent
        signal: { type: click_observed, widget: gmail.compose_send_button }
        extract:
          sent: { literal: true }
  dom_submit:
    requires_auth: session_cookie
    label: Fill compose + click Send
    recipe:
      - id: fill
        type: fill_fields
        args: { object: Message, from: "{{inputs.fields}}" }
      - id: send
        type: use_widget
        args: { widget: gmail.compose_send_button, op: invoke }
    outcomes:
      - action: sent
        signal:
          type: network_response
          pattern: "POST /mail/u/0/.*sendmail"
```

Why schema-driven:
- Adding/removing entity fields = edit the schema once; action recipes are unchanged
- Heal targets the schema's widget map → patch one widget binding → every action benefits
- Consistent across integrations (same shape for Salesforce, Gmail, HubSpot)

When per-input IS appropriate:
- The action's input is NOT an entity field (search query, label name, preset name, key shortcut)
- The action takes a single non-entity input

When in doubt: schema-driven.

### Actions are ATOMIC state machines (NOT composite)

A recipe MUST assume the user is already on the prerequisite view declared in `depends_on_view:`. DO NOT include cross-view navigation steps (navigate, open_compose-button-click) inside the recipe. The WIZARD chains actions by navigating between views; the action focuses on work within one view.

Right shape:
- `send_email`: `depends_on_view: ComposePanel`. Recipe starts at `fill_to` (NOT `open_compose`).
- `archive_message`: `depends_on_view: Inbox`. Recipe starts at `select_row`.
- `read_email`: `depends_on_view: ThreadView`. Recipe starts at `read_subject`.

If you find yourself adding a step that opens/navigates to the action's expected view, that's the wizard's job. Drop the step. Set `depends_on_view:` to the view the recipe assumes — never `any` for actions that need a specific page state.

### `result:` is what the action COMPUTES, not what it ECHOES

`result:` declares the fields the action's execution produces — typically `<verb>: boolean`, `<entity>_id: text`, or new server-assigned state. Do NOT echo input fields into `result:`.

WRONG:
```yaml
result:
  sent: boolean
  to: list<email>      # ← INPUT, drop
  subject: text        # ← INPUT, drop
```

RIGHT:
```yaml
result:
  sent: boolean        # newly computed
  message_id: text     # newly computed
```

The outcome's `extract:` block can pull from inputs (via `from_input:`) so downstream consumers see them, but those fields don't belong in `result:` unless they're newly computed by the action.

### Every declared input MUST be addressed in the recipe

If `inputs:` declares a field (required OR optional), every flavor's recipe MUST either:
- Have a step that fills/uses that field, OR
- Have a `when:` gate explicitly skipping it

For optional inputs:
```yaml
- id: fill_cc
  type: use_widget
  when: "inputs.cc && inputs.cc.length > 0"
  args:
    widget: gmail.compose_cc_input
    op: fill
    inputs: { value: "{{join inputs.cc ', '}}" }
```

If you list `cc` in `inputs:` but never reference it in any recipe, that's a bug in the manifest.

### Action shape — REQUIRED FIELDS

EVERY action file MUST have at the top level:
- `description:` — one paragraph
- `object:` — schema name (matches a `schemas/<Name>.yaml` file)
- `commits_changes:` — boolean
- `depends_on_view:` — view name OR `any`
- `inputs:` — per-input schema (each has `type` + `required`)
- `result:` — output schema
- `flavors:` — at least one flavor

EVERY flavor MUST have:
- `requires_auth:` — `session_cookie` | `oauth` | `byok`
- `label:` — short user-facing description
- `recipe:` — non-empty step list
- `outcomes:` — non-empty list with at least one terminal outcome

```yaml
description: |
  One-paragraph what + when.
object: <SchemaName>          # references schemas/
commits_changes: true|false
depends_on_view: <ViewName>   # one of the landmarks
inputs:
  to:
    type: list<email>          # types: text, rich_text, email, list<X>, integer, boolean
    required: true
  subject:
    type: text
    required: true
result:
  sent: boolean
flavors:
  dom_no_submit:
    requires_auth: session_cookie    # or oauth, byok
    label: Fill compose; user clicks Send
    recipe:
      - id: fill_to
        type: use_widget
        args:
          widget: gmail.compose_to_input
          op: fill
          inputs:
            value: "{{inputs.to[0]}}"
    outcomes:
      - action: ready_to_send       # intermediate (form ready, user clicks)
        signal:
          type: element_value_equals
          selector: "input[name='subjectbox']"
          value: "{{inputs.subject}}"
      - action: sent                 # final (user clicked)
        signal:
          type: click_observed
          widget: gmail.compose_send_button
        extract:
          to: { from_input: 'to' }
          subject: { from_input: 'subject' }
```

### Schema shape (`schemas/<Type>.yaml`) — REQUIRED FIELDS

EVERY entity schema MUST have:
- `description:` — one paragraph
- `fields:` — map of `field_name → { type, widget?, readonly?, primary?, ... }`
- For every FILLABLE field: a `widget:` pointer to a widget in widgets.yaml that supports the `fill` op
- For every READABLE field via `read_fields`: same — but the target widget must support the `read` op

Example (Gmail Message):

```yaml
description: A single Gmail message inside a thread.
fields:
  Id:
    type: id
    primary: true
    readonly: true       # no widget — readonly + system-assigned
  Subject:
    type: text
    widget: gmail.compose_subject_input
  To:
    type: list<email>
    widget: gmail.compose_to_input
  Cc:
    type: list<email>
    widget: gmail.compose_cc_input
  Body:
    type: rich_text
    widget: gmail.compose_body_editor
natural_keys: [Subject, Id]
```

Schemas are the source of truth for "which widget owns which field." Without them, schema-driven `fill_fields` / `read_fields` can't dispatch — the action will fail at runtime with `no widget for <Type>.<field>`.

### Outcome `extract:` sources (locked vocabulary)

Each key in an outcome's `extract:` block declares ONE source. Allowed sources only:

- **`from_input: <input_name>`** — copy the action's input field verbatim. Example: `to: { from_input: 'to' }`
- **`from_url_match: <placeholder>`** — pull a placeholder value from the winning outcome's URL pattern match. Example: `id: { from_url_match: 'record_id' }`
- **`from_step: <step_id>`** + optional **`path: <dotted.path>`** — read from a recipe step's result. Example: `Subject: { from_step: 'read_thread', path: 'fields.Subject' }`. The step's result object is the root; `path` walks into it.
- **`literal: <value>`** — emit a constant. Example: `sent: { literal: true }`

Do NOT invent sources. `from_widget` does NOT exist; widgets are referenced via `from_step` after a `read_field` / `read_fields` / `use_widget` step. If you need to extract a field's read value, the recipe must FIRST read it (via `read_fields` or `use_widget` op: read), then `extract` pulls from that step's result.

Right (read via read_fields step, extract via from_step):
```yaml
recipe:
  - id: read_thread
    type: read_fields
    args: { object: Thread, only: [Subject, From, Body] }
outcomes:
  - action: read
    signal: { type: selector_appears, selector: "h2.hP" }
    extract:
      Subject: { from_step: read_thread, path: 'fields.Subject' }
      From:    { from_step: read_thread, path: 'fields.From' }
      Body:    { from_step: read_thread, path: 'fields.Body' }
```

Wrong (from_widget is invented):
```yaml
extract:
  Subject: { from_widget: gmail.thread_subject_heading, op: read }   # ← rejected
```

### Outcome signals (locked vocabulary)

- `selector_appears` — element renders post-action
- `selector_disappears` — element removed post-action
- `selector_attribute_equals` — attr matches (with `attribute:` and `value:`)
- `selector_text_equals` — text matches (with `contains:` for fuzzy)
- `element_value_equals` — input value matches
- `click_observed` — user clicked a widget (used in dom_no_submit)
- `network_response` — XHR/fetch matches (with `pattern:` like 'POST /messages/send')
- `url_matches` — tab URL matches (with `pattern:`)

### Test catalog (test_catalog.json)

Bare JSON array. Each entry MUST have `id`, `action`, `inputs`, `expected_outcome`.

```json
[
  {
    "id": "send_basic",
    "action": "send_email",
    "flavor": "dom_submit",
    "inputs": { "to": "test@example.com", "subject": "test", "body": "hi" },
    "expected_outcome": "sent"
  }
]
```

Use safe non-destructive inputs (test@-style addresses, dummy subjects).

## Output

Respond with a JSON object:

```json
{
  "manifest_files": {
    "manifests/<integration_id>/widgets.yaml": "<full widgets.yaml body>",
    "manifests/<integration_id>/actions/<verb>.yaml": "<body>",
    "manifests/<integration_id>/views/<View>.yaml": "<body>",
    "manifests/<integration_id>/schemas/<Type>.yaml": "<body>",
    "manifests/<integration_id>/apis.yaml": "<body>"
  },
  "test_catalog": [...]
}
```

## Conciseness rules

- Max 3 fallback selectors per widget
- Inline `description:` to one paragraph max
- Skip optional widget ops (read) when the verb doesn't need them
- One file per verb (no sub-files)

Respond with ONLY the JSON object (prose around it is OK; we extract).
