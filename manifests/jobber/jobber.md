---
cdn_schema_version: 70.0.0
integration: jobber
---

# Jobber — integration notes

Field-service SaaS (clients → requests → quotes → jobs → visits → invoices). A
**System-of-Record** (CRUD-S-R by object type). Web app at `secure.getjobber.com`;
GraphQL API at `api.getjobber.com/api/graphql`. Single-source-of-truth rule:
selectors live in [widgets.yaml](widgets.yaml), URLs/endpoints in
[apis.yaml](apis.yaml) + [views/](views/), fields in [schemas/](schemas/).

## Transport — two doors, no oauth (2026-07-08)

The web app and the public API are the **same endpoint** (`api.getjobber.com/api/graphql`),
differing only by auth: the web app sends the **session cookie** (`_jobber_session_id`,
`domain=.getjobber.com`); third parties send an OAuth bearer. So:

- **`session_api` (`kind: graphql`)** — the workhorse. A MAIN-world `credentials:'include'`
  POST to `https://api.getjobber.com/api/graphql`, header `x-jobber-graphql-version: 2026-05-12`.
  **No CSRF token** — protection is CORS (`allow-origin: https://secure.getjobber.com`) + the
  cookie. Introspection is enabled through the session, so arbitrary CRUD works. Live-proven.
  Writes declare `reject_path: data.<mutation>.userErrors` on the api_def — a non-empty array on
  a 200 becomes `invalid_input` (Rule S, session path; symmetric with oauth_api `rejects_when`).
- **`browser`** — the mandatory fallback (drive the web UI).
- **`oauth_api` — deliberately NOT authored.** The Developer Center is a SEPARATE account with
  a separate app registration; `session_api` reaches the same schema and is sufficient for a
  browser extension riding the user's session. The factory keeps the `oauth_api` capability for
  a future headless need; re-add it (register a `jobber` provider) only if that arises.

## Object model (per-entity, regular)

Mutations `{entity}Create` / `{entity}Edit` (not "Update") / `{entity}Delete`; queries
`{entity}` (get-by-id) + `{entities}(searchTerm, first)` → Relay `nodes{}` for search. IDs are
opaque `EncodedId`. Mind the mild irregularity: the create ARG name + input TYPE name vary per
entity (`clientCreate(input: ClientCreateInput!)` vs `jobCreate(input: JobCreateAttributes!)`
vs `quoteCreate(attributes: QuoteCreateAttributes!)`). Every write payload carries a non-null
`userErrors: [..]!` (empty on success) → each write atom sets `reject_path: data.<mutation>.userErrors`.

Live-verified signatures (introspection 2026-07-08):
- **Client:** `clientCreate(input: ClientCreateInput!)` · `clientEdit(clientId: EncodedId!, input:
  ClientEditInput!)` · `clientDelete(clientId: EncodedId!)`. All → `{client, userErrors}`.
- **Property:** `propertyCreate(clientId: EncodedId!, input: PropertyCreateInput!)` where
  `PropertyCreateInput = { properties: [PropertyAttributes!] }` (each `PropertyAttributes` has a
  required `address: AddressAttributes!`) → `{client, properties[], userErrors}`.
- **Job:** `jobCreate(input: JobCreateAttributes!)` → `{job, userErrors}`. `JobCreateAttributes`
  requires `propertyId: EncodedId!` AND `invoicing: JobInvoicingAttributes!` where invoicing needs
  two enums: `invoicingType: BillingStrategy!` (FIXED_PRICE | VISIT_BASED) + `invoicingSchedule:
  BillingFrequencyEnum!` (ON_COMPLETION | PERIODIC | PER_VISIT | NEVER). `jobType: JobTypeTypeEnum`
  (ONE_OFF | RECURRING). Note `jobDelete(jobIds: [EncodedId!]!)` takes a LIST (not a single id).

**Reference chain: Client → Property → Job (CORRECTION to the earlier plan).** `propertyCreate`
takes a **top-level `clientId` arg** (a Property IS linked to a Client by a standalone mutation —
the plan's "nest in clientCreate.properties, no clientId" was wrong; nesting also works but the
standalone `clientId` path is cleaner and is what create_property uses). `jobCreate` requires
`propertyId` (the Property supplies the client). A `Job` read exposes BOTH `client` (non-null) and
`property` (non-null) → the link assertion is clean: `job.client.id` + `job.property.id`. `get_job`
surfaces these flat as `client_id` / `property_id` for the run-chain's read-back assertion.

## OBJECT-GENERIC architecture (Rule Q — the 2026-07-08 re-authoring)

Jobber is a generic-object SOR (one data model over Client/Property/Job/Quote/Invoice/Request/Visit),
so per atom-methodology Rule Q it is authored as **ONE object-generic atom set**, NOT one-atom-per-
object. Five atoms — [create_object](actions/create_object.yaml) / [get_object](actions/get_object.yaml)
/ [update_object](actions/update_object.yaml) / [delete_object](actions/delete_object.yaml) /
[search_objects](actions/search_objects.yaml) — each taking an `object` input + `object_types:` list.

