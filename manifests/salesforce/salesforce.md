---
name: manifests/salesforce/salesforce.md
version: 0.1.0
cdn_schema_version: 70.0.0
authored_by: cd2k + claude
authored_at: 2026-05-19
---

# Salesforce

CRM at `https://<myDomain>.lightning.force.com`. Single-page Aura /
LWC app; landmark navigation via Lightning URL paths
(`/lightning/r/<Object>/<id>/view`, `/lightning/o/<Object>/list`,
`/lightning/r/<Object>/<id>/edit`). Authenticated via the user's
SF session cookie.

## Three sources feeding propose

1. **MCP catalog** (`_mcp_tools.yaml`) — 6 CRUD primitives covering
   query / search / dml / aggregate / bulk / dedup. Sourced from
   `github.com/KirtiJha/salesforce-mcp-server`. The official
   `salesforcecli/mcp` server has only `run_soql_query` (DX-focused)
   so we mirror the community CRUD surface here. Each atom action
   carries `mcp_tool: salesforce.<tool>` pointing back at the catalog
   entry.

2. **Web research** — SF Aura controller patterns
   (`/aura?aura.token=<csrf>` with `actions[].descriptor=...`),
   Lightning URL grammar, and per-object describe endpoints. These
   are stable enough that one research pass per major SF UI revision
   suffices.

3. **Live DOM** — Lightning's shadow-DOM-heavy rendering forces
   live verification. Selectors live in `widget-libraries/lightning.widgets.yaml`
   (shared across orgs); per-org `widgets.yaml` is a 2-line
   `extends:` stub plus rare overrides.

## Transport priority (spec 70 §7)

- **Writes** (`commits_changes: true`) prefer
  `browser > session_api > mcp`: writes happen in the user's actual
  SF tab where they can see the record get created / updated. For
  bulk creates / scheduled writes, the `session_api` Aura flavor or
  `mcp` flavor can run invisibly.
- **Reads** (`commits_changes: false`) prefer
  `session_api > mcp > browser`: SF reads via the Aura
  `/services/data/.../<Object>/describe` or SOQL endpoints are
  ~50x faster than driving the DOM. `mcp` is the fallback when the
  caller is operating outside the SF tab; `browser` is rarely the
  right choice for read.

## Authoring conventions

- **Meta-model actions** — `create_record`, `update_record`,
  `query_records`, `open_record` take `object_type` as an input so
  ONE action serves Opportunity, Lead, Contact, Account, etc. The
  schemas/<Object>.yaml files declare the per-type field metadata
  the action consumes via `fill_fields`.
- **DML wraps insert + update + delete** at the MCP layer
  (`dml_records` with `operation: insert | update | delete`). The
  anvisio browser flavor splits these into separate atoms
  (create_record / update_record / delete_record) for UI clarity
  since each opens a different SF landmark.
- **Compositions live in `compositions/`** per spec 70 §2. The
  primary demo target is `pipeline_prep` (search closing-this-week
  opps → judge staleness → ask user to update stage → synthesize a
  weekly summary).

## Known gaps

- **No checked-in v60 manifest to seed from.** Unlike gmail, the
  salesforce widgets/views/schemas have to be authored fresh in this
  v70 pass. The lightning widget library carries the per-archetype
  selectors; views + schemas are bootstrapped here based on standard
  SF Lightning URL + DOM patterns.
- **Aura controller discovery** is stubbed in `apis.yaml` with the
  known endpoints; specific controller descriptors (e.g.
  `serviceComponent://ui.aura.components.Service.create.Controller`)
  vary per org and get healed at first use.
