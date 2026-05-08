<!--
Thanks for your PR! Please fill out the relevant section below and remove the others.
See CONTRIBUTING.md for the full contribution guide.
-->

## Type

- [ ] **New SaaS manifest** (`manifests/<saas>/`)
- [ ] **Bug fix in existing manifest** (heal patch promotion or selector fix)
- [ ] **Prompt edit** (`prompts/<name>.md`)
- [ ] **Widget library** (`widget-libraries/<platform>.widgets.yaml`)
- [ ] **Schema / tools** (`schemas/<name>.json`, `tools/<name>.json`)
- [ ] **Repo / governance** (README, CONTRIBUTING, CI workflows, etc.)

## Summary

<!-- 1-3 sentences. What does this change and why? -->

## For new SaaS manifests

- [ ] Onboarding session log attached (link to gist or paste cleaned excerpt)
- [ ] All test_catalog tests pass live against the SaaS
- [ ] PII scrubbed from session log + manifest fixtures
- [ ] DCO sign-off (`git commit -s`) — deferred until license is set; encouraged but not required during bootstrap phase

## For heal-patch promotions

- [ ] Patch was eval-flagged as high-confidence (link to eval proposal)
- [ ] Recipe retried successfully after patch in original session
- [ ] No regression in other recipes touching the same file

## For prompt edits

- [ ] Issue reference: which session log surfaced this gap?
- [ ] Replay evidence: how does this prompt edit improve outcomes against archived sessions? (eval module replay, or manual diff)
- [ ] Backward compatibility: is this a patch / minor / major bump? (see CONTRIBUTING.md §Versioning)

## CI gates

The following CI checks run automatically. All must pass before merge:

- [ ] **Frontmatter** — `_meta:` / frontmatter / `$comment.data_cdn_meta` well-formed; required fields present
- [ ] **Schema** — file validates against its JSON Schema
- [ ] **Version bump** — new `version` greater than prior; bump type matches change
- [ ] **Cross-ref integrity** — `related_*` fields point at valid files
- [ ] **Manifest replay** — for `manifests/<saas>/` PRs, test catalog runs against recorded fixture
- [ ] **License** — no-op until a license is set (see README); will check headers once license is chosen
- [ ] **PII scrub** — no emails, phone numbers, names from common fixtures
- [ ] **Size** — files <200 KB (override label `gate-override: size` if needed)

## Reviewer notes

<!-- Anything specific the reviewer should know about? Edge cases? Trade-offs? -->
