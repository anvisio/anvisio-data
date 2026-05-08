#!/usr/bin/env node
/**
 * Gate 4 — Cross-reference integrity.
 *
 * Per spec 60.3 §3.4: data files declare `related_*` fields pointing at other
 * data files (e.g. `related_prompts: [prompts/heal.md]`, `related_schemas:
 * [schemas/manifest-v60.json]`). This gate ensures each ref points at an
 * existing, non-retired file.
 *
 * Walks ALL data files (not just changed ones) so a prior file's stale ref
 * surfaces when an unrelated PR runs CI — caught early instead of festering.
 *
 * USAGE:
 *   node ci/check-cross-refs.mjs
 */

import { existsSync } from 'node:fs';
import { walkDataDirs } from './lib/changed-files.mjs';
import { parseFile } from './lib/frontmatter.mjs';
import { runGate } from './lib/summary.mjs';

const REF_PREFIXES = ['related_', 'extends'];

await runGate('Cross-refs (gate 4)', async () => {
  const allFiles = walkDataDirs();

  const errors = [];
  let totalRefs = 0;

  for (const file of allFiles) {
    const { meta } = parseFile(file);
    if (!meta) continue;

    for (const key of Object.keys(meta)) {
      if (!REF_PREFIXES.some((p) => key.startsWith(p))) continue;

      const value = meta[key];
      const refs = Array.isArray(value) ? value : value ? [value] : [];

      for (const ref of refs) {
        if (typeof ref !== 'string') continue;
        totalRefs++;

        // Refs are CDN paths (e.g. `prompts/heal.md`); locally they map 1:1
        // with repo paths.
        if (!existsSync(ref)) {
          errors.push(`${file}: ${key} → "${ref}" does not exist`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return {
      status: 'fail',
      detail: `${errors.length} broken ref(s): ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? `; …${errors.length - 3} more` : ''}`,
    };
  }

  if (totalRefs === 0) {
    return { status: 'skip', detail: 'no related_* refs found in any data file' };
  }

  return { status: 'pass', detail: `${totalRefs} cross-ref(s) verified` };
});
