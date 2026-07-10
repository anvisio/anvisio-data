---
integration: coffee
cdn_schema_version: 70.0.0
host: fresh.coffee.ai
---

# coffee.ai (fresh.coffee.ai)

## Object model

Multi-object CRM (System-of-Record): People, Companies, Deals, Tasks, Notes over one
data model, so Anvisio authors ONE object-generic atom set
(create/get/update/delete/search_object + an `object` input + `object_types:`) plus one
`schemas/<Object>.yaml` per type. Person is live-observed; the rest are FLAGGED.

## Transport priority

1. **browser** (mandatory inspection surface): drives the real Coffee UI. People
   create-flow live-observed 2026-07-09.
2. **session_api** (graphql + bearer_source): GraphQL at `coffee.prd.coffee.work/graphql`
   authed by an Auth0 access token in
   `localStorage['@@auth0spajs@@::<clientId>::https://coffee.prd.coffee.work::<scope>'].body.access_token`
   (NOT a cookie; wildcard CORS so credentials are omitted). Added by the later catalog pass.

## DOM gotchas / quirks

- Object list `/{segment}` (people/companies/deals/tasks/notes): search box
  `input[placeholder*='Search']` -> live typeahead `div.z-50`; `Add <Object>` opens a
  modal (`role=dialog`).
- Add Person modal: stable ids `#person-first`, `#person-email` (+5 fields); primary
  `[role=dialog] button.bg-primary` submits. Success toaster `li.group`
  "...created successfully"; invalid email -> `p.text-destructive`.
- Record view is a right-side DRAWER ("Person Details", radix dialog) at
  `/{segment}/{record_id}` (composite id `c|ddb|<workspace>|<hash>`); inline
  contenteditable edit via `aria-label='Edit'`.
- **FLAGGED:** update commit/toaster + the delete affordance (overflow menu + confirm)
  need a live hardening pass.

## MCP sources

None discovered — coffee.ai consumes MCP connectors (Google/M365) but exposes no MCP
server and no public API. GraphQL introspection is disabled for the caller, so operation
names come from observed operations, not `__schema`. Not yet live-hardened end to end.