The GraphQL-SOR twist (why this needed engine work): a GraphQL SOR bakes the object into the
OPERATION NAME (`clientCreate` vs `jobCreate`), unlike SF's uniform `/sobjects/{ObjectType}` — so the
per-object operation can't be a URL parameter. The per-object wire descriptor therefore lives in each
**schema** (`schemas/<Object>.yaml` → `url_segment` + a `graphql:` block: per-verb `{query,
extract_path, reject_path, variables}`), and a new engine step **`resolve_object`** (step-executor)
dispatches it: given `inputs.object` + a verb, it reads the schema descriptor, resolves the
`variables` template against ctx (shaping the `fields` bag into the object's GraphQL variables —
absorbing every irregularity: `input:` vs `attributes:`, the propertyCreate `clientId` arg + nested
`{properties:[…]}`, jobDelete's `jobIds:[list]`, visitEdit's `id:`, Visit's missing searchTerm), and
feeds a downstream `call_platform_api` (kind: graphql) templated from `{{steps.desc.*}}`. Adding an
8th object = ONE schema (fields + descriptor), zero new atoms/views.

Enforced by **gate check 17** (findPerObjectCrudClusters): a per-object CRUD cluster on a generic-
object SOR now FAILS the gate (it fired on this integration's own first per-object draft).

**Live-proven 2026-07-08** (session_api, real account, records swept): all 7 objects' search
descriptors execute clean; Client full CRUD-S + a Request create (Request→Client ref resolves) round-
trip; the Client→Property→Job reference chain + 2-hop link assertion pass; clientDelete cascades
(async). Quote/Invoice/Visit CREATE descriptors are introspection-grounded but not live-created (their
required inputs — lineItems / origin+dueDetails+tax / nested visits — are supplied via `fields`).

## Browser-flavor DOM (New Client form, live-probed 2026-07-08)

Atlantis/React forms use **generated input ids** (`_r_1i_`) with NO stable
placeholder/name/testid — but each input has a `<label for="{id}">First name</label>`. Fields
are addressed **label-first** via `xpath=//input[@id = //label[normalize-space()="{label}"]/@for]`
(the runtime resolves `xpath=` via `document.evaluate`). Commit/discard buttons by text
("Save client" / "Cancel"). The email input additionally has `data-testid="ATL-InputEmail-input"`.

## Live-hardening pass — RESULTS (2026-07-08, real signed-in account, session_api)

Ran the full reference run-chain LIVE (the exact GraphQL the atoms encode), then swept the records:

- ✅ **Reference chain + 2-hop link assertion PASS.** clientCreate → propertyCreate(clientId) →
  jobCreate(propertyId) → read job: `job.client.id == created client id` AND `job.property.id ==
  created property id`. The whole factory generalization is validated end-to-end.
- ✅ **invalid_input (Rule S / reject_path).** jobCreate with a bogus propertyId → HTTP 200 +
  `data.jobCreate.userErrors = [{message:"Property not found"}]` → the executor emits
  `invalid_input: Property not found` (heal skips, the agent re-asks). Confirmed live.
- ✅ **update (clientEdit) + delete (clientDelete).** Partial edit works; delete succeeds.
- ⚠️ **clientDelete is ASYNCHRONOUS.** The mutation returns success (empty userErrors) immediately,
  but the client/property/job still resolve for a few seconds, then the cascade completes (all null
  after ~8s). delete_client's outcome fires on the mutation success (correct); any downstream
  "verify gone" must POLL, not read once.
- ✅ **URLs confirmed:** client `/clients/{numericId}`, property (nested)
  `/clients/{numericId}/properties/{numericId}`, **job `/work_orders/{numericId}`** (NOT `/jobs/` —
  Jobber's internal term is "work order"). get_job's browser nav updated to `/work_orders/`.

### ID-GRAIN SEAM (the #1 browser-hardening follow-on)

Web URLs use the base64-**DECODED numeric** id (EncodedId `MTQ1NzI1MDM4` → `145725038`), but the API
uses the **EncodedId**. So every browser `navigate` flavor (get_client / get_property / get_job) that
interpolates `{{inputs.<id>}}` (an EncodedId) into a URL slot produces the WRONG path, and every
`created_nav` extracts the NUMERIC web id (≠ the EncodedId the session_api returns). The robust fix:
navigate a prior session_api read's `jobberWebUri`, or decode the EncodedId in-recipe. Until then the
browser reads are FLAGGED; session_api (EncodedId throughout) is the proven path.

## Still FLAGGED (browser-write hardening follow-on — needs live form drives)

- The FLAGGED browser WRITE forms + their views/widgets: update_client (`/clients/{id}/edit`),
  create_property (Add Property form), create_job (New Job form + the type-to-search property
  picker), delete_client (the record-page action menu → Delete vs Archive → confirm). The fills +
  Save on the New CLIENT form were live-probed last session; the post-save redirect/toast + these
  other forms need live drives.
- The form's **reject surface** (submit a missing required field → the validation error selector;
  author it as the browser Save widget's `failure_selector` → `invalid_input`).
- **emails/phones** are nested `Email/PhoneNumberCreateAttributes` on the API vs simple form inputs
  (an id-grain seam) — first slice uses first/last/company only.

## Sources (MCP / catalog provenance)

**No official MCP server** — so no `_mcp_tools.yaml`. The catalog IS the **GraphQL schema via
introspection** (run from a signed-in `secure.getjobber.com` tab against
`api.getjobber.com/api/graphql`). Every atom's query/mutation + the schemas here are grounded in
that live introspection (2026-07-08), not web research. Vendor docs:
`developer.getjobber.com/docs` (Cloudflare-gated to browsers). Public API endpoint +
OAuth (unused): `api.getjobber.com/api/graphql`, `X-JOBBER-GRAPHQL-VERSION` header.
