---
name: manifests/hubspot/hubspot.md
version: 0.1.0
cdn_schema_version: 70.0.0
authored_by: cd2k + claude
authored_at: 2026-06-01
---

# HubSpot

HubSpot's CRM is a single-page app served from
`app{,-na2,-eu1,…}.hubspot.com` (the regional suffix depends on the
portal's data center). Routes are stable and parameterized by three ids:
the **portalId**, the numeric **objectTypeId**, and the **recordId**. The
URL grammar is the navigation backbone:

- List:   `…/contacts/{portalId}/objects/{objectTypeId}/views/{viewId}/list`
- Board:  `…/contacts/{portalId}/objects/{objectTypeId}/views/{viewId}/board`
- Record: `…/contacts/{portalId}/record/{objectTypeId}/{recordId}`

Authenticated via the user's HubSpot **session cookie** — the in-session
GraphQL + REST paths ride it directly (CSRF token in the
`x-hubspot-csrf-hubspotapi` header, also stored as the `hubspotapi-csrf`
cookie). No separate OAuth step at run time on the session path; OAuth /
MCP are upgrades for headless / cross-tab work.

The four CRM object types Anvisio models, with their canonical numeric
`objectTypeId` and the primary key every schema declares
(`primary_key: [hs_object_id]`):

| Object  | objectTypeId | MCP slug   | Schema |
|---|---|---|---|
| Contact | `0-1` | `contacts`  | [schemas/Contact.yaml](schemas/Contact.yaml) |
| Company | `0-2` | `companies` | [schemas/Company.yaml](schemas/Company.yaml) |
| Deal    | `0-3` | `deals`     | [schemas/Deal.yaml](schemas/Deal.yaml) |
| Ticket  | `0-5` | `tickets`   | [schemas/Ticket.yaml](schemas/Ticket.yaml) |

The six atom verbs are **generic** — `create_record`, `get_record`,
`list_records`, `open_record`, `search_records`, `update_record` — each
parameterized by `object_type` / `object_type_id`, so one atom per verb
covers all four types (and any future custom object). This is unlike
gmail/salesforce, which have per-noun verbs; HubSpot's own API is itself
object-type-parameterized (`/crm/v3/objects/{type}`), so the atoms mirror
it.

## Sources feeding propose

Three upstream sources author this manifest (spec 70):

1. **MCP catalog** ([_mcp_tools.yaml](_mcp_tools.yaml)) — HubSpot ships an
   official remote MCP server (GA 2026-04-13, `source_url:
   https://mcp.hubspot.com`, OAuth 2.1 + PKCE). **12 tools.** The surface
   is small + generic: every CRM object type goes through the SAME
   `search_crm_objects` / `get_crm_objects` / `manage_crm_objects` tools,
   parameterized by `objectType`. Plus property introspection
   (`search_properties`, `get_properties`), owners (`search_owners`),
   campaign helpers (`get_campaign_contacts_by_type`,
   `get_campaign_analytics`, `get_campaign_asset_types`,
   `get_campaign_asset_metrics`), and user/telemetry
   (`get_user_details`, `submit_feedback`). Each write/read atom pins
   `mcp_tool: hubspot.<tool>` back at a catalog entry
   (`manage_crm_objects` for create/update, `search_crm_objects` for
   search, `get_crm_objects` for get).

2. **Web research** — endpoint shapes for the public REST surface come
   from `developers.hubspot.com/docs/api/crm/objects`; the in-session
   GraphQL + properties/v4 + pipelines/v2 shapes were captured live (see
   below). Pipelines + property option sets are per-portal, so research
   only seeds the HubSpot-default option lists; the live set is fetched
   at run time.

3. **Live DOM / network** — the in-session GraphQL `crmObjectsSearch`
   query, `/api/properties/v4`, and `/api/pipelines/v2` were captured
   from a real **deal-board page load on portal 245597800 (2026-05-23)**;
   the view landmarks (RecordView / ListView / BoardView / Dashboard)
   were live-verified the same day. The default Deal pipeline's 7 stages
   (Appointment Scheduled → … → Closed Won / Closed Lost) seed
   `schemas/Deal.yaml`. **This was a manifest-authoring capture pass, NOT
   an atom browser-flavor hardening session** — see DOM gotchas below.

## Transport priority (spec 70 §7)

Derived from how each atom in `actions/*.yaml` declares + orders its
`flavors:` block (the order is the preference order):

- **Reads** (`commits_changes: false` — `search_records`, `get_record`):
  `session_api` > `mcp` > `oauth_api` > `browser`. The session_api flavor
  dispatches the SPA's OWN GraphQL request (`crmObjectsSearch` /
  `crmObject`, the same data path the deal board fires) against the
  existing session cookie + CSRF — no OAuth, no tab UI, statelessly. MCP
  and public REST are the headless upgrades; the browser flavor (open the
  list view, verify the table renders) is a last-resort fallback that
  returns no rows (`records: literal []`).
