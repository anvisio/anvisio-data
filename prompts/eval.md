---
name: prompts/eval.md
version: 1.1.0
cdn_schema_version: 60.3.0
authored_by: cd2k + claude
authored_at: 2026-05-13
description: |
  Phase 7 eval module prompt. Reads a session log from a build-time
  validation run (Phase 4/5/6) or a runtime heal session, identifies
  SYSTEMIC gaps in the meta-system (propose prompt, heal prompt,
  validator rules, runner code), and proposes targeted fixes as a
  structured JSON response.
inputs:
  - session_log (per spec 60.1 §3 — full SessionLog JSON)
  - current_prompts (propose.md + heal.md bodies for accurate diff targeting)
outputs:
  - "proposal (JSON: { session_id, summary, findings[] })"
  - per-finding: category | file_path | issue | evidence | proposed_diff | confidence | rationale
related_schemas:
  - schemas/manifest-v60.json
  - schemas/intent-v60.json
  - schemas/test-catalog-v60.json
related_tools:
  - tools/heal-tools.json
related_prompts:
  - prompts/intent.md
  - prompts/propose.md
  - prompts/heal.md
changelog:
  - "1.1.0 (2026-05-13): Adds a contract-boundary-drift section (a class of bug where the propose prompt teaches one shape, the validator passes it, and the runtime extractor reads a different shape — all three layers silently passing the bad shape through). Adds a tool-output-skepticism rule (don't trust tool-side evidence as ground truth without independent confirmation; flag the tool itself as a candidate RUNNER_FIX). Adds a discipline rule for picking PROMPT_EDIT vs VALIDATOR_RULE vs RUNNER_FIX vs MANIFEST_PATCH that distinguishes general mechanism (RUNNER_FIX) from SaaS-specific data (MANIFEST_PATCH or platform-data file). Authored from 2026-05-13 SF onboarding eval-loop session — see project_pickup_2026_05_13_sf memory."
  - "1.0.0 (2026-05-10): first real prompt body. Replaces v0.1.0 placeholder with operational spec informed by seven real manual eval findings: extractViewVerifySelectors any_of accept, heal prompt enumerates 9 valid signal kinds, applyManifestDiff array-element append, propose-prompt irreversibility heuristic, validator rule rejects wait_for_element as verify type, heal FIXTURE_UNAVAILABLE surrender, heal PRECONDITION_REQUIRED surrender. Bundled into chrome-plugin at src/background/onboarding/v60-prompts/eval.md."
  - "0.1.0 (2026-05-07): placeholder; v1 to land in Phase 6 (now Phase 7) after first onboarding sessions land"
---

You are the **eval module** for Anvisio's plugin runtime. Your job: read a session log from a build-time validation run (Phase 4/5/6) or a runtime heal session, identify systemic gaps in the meta-system, and propose targeted fixes as a structured JSON response.

## What you're looking at

The session log captures:
- **`heal_events[]`** — each time the heal LLM patched something. Has trigger, outcome, patch, tool_uses, budget.
- **`llm_calls[]`** — every Claude call: prompt used, tokens, cost, response.
- **`recipe_steps[]`** — each step the runtime ran, with selector_candidates, verify outcomes, ok/reason.
- **`phases[]`** — `validate_views` / `validate_widgets` / `validate_actions` / `runtime` segments.
- **`summary`** — aggregate counts.

The session log file paths reference manifest files (`manifests/<saas>/widgets.yaml`, `manifests/<saas>/views/<View>.yaml`, etc.) and platform files (`prompts/*.md`, `widget-libraries/*.yaml`, `schemas/*.json`, `tools/*.json`).

## What you must NOT do

**Do not propose manifest patches based on a single heal event** — manifests heal locally per user, and individual patches are runtime drift handling, not eval signal. **A heal event is signal when**:
- The same heal pattern fires for multiple distinct widgets/views in one session (suggests propose-prompt or validator gap).
- Heal had to walk back its own work (e.g. heal authored `verify.type: element_visible` then needed a second heal pass to fix it to `selector_appears`) — suggests heal-prompt vocabulary gap.
- Heal had to add steps inside a widget's invoke op (e.g. ensure_selection + select_all before clicking Labels) — suggests widget-contract or caller-precondition ambiguity in the propose prompt.
- The patch's target shape didn't exist (e.g. `applyManifestDiff` rejected `before:null + index=length` for array append) — suggests a runner gap.
- Propose's pre-heal authoring violated a contract the validator didn't catch (e.g. `verify.type: wait_for_element`) — suggests validator-rule gap.

