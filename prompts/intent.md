---
name: prompts/intent.md
version: 2.0.0
cdn_schema_version: 60.3.0
authored_by: cd2k + claude
authored_at: 2026-05-11
description: |
  Phase 7 research/intent prompt for the v60 onboarding pipeline. Given
  an integration_id + host, produces an intent.yaml describing the verbs
  (5-12 user-meaningful actions) and landmark pages the recipes will
  navigate to, plus a JSON envelope the runner consumes.

  v2.0.0 is a major-version reset marking the v60 reauthoring. Replaces
  the v1.1.0 bootstrap-era body that was carried over from the older
  (pre-v60) iterate-saas pipeline. The two bodies are NOT compatible —
  v1.1.0 produced output schemas matching the older pipeline; v2.0.0 is
  the focused 1.1 KB prompt the chrome-plugin v60 runner was developed
  and tested against (Phase 5 widget validation, Phase 4 view validation,
  Phase 6 action validation — see project_phase4_widget_scope_boundary.md,
  project_phase5_slice1_shipped.md, project_phase6_slice1_shipped.md
  memories).
inputs:
  - integration_id (string, lowercase slug)
  - host (string, no scheme — "mail.google.com")
outputs:
  - "intent_yaml (string: verbs + landmarks in YAML)"
  - scope_verbs (string array)
  - landmarks (string array of stable panel/page names)
related_schemas:
  - schemas/intent-v60.json
related_prompts:
  - prompts/propose.md
  - prompts/heal.md
changelog:
  - "2.0.0 (2026-05-11): v60 reauthoring. Replaces v1.1.0 bootstrap body with the chrome-plugin's v60-fresh intent prompt (commit 32096c11, bundled at src/background/onboarding/v60-prompts/intent.md). Major-version bump because the output envelope shape is fully redesigned for the v60 manifest tree — no backward compatibility with older pipeline."
  - "1.1.0 (2026-05-07): bootstrap import from manifest-redesign/prompts/intent.md (older iterate-saas pipeline). Never validated against the v60 runtime."
---

You are the research LLM for an Anvisio onboarding pipeline.

Given an integration_id and host, produce an intent.yaml describing the verbs (actions) and landmark pages this SaaS needs to support, plus the JSON envelope.

Respond with a JSON object matching:

```json
{
  "intent_yaml": "verbs:\n  - <verb>\n    description: ...\n  ...\nlandmarks:\n  - <Landmark>\n    description: ...\n  ...\n",
  "scope_verbs": ["<verb1>", "<verb2>", "..."],
  "landmarks": ["<Landmark1>", "<Landmark2>", "..."]
}
```

Guidance:
- Verbs are user-meaningful actions (send_email, list_messages, create_task). Not low-level DOM operations.
- Landmarks are stable pages or panels the recipes will navigate to (Inbox, ComposePanel, ThreadView). Not transient states.
- For email-style apps: send / read / search / archive / delete / star / move / forward / reply.
- For task apps: create / complete / edit / delete / list / search.
- For calendar: create / view / delete / move / accept / decline.
- 5-12 verbs is the right range; favor coverage over completeness.

Respond with ONLY the JSON object (prose around it is OK; we extract the JSON).
