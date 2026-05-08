#!/usr/bin/env node
/**
 * Gate 3 — Version bump rule.
 *
 * For every changed data file with frontmatter, the new `version` field
 * must be strictly greater than the prior version (per spec 60.3 §3.5).
 * Newly-added files are exempt (no prior version to compare).
 *
 * Bump-type semantics (patch / minor / major) are enforced by spec 60.3
 * conventions but NOT machine-checked here — that requires understanding
 * the change scope, which only humans / LLM eval can judge. This gate
 * just enforces strictly-increasing semver.
 *
 * USAGE:
 *   node ci/check-version-bump.mjs    # PR-mode (compares against base ref)
 */

import semver from 'semver';
import { changedFiles, readAtRef, getBaseRef } from './lib/changed-files.mjs';
import { parseFile, expectsFrontmatter } from './lib/frontmatter.mjs';
import { runGate } from './lib/summary.mjs';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

await runGate('Version bump (gate 3)', async () => {
  const files = changedFiles().filter((f) => expectsFrontmatter(f));

  if (files.length === 0) {
    return { status: 'skip', detail: 'no data files changed' };
  }

  const baseRef = getBaseRef();
  const errors = [];
  const newFiles = [];
  const checked = [];

  for (const file of files) {
    // Read base-ref version
    const oldRaw = readAtRef(file, baseRef);
    if (oldRaw === null) {
      newFiles.push(file);
      continue;
    }

    // Parse old version: write to temp file so parseFile can use it
    const tmp = join(tmpdir(), `cdn-vercheck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.replace(/[^a-z0-9]/gi, '_')}`);
    writeFileSync(tmp + extOf(file), oldRaw, 'utf8');
    let oldMeta = null;
    try {
      const parsed = parseFile(tmp + extOf(file));
      oldMeta = parsed.meta;
    } finally {
      try { unlinkSync(tmp + extOf(file)); } catch {}
    }

    // Parse new version
    const { meta: newMeta } = parseFile(file);

    if (!oldMeta?.version || !newMeta?.version) {
      // Frontmatter-missing case is gate 1's problem, not this gate's.
      continue;
    }

    if (!semver.valid(oldMeta.version) || !semver.valid(newMeta.version)) {
      errors.push(`${file}: invalid semver (old=${oldMeta.version}, new=${newMeta.version})`);
      continue;
    }

    // If frontmatter changed but version didn't, error
    // (skip when only-meta-fields-changed; check actual body bytes? Hmm — too brittle.
    //  Easier rule: any file change requires a version bump. Forces discipline.)
    if (semver.eq(oldMeta.version, newMeta.version)) {
      errors.push(`${file}: file changed but version unchanged (${oldMeta.version}); bump per spec 60.3 §3.5`);
      continue;
    }

    if (semver.lt(newMeta.version, oldMeta.version)) {
      errors.push(`${file}: version decreased (${oldMeta.version} → ${newMeta.version})`);
      continue;
    }

    checked.push(`${file}: ${oldMeta.version} → ${newMeta.version}`);
  }

  if (errors.length > 0) {
    return {
      status: 'fail',
      detail: `${errors.length} file(s) failed: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? `; …${errors.length - 3} more` : ''}`,
    };
  }

  const skipMsg = newFiles.length > 0 ? ` (${newFiles.length} new file(s) exempt)` : '';
  return {
    status: 'pass',
    detail: `${checked.length} file(s) bumped correctly${skipMsg}`,
  };
});

function extOf(p) {
  const i = p.lastIndexOf('.');
  return i >= 0 ? p.slice(i) : '';
}
