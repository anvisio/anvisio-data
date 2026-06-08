---
name: manifests/linkedin/linkedin.md
version: 0.1.0
cdn_schema_version: 70.0.0
authored_by: cd2k + claude
authored_at: 2026-06-01
---

# LinkedIn

Professional network at `https://www.linkedin.com`. Single-page app.
PR #1 covers **people / lead research** (`view_profile`); messaging,
content publishing, and connections are later, risk-ascending PRs (see
Follow-ups).

## Transport priority

LinkedIn is **browser-first, and for people-research browser-ONLY.**

- **No usable MCP / official API for member reads.** LinkedIn's official
  REST API requires partner approval and exposes only the member's OWN
  profile, content posting (UGC / Shares), and events. There is NO
  official API for reading an arbitrary member, people search,
  messaging, or connections. Community MCP servers are either unofficial
  scrapers (account risk, run server-side, don't fit the browser-session
  model) or wrap only the narrow official API. So `view_profile` ships a
  single `browser` flavor and there is **no `_mcp_tools.yaml`**.
- **session_api / oauth_api:** none for member reads. A future content PR
  may add an `oauth_api create_post` over the official Shares API
  (requires the user to register a LinkedIn app + the `w_member_social`
  scope).
- spec 70 §7 still applies once API flavors exist; until then `browser`
  is the only flavor and runs by default.

## DOM gotchas (READ THIS before authoring any LinkedIn selector)

LinkedIn's DOM is hostile to selectors. Grounded live 2026-06-01:

1. **Hashed, rotating class names.** Classes look like `_5c527a07
   d0a6b3d9`; they change across deploys. NEVER scope a selector on a
   class.
2. **Zero `<h1>` elements.** The member name is an `<h2>` *inside* the
   `/in/` link. Anchor: `xpath=(//main//a[contains(@href,'/in/')]//h2)[1]`.
3. **No id anchors.** `#about` / `#experience` / `#education` were
   removed. Address a section by its `<h2>` text:
   `xpath=//main//h2[normalize-space()='About']/ancestor::section[1]`.
4. **Nested `<section>`s over-match.** "First section containing the
   name" and "first `/in/` link's ancestor section" both grab a broad
   wrapper (100+ `/in/` links). The TIGHT hero is the name-h2's NEAREST
   ancestor section: `(//main//a[...]//h2)[1]/ancestor::section[1]`
   (verified: 10 `<p>`, 6 `/in/` links).
5. **Href patterns are the stable entity anchors:** `/in/<slug>`
   (members), `/company/<slug>` (companies), `/school/<id>` (schools).
   Hero current-company = `(//main//a[contains(@href,'/company/')])[1]`.
6. **Lazy-loaded sections.** Experience / Education populate their
   `<li>`s only when scrolled into view (0 `<li>` above the fold). About
   renders near the top so it reads eagerly; Experience / Education list
   extraction needs a scroll-into-view step (deferred).
7. **Inline SVGs have no `innerText`** (use `textContent`); matters when
   walking hero descendants.

This is why `view_profile`'s read selectors are all `xpath=` (the
runtime's design-intended `css_or_xpath` form; the field-read resolvers
were wired for xpath in the same change that added this integration).
CSS cannot express text-anchored nodes (no `:contains`). Note: xpath is
wired for READS only; clicks / waits / `selector_appears` signals are
still CSS-only, so `view_profile`'s load wait + signal use CSS / url.

## Sources

- **MCP catalog:** none adopted. Surveyed 2026-06-01: `adhikasp/mcp-linkedin`
  + Apify (unofficial scrapers, account risk), `souravdasbiswas/linkedin-mcp-server`
  (official API: posting / events / own-profile only). None fits a
  browser-session member-read integration, so no `_mcp_tools.yaml`.
- **DOM grounding:** live signed-in profile (linkedin.com/in/chanudamarla)
  via chrome-devtools MCP, 2026-06-01. Selectors live in widgets.yaml;
  the per-field anchoring rationale is the gotchas above.
- **Official API reference (for the future content PR):** LinkedIn
  Marketing / Share APIs (developer.linkedin.com), partner-gated.

## L4 / write signals

N/A for PR #1 (`view_profile` is a READ; success = `url_matches`
`linkedin.com/in/` + populated fields). Write atoms (post, message,
invite) land in later PRs and will each need: the live success
toast / delta, the discard test, AND xpath extended to the signal /
click resolvers (currently xpath is wired for READS only).

## Account-risk note

LinkedIn actively fingerprints automation and restricts / bans accounts
for automated DOM **writes** (messages, invites). PR #1 is read-only
(low risk). Later write PRs must harden with a controlled test recipient
and be explicit about per-atom opt-in.

## Follow-ups (later PRs, risk-ascending)

1. `search_people` (browser read) + the `enrich_prospect` blueprint.
2. Profile Experience / Education list extraction (needs scroll-to-load).
3. Content publishing: `create_post` (official oauth_api) + `read_feed`.
4. Messaging: `read_messages` / `send_message` (high write-risk).
5. Connections: `list_connections` / `send_invite` (highest risk).
6. Extend `xpath=` to the signal / step / click resolvers (the write atoms need it).
