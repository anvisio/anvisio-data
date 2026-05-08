#!/usr/bin/env node
/**
 * Gate 1 — Frontmatter validation.
 *
 * Per spec 60.3 §3.4: every CDN-served data file carries a metadata block
 * (frontmatter for markdown, _meta: for YAML, $comment.data_cdn_meta for JSON)
 * with required fields: name (with extension), version (semver), cdn_schema_version
 * (semver), description, authored_at (ISO date).
 *
 * This gate validates every changed file in the PR.
 *
 * USAGE:
 *   node ci/check-frontmatter.mjs              # PR-mode (git diff against base)
 *   node ci/check-frontmatter.mjs --all        # validate every data file
 */

import semver from 'semver';
import { changedFiles } from './lib/changed-files.mjs';
import { parseFile, validateRequired, validateName, expectsFrontmatter } from './lib/frontmatter.mjs';
import { runGate } from './lib/summary.mjs';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Normalize authored_at to YYYY-MM-DD string (YAML may parse it as Date). */
function normalizeAuthoredAt(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

await runGate('Frontmatter (gate 1)', async () => {
  const files = changedFiles().filter((f) => expectsFrontmatter(f));

  if (files.length === 0) {
    return { status: 'skip', detail: 'no data files changed' };
  }

  const errors = [];

  for (const file of files) {
    const { meta, container, parseError } = parseFile(file);

    if (parseError) {
      errors.push(`${file}: parse failed (${parseError})`);
      continue;
    }
    if (!meta) {
      errors.push(`${file}: no metadata block found (expected ${container})`);
      continue;
    }

    const required = validateRequired(meta);
    if (!required.ok) {
      errors.push(`${file}: missing required fields: ${required.missing.join(', ')}`);
      continue;
    }

    const nameCheck = validateName(meta, file);
    if (!nameCheck.ok) {
      errors.push(`${file}: ${nameCheck.reason}`);
      continue;
    }

    if (!semver.valid(meta.version)) {
      errors.push(`${file}: version "${meta.version}" is not valid semver`);
      continue;
    }

    if (!semver.valid(meta.cdn_schema_version)) {
      errors.push(`${file}: cdn_schema_version "${meta.cdn_schema_version}" is not valid semver`);
      continue;
    }

    const authoredAt = normalizeAuthoredAt(meta.authored_at);
    if (!ISO_DATE.test(authoredAt)) {
      errors.push(`${file}: authored_at "${meta.authored_at}" is not ISO date (YYYY-MM-DD)`);
      continue;
    }

    if (typeof meta.description !== 'string' || meta.description.trim().length < 10) {
      errors.push(`${file}: description is missing or too short (<10 chars)`);
      continue;
    }
  }

  if (errors.length > 0) {
    return {
      status: 'fail',
      detail: `${errors.length} file(s) failed: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? `; …${errors.length - 3} more` : ''}`,
    };
  }

  return {
    status: 'pass',
    detail: `${files.length} file(s) validated`,
  };
});