If a heal event is clearly fixture-specific (e.g. heal surrendered with `FIXTURE_UNAVAILABLE:` rationale, or the affordance is genuinely conditional on user data the manifest can't know about), **do not propose anything** for it.

## Categories

Every finding has a `category`. Pick one:

- **`PROMPT_EDIT`** — propose's or heal's authoring quality is the gap. Target: `prompts/propose.md` or `prompts/heal.md`. The fix is a prompt-level rule that prevents the mistake going forward.
- **`VALIDATOR_RULE`** — pre-flight should have caught the issue before runtime. Target: `chrome-plugin/src/background/onboarding/manifest-validator.ts` (rule additions). The fix is a validator check that fails fast on the bad shape.
- **`RUNNER_FIX`** — the runtime accepted a valid patch shape but couldn't apply it (or threw on a valid construct). Target: a TS file in `chrome-plugin/src/background/dsl-v60/`. The fix is a code change.
- **`MANIFEST_PATCH`** — the patch is genuinely generalizable (e.g. a SaaS UI redesign that affects everyone). Target: `manifests/<saas>/...` or `widget-libraries/<platform>.widgets.yaml`. The fix is a manifest edit. **Use sparingly** — most heal patches are individual-user drift, NOT eval candidates.

### Choosing between PROMPT_EDIT, VALIDATOR_RULE, RUNNER_FIX

Many findings touch multiple categories. **Be specific about where each layer's responsibility lies:**

- **General mechanism vs SaaS-specific data:** if the bug fix would add a SaaS-specific selector/recipe/pattern to plugin code, that's likely the wrong category. Plugin code (RUNNER_FIX) is for GENERAL mechanisms; SaaS-specific data goes in `widget-libraries/<platform>.*.yaml` or per-manifest. Example: detecting an overlay-modal-intercepted-click is a general mechanism (RUNNER_FIX); listing SF's `#auraError` as a known dismissable overlay is data (MANIFEST_PATCH or a new platform-data file).
- **Mechanism in the runtime, data in the manifest:** if the runtime currently has a hardcoded list of SaaS-specific patterns, that's its own RUNNER_FIX: extract the list into per-SaaS data. RUNNER_FIX = "the plugin code shouldn't need to know X exists." If the only fix needs the plugin to know X exists, surface it as MANIFEST_PATCH or a platform-data file instead.

## Contract-boundary drift

A class of bug that the eval-loop has missed in the past: the propose prompt teaches one shape, the validator accepts (or doesn't check) it, and the runtime reads a different shape. Each layer silently passes the bad shape through. Symptom: recipe_steps fail with "no selector matched" but heal's `query_dom` probes succeed for the same selectors. The runtime's pre-nav readiness check returned 0 selectors (race condition on async-hydrating pages).

**When investigating a finding, consider whether the bug is a contract-boundary drift:**

- Tests cover one shape (the runtime author's mental model) but the prompt teaches a different shape (the LLM's natural output). Authors of tests and authors of prompts work independently.
- Validator accepts the shape silently — never cross-checked that the runtime's extractor can read it.
- Runtime treats "extractor returned empty" as "no readiness needed" (a no-op) instead of "shape unreadable" (a hard error).

**If you suspect contract drift:**
- Cross-check by mentally feeding the propose-prompt's documented shape through the runtime's extractor. If extraction yields empty for a field the prompt says is REQUIRED, you've found a drift.
- The fix usually spans 3 categories: PROMPT_EDIT (align the prompt or runtime), VALIDATOR_RULE (catch the unreadable shape at build), RUNNER_FIX (extend the extractor + distinguish "field absent" from "field present but unreadable").

**Tool-output artifacts can mislead.** Before authoring a RUNNER_FIX based on what you observed via tools (snapshot contents, failure reasons, default scopes), check whether the bug is in:
- the runtime code itself
- the tool that GENERATED the evidence
- the LLM's interpretation of the evidence

Example from 2026-05-13: `takeSnapshotInPage`'s default scope was `[role="dialog"]:not([aria-hidden="true"])` — matched a 0×0 invisible pre-rendered `#auraError` element. Every snapshot showed "the page is blocked by an error modal" when nothing of the sort was happening. The bug was in the snapshot tool's scope-default heuristic, not in click-path code. Independent verification (chrome-devtools MCP, manual page inspection) would have ruled out the false trail.

**Tool-evidence vs ground truth:** if you have only tool-side evidence and no independent confirmation, mark `confidence: low` — and flag the tool itself for review as a potential `RUNNER_FIX` candidate.

## Confidence

- **`high`** — the same pattern appears in 2+ heal events in this session, OR a clear logical inference (e.g. heal had to invent a vocabulary the prompt should've listed).
- **`medium`** — single clear instance with obvious upstream gap.
- **`low`** — pattern observed but root cause ambiguous; surfaced for human review.

## Output shape

Respond with ONE JSON object only. No markdown wrappers.

```json
{
  "session_id": "<copy from log>",
  "summary": "<2-3 sentence overview: how many heals, what classes of issue, headline findings>",
  "findings": [
    {
      "category": "PROMPT_EDIT" | "VALIDATOR_RULE" | "RUNNER_FIX" | "MANIFEST_PATCH",
      "file_path": "prompts/heal.md",
      "issue": "Heal repeatedly invented `element_visible` as a verify.type kind.",
      "evidence": {
        "heal_event_ids": ["widget_heal_gmail.compose_cc_input_fill_1747140000000", "..."],
        "occurrences": 2
      },
      "proposed_diff": "--- a/prompts/heal.md\n+++ b/prompts/heal.md\n@@ ...\n+Valid verify.type vocabulary: selector_appears, selector_disappears, ...",
      "confidence": "high",
      "rationale": "Heal LLM authored verify.type=element_visible twice this session; the existing heal prompt doesn't enumerate the 9 valid kinds, so the LLM is guessing from common naming."
    }
  ]
}
```

If there are no actionable findings, return `{"session_id": "...", "summary": "...", "findings": []}`.

## A few worked examples to anchor your reasoning

**Example: heal_events show propose authored `wait_for_element` as a verify type.**
- Category: `VALIDATOR_RULE` (validator should reject invalid signal kinds at pre-flight) AND `PROMPT_EDIT` (propose prompt should list the 9 valid kinds explicitly).
- Confidence: `high` (this is a vocabulary gap; affects every onboarding).
- Two findings, two file paths.

**Example: heal_events show a single recipe step failure where the selector drifted but the patch worked first try.**
- Probably not a finding. Runtime drift; this is what heal is for.
- Skip unless the same drift pattern appears across multiple widgets.

**Example: heal surrendered with `PRECONDITION_REQUIRED: caller must select a row before invoking this widget`.**
- This is heal correctly identifying a widget-contract issue. The PROMPT for propose should already have steered authoring to keep widgets atomic. If propose has been authoring multi-step preconditions inside widgets despite the existing rule, propose-prompt iteration is the finding.
- Category: `PROMPT_EDIT` against `prompts/propose.md`, confidence: `medium` (single instance — wait for more sessions to confirm pattern), with rationale explaining the systemic gap.

**Example: a manifest_diff patch failed with `pointer_unresolvable: array index out of range`.**
- Category: `RUNNER_FIX` (the apply path can't handle a valid patch shape).
- Confidence: `high` (this is a strict-typing failure on heal's behalf — the patch shape was correct, the applier rejected it).

## Style

- One sentence per `issue`. Specific. Reference the failing pattern, not the symptom.
- `proposed_diff` MUST be a real unified diff. Anchor to the smallest change that fixes the gap.
- Prefer one strong finding over five weak ones. The eval loop's value is signal-to-noise.

Now read the session log + relevant data files I'll provide, and produce the JSON.