- **Writes** (`commits_changes: true` — `create_record`,
  `update_record`): `browser` > `mcp` > `oauth_api`. Browser is first per
  the user-clicks-Save launch contract (the user sees the record get
  created / edited in their own HubSpot tab); MCP
  (`manage_crm_objects operation=create|update`) and public REST
  (`POST` / `PATCH /crm/v3/objects/{type}`) cover headless flows that
  don't need user confirmation.
- **Navigation-only** (`open_record`, `list_records`): browser only — no
  API verb to swap to (there is no canonical MCP "list" tool; for a
  structured list use `search_records` with empty filters).

The session_cookie path is the daily-driver because the user is already
in a HubSpot tab when a blueprint fires, so we ride the existing session.
See [apis.yaml](apis.yaml) for the full endpoint catalog (GraphQL +
properties/v4 + pipelines/v2 on the session path; `api.hubapi.com` REST
on the oauth path).

## DOM gotchas

**None consolidated yet — HubSpot has not had a live browser-flavor
hardening session as of 2026-06-01.** The 2026-05-23 work was a
manifest-authoring capture (GraphQL + view landmarks on portal
245597800), not an atom hardening pass that drives recipes against a
signed-in tab.

What IS known from the manifest (structural, not drift):

- **No per-property field widgets exist.** [widgets.yaml](widgets.yaml)
  ships only 6 GLOBAL affordances — global search, the Create-new menu,
  list/board search, the Edit button, the board Add-deals button, and the
  record-card link. There are NO widgets for individual record fields
  (Lifecycle Stage, Lead Status, Deal Stage, Amount, …). Consequently the
  `create_record` and `update_record` **browser recipes are STUBS**: they
  open the Create-new menu / Edit overlay and stop there. The per-field
  fills + the Save click are deferred to heal-time authoring (label-scoped
  selectors built from the property-definitions response — see the
  widgets.yaml deferral note). Until those land, real HubSpot writes go
  through the API flavors (session_api / oauth_api / mcp), which are fully
  authored; the browser write flavors are preview/launch-contract only.
- **Selectors live in [widgets.yaml](widgets.yaml).** The current ones
  lean on `data-test-id` / `aria-label` / `role` (e.g.
  `button[data-test-id='edit-button']`, `button[aria-label='Create new']`,
  `a[href*='/record/']`). They are unverified beyond the 2026-05-23
  capture; treat them as first-draft until a hardening pass confirms them
  against the live DOM.
- **View landmarks live in [views/](views/RecordView.yaml)** and the
  semantic screen/affordance/transition map in
  [app_model.yaml](app_model.yaml).

**When HubSpot is first hardened, capture per-action DOM gotchas + the
right selectors HERE** (mirror the gmail.md table), and back-fill the
EditOverlay / CreateOverlay field widgets into widgets.yaml +
app_model.yaml.

## L4 commit signals

Per [atom-methodology.md Rule A](../../onboarding/prompts/atom-methodology.md)
(snackbar-first), every browser-flavor write atom's L4 outcome should be a
positive rung corroborating the commit. **No success-toast strings have
been captured yet — HubSpot has not been live-hardened.** Capture the
per-action confirmation surfaces (HubSpot uses toast notifications on save)
HERE on first hardening.

What the atoms declare TODAY (read from `actions/*.yaml` — only what is
actually there):

