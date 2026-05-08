---
name: prompts/eval.md
version: 0.1.0
cdn_schema_version: 60.3.0
authored_by: cd2k + claude
authored_at: 2026-05-07
description: |
  Post-onboarding eval prompt — placeholder for Phase 6 of spec 60.1.
  Reads a session log per spec 60.1, reads current versions of prompts +
  widget libraries + schemas + heal-tools, produces a structured proposal
  with per-finding diffs categorized by file. Authored fresh in Phase 6
  once we have real session logs to iterate against.
inputs:
  - session_log (matching schemas/session-log-60.json shape, when authored)
  - current data file versions (loaded from environment.data_versions in the session log)
outputs:
  - proposal (findings[] with category | file_path | issue | evidence | proposed_diff | confidence | rationale)
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
  - 0.1.0 (2026-05-07): placeholder; v1 lands in Phase 6 after first onboarding sessions land
---

# eval — placeholder for Phase 6

This file is a placeholder. The eval prompt is authored in **Phase 6** of [spec 60.1 plugin runtime pivot](https://github.com/anvisio/anvisio/blob/main/planning/impl_plans/60.1-plugin-runtime-pivot.md), after Phases 2-5 have produced the first real session logs.

## What this prompt will do

Take a verbose onboarding session log (per [spec 60.1](https://github.com/anvisio/anvisio/blob/main/planning/tech_design/architecture/60.1-verbose-logging-schema.md)) and produce a structured proposal for improving:

- **Prompts** (this file's siblings: intent.md, propose.md, heal.md)
- **Widget libraries** (`widget-libraries/<platform>.widgets.yaml`)
- **Per-SaaS manifests** (`manifests/<saas>/...`, when Phase 9 lands)
- **Heal tool catalog** (`tools/heal-tools.json`)
- **Runner code** (cross-cuts; flagged for human review since it's not in the data CDN)

Each finding carries: category, file_path, issue description, session-log evidence refs, proposed unified diff, confidence (low/medium/high), rationale.

## Why it's not authored yet

The eval prompt's quality is bottlenecked by the diversity of session logs it reads. With zero real sessions, the prompt would be guessing at what eval signals matter. We'll author v1 after the first 2-3 onboarding sessions land (Phase 5+8a), iterating against real evidence rather than hypothesizing.

## Spec reference

See [spec 60.1 impl plan §1 Phase 6](https://github.com/anvisio/anvisio/blob/main/planning/impl_plans/60.1-plugin-runtime-pivot.md) for the Phase 6 deliverables. The first version of `eval.md` lands as v0.1.0 → v1.0.0 once it produces a non-empty proposal flagging at least the today-known gotchas (typeahead-via-fill_text, send-disabled=success, hash-poll bug).
