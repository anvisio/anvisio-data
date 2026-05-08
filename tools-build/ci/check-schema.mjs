#!/usr/bin/env node
/**
 * Gate 2 — Schema validation.
 *
 * Validates changed YAML / JSON files against their JSON Schema:
 *   - manifests/<saas>/**\/*.yaml  → schemas/manifest-v60.json (sub-schemas per file role TBD)
 *   - intent.yaml fixtures        → schemas/intent-v60.json
 *   - test_catalog.json files     → schemas/test-catalog-v60.json
 *
 * Markdown prompt files are exempt — they're free-form prose with frontmatter
 * (frontmatter is gated by check-frontmatter.mjs).
 *
 * USAGE:
 *   node ci/check-schema.mjs              # PR-mode
 *   node ci/check-schema.mjs --all        # validate every applicable file
 */

import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import YAML from 'yaml';
import { changedFiles } from './lib/changed-files.mjs';
import { runGate } from './lib/summary.mjs';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

/**
 * Map a repo path to the JSON Schema it should validate against.
 * Returns null when no schema applies (e.g. README.md).
 */
function pickSchema(repoPath) {
  // test_catalog.json files (live anywhere under manifests/<saas>/)
  if (repoPath.endsWith('/test_catalog.json')) {
    return 'schemas/test-catalog-v60.json';
  }
  // intent.yaml fixtures (per-saas)
  if (repoPath.endsWith('/intent.yaml')) {
    return 'schemas/intent-v60.json';
  }
  // Per-SaaS manifest YAML files (apis.yaml, widgets.yaml, schemas/*.yaml, views/*.yaml, actions/*.yaml)
  if (repoPath.startsWith('manifests/') && (repoPath.endsWith('.yaml') || repoPath.endsWith('.yml'))) {
    return 'schemas/manifest-v60.json';
  }
  // Schemas directory itself: each json file IS a schema; no meta-validation gate here.
  // (We could validate they parse as JSON Schema 2020-12 but ajv accepts most things; skip.)
  return null;
}

function loadDocument(repoPath) {
  const raw = readFileSync(repoPath, 'utf8');
  if (repoPath.endsWith('.json')) {
    return JSON.parse(raw);
  }
  if (repoPath.endsWith('.yaml') || repoPath.endsWith('.yml')) {
    return YAML.parse(raw);
  }
  throw new Error(`Unsupported file type: ${repoPath}`);
}

function loadSchema(schemaPath) {
  try {
    return JSON.parse(readFileSync(schemaPath, 'utf8'));
  } catch (err) {
    return { __error: `failed to load ${schemaPath}: ${err.message}` };
  }
}

await runGate('Schema (gate 2)', async () => {
  const files = changedFiles().filter((f) => pickSchema(f) !== null);

  if (files.length === 0) {
    return { status: 'skip', detail: 'no schema-validatable files changed' };
  }

  const errors = [];
  const schemaCache = new Map();

  for (const file of files) {
    const schemaPath = pickSchema(file);
    if (!schemaCache.has(schemaPath)) {
      schemaCache.set(schemaPath, loadSchema(schemaPath));
    }
    const schema = schemaCache.get(schemaPath);

    if (schema.__error) {
      errors.push(`${file}: schema load failed: ${schema.__error}`);
      continue;
    }

    let validate;
    try {
      validate = ajv.compile(schema);
    } catch (err) {
      errors.push(`${file}: schema compile failed: ${err.message}`);
      continue;
    }

    let doc;
    try {
      doc = loadDocument(file);
    } catch (err) {
      errors.push(`${file}: parse failed: ${err.message}`);
      continue;
    }

    // The frontmatter `_meta:` key is metadata, not part of the schema body.
    // Strip it before validating so the file's actual content is what's checked.
    if (doc && typeof doc === 'object' && '_meta' in doc) {
      const { _meta: _ignored, ...body } = doc;
      doc = body;
    }

    if (!validate(doc)) {
      const detail = validate.errors.slice(0, 2).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');
      errors.push(`${file}: validation failed against ${schemaPath}: ${detail}`);
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
    detail: `${files.length} file(s) validated against schema`,
  };
});