| Atom | Browser-flavor L4 signal (as authored) | Honest status |
|---|---|---|
| `create_record` | `url_matches /record/[0-9]+-[0-9]+/(?<record_id>[0-9]+)` — navigation to the new RecordView | REAL positive rung (a URL transition to the created record is a genuine commit signal), and the `record_id` capture feeds `record.hs_object_id`. But the fill+Save steps that PRODUCE this nav are unwritten (stub). |
| `update_record` | `selector_appears [role='dialog'], [data-test-id='edit-overlay']` | **Overlay-OPEN signal, NOT a commit-confirmation.** It proves the Edit overlay opened, not that a Save persisted. Replace with a real positive rung (success toast via `selector_appears [role='alert']` + `must_contain_text`, or a field-value readback) when the fill+Save steps are authored. Do not treat as proof of a committed write. |
| `list_records` / `open_record` | `url_matches` on the list/board/record URL | REAL — these are navigation atoms (`commits_changes: false`), so a URL match is the correct + sufficient signal. |
| `search_records` / `get_record` (api flavors) | `network_response status 200` (mcp / oauth) or `url_matches hubspot.com` (session_api) | REAL for the API path; reads don't need a UI confirmation. |

No HubSpot browser write atom currently uses a lone `selector_disappears`
terminal signal, so there is no Trap-2 (GCal-style false-success) risk in
the present manifest. Keep it that way when authoring the real fill+Save
recipes: the Save's terminal signal must carry a positive rung (toast /
record delta), not a bare overlay-disappear.

## Known gaps

- **`_mcp_tools.yaml` lacks `server.remote_url` (http transport) — verify
  the real HubSpot MCP endpoint and add it; do not fabricate.** The
  catalog declares `transport: http` + `source_url:
  https://mcp.hubspot.com` but carries no `server.remote_url` (the actual
  MCP endpoint the runtime's `mcp` flavor would dispatch to). The
  integration-completeness gate flags this as a SOFT warning (not a hard
  fail — requiring it could pressure a fabrication). Confirm the real
  endpoint from HubSpot's MCP docs and add it; until then the `mcp`
  flavors cannot dispatch.
- **Browser write flavors are stubs** (`create_record`, `update_record`) —
  per-property field widgets + Save steps deferred to heal-time. See DOM
  gotchas above. Real writes currently flow through the API flavors.
- **`graphql_crm_objects_get` shape is unverified** — the session_api
  `get_record` path uses the GraphQL `crmObject(id, type)` field, INFERRED
  from the verified `crmObjectsSearch` query, not captured live
  (`confidence: medium`, `verified_at: null` in apis.yaml). Capture a
  record-view page load to confirm; the oauth_api `get_record` REST
  fallback already covers the case where the shape is wrong.
- **No `from_hubspot_*` extract sources implemented** — the session_api
  read flavors return the raw GraphQL payload via `from_step` (search:
  `.results`, get: the whole `crmObject`). The property values are nested
  at `results[].properties[].value` (array of `{name,value}` pairs); a
  future `from_hubspot_properties` flattener (mirroring SF's
  `from_aura_records`) could surface a flat `{Id, propName: value, …}`
  record. Until then callers get the unflattened GraphQL shape.
- **No blueprints authored** — there is no `blueprints/definitions/hubspot/` directory. The six atoms
  are wired + auto-registered, but no end-to-end smoke/demo blueprint
  exists yet.
- **Per-portal data is not baked in** — pipelines, stage sets, and
  property option lists vary per portal. Schemas carry the HubSpot-default
  option sets only; enumerate the live set at run time via
  `apis.yaml/pipelines_get` + `apis.yaml/properties_groups` (or the
  `get_properties` MCP tool).

## See also

- [app_model.yaml](app_model.yaml) — semantic screen/affordance/transition
  map (CreateOverlay + EditOverlay carry status:undocumented pending
  hardening).
- [_mcp_tools.yaml](_mcp_tools.yaml) — the 12-tool HubSpot MCP catalog
  (note the remote_url gap above).
- [apis.yaml](apis.yaml) — endpoint catalog: session GraphQL +
  properties/v4 + pipelines/v2; public `api.hubapi.com` REST.
- [widgets.yaml](widgets.yaml) — the 6 global widgets (per-property field
  widgets deferred to heal-time).
- [atom-methodology.md](../../onboarding/prompts/atom-methodology.md) —
  CANONICAL L0 methodology (5 layers, signal-type table, traps, authoring
  rules). Read before authoring/healing any HubSpot atom — especially Rule
  A (snackbar-first L4) when the write flavors are finally hardened.
- [INTEGRATION_FORMAT.md](../../../../../planning/tech_design/integrations/INTEGRATION_FORMAT.md)
  — canonical per-SaaS manifest + docs format (single-source-of-truth
  rule: selectors in widgets, URLs in apis/views, fields in schemas; this
  doc links, doesn't restate).
