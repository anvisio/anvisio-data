#!/usr/bin/env node
/**
 * Gate 6 — License (no-op stub).
 *
 * License is deferred during the bootstrap phase (see README → License).
 * This gate exists in the workflow for forward-compat; once a license is
 * chosen (likely PolyForm Noncommercial 1.0.0 or similar), this script
 * becomes the enforcement: every new file carries the appropriate header,
 * no GPL / proprietary content slips in.
 *
 * Until then: pass with a note.
 *
 * USAGE:
 *   node ci/check-license.mjs
 */

import { runGate } from './lib/summary.mjs';

await runGate('License (gate 6)', async () => {
  return {
    status: 'skip',
    detail: 'license deferred during bootstrap phase (see README); gate is a no-op',
  };
});
