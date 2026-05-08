#!/usr/bin/env node
/**
 * Gate 5 — Manifest test catalog replay (no-op stub).
 *
 * Per spec 60.3 §13.6: PRs touching `manifests/<saas>/` should run that
 * SaaS's test catalog against a recorded fixture (snapshot replay; not live
 * SaaS) so a "fixed it on my screen, broke it on yours" PR can't merge.
 *
 * Until Phase 9 of spec 60.1 lands the `manifests/` subtree, this gate is
 * a no-op. Once manifests live in the repo, this script will:
 *   1. Load the changed manifest's test_catalog.json
 *   2. For each test, replay against the recorded fixture (DOM snapshot)
 *   3. Assert the recipe still produces the expected outcome
 *
 * The replay engine is the same one the plugin uses at runtime, vendored
 * here as a node-compatible build (TBD — Phase 9 deliverable).
 *
 * USAGE:
 *   node ci/replay-test-catalog.mjs --saas <saas-name>
 */

import { runGate } from './lib/summary.mjs';

const args = process.argv.slice(2);
const saasIdx = args.indexOf('--saas');
const saas = saasIdx >= 0 ? args[saasIdx + 1] : null;

await runGate('Manifest replay (gate 5)', async () => {
  if (!saas) {
    return { status: 'skip', detail: 'no --saas argument; nothing to replay' };
  }
  return {
    status: 'skip',
    detail: `replay engine not yet wired (Phase 9 of spec 60.1); would replay manifests/${saas}/`,
  };
});
