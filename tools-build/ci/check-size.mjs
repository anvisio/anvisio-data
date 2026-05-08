#!/usr/bin/env node
/**
 * Gate 8 — Size cap.
 *
 * Per spec 60.3 §10: no file exceeds 200 KB. Single large files are usually
 * a sign that something belongs in the session-log fixtures (binary blob,
 * recorded snapshot) rather than in the data CDN. Override available via
 * PR label `gate-override: size`.
 *
 * USAGE:
 *   node ci/check-size.mjs
 */

import { statSync } from 'node:fs';
import { changedFiles } from './lib/changed-files.mjs';
import { runGate } from './lib/summary.mjs';

const SIZE_CAP_BYTES = 200 * 1024;

function isLabeled(label) {
  return process.env.PR_LABELS?.split(',').includes(label) ?? false;
}

await runGate('Size (gate 8)', async () => {
  if (isLabeled('gate-override: size')) {
    return { status: 'skip', detail: 'override label set' };
  }

  const files = changedFiles();
  if (files.length === 0) {
    return { status: 'skip', detail: 'no files changed' };
  }

  const oversized = [];
  let largestKb = 0;

  for (const file of files) {
    let stat;
    try {
      stat = statSync(file);
    } catch {
      continue;
    }
    const kb = stat.size / 1024;
    if (stat.size > SIZE_CAP_BYTES) {
      oversized.push(`${file} (${kb.toFixed(1)} KB)`);
    }
    if (kb > largestKb) largestKb = kb;
  }

  if (oversized.length > 0) {
    return {
      status: 'fail',
      detail: `${oversized.length} file(s) exceed 200 KB cap: ${oversized.slice(0, 3).join('; ')}${oversized.length > 3 ? `; …${oversized.length - 3} more` : ''}. Add label gate-override: size to bypass.`,
    };
  }

  return { status: 'pass', detail: `${files.length} file(s) under 200 KB cap (largest: ${largestKb.toFixed(1)} KB)` };
});
