---
name: manifests/outlook/outlook.md
version: 0.1.0
cdn_schema_version: 60.4.2
authored_by: cd2k + claude
authored_at: 2026-05-17
description: |
  Outlook on the Web manifest README. Focused single-action manifest authored 2026-05-17 to verify the trusted-CDP press_key fix (commit d9ef6c3f) lets the workflow runner execute search_email end-to-end. Other verbs deferred until search smoke ships green.
---

# Outlook on the Web (focused manifest)

Single-action manifest authored 2026-05-17 to verify the trusted-CDP
press_key fix (d9ef6c3f) lets the workflow runner execute search_email
end-to-end against outlook.live.com.

Only search_email is wired up. Other verbs deferred.
