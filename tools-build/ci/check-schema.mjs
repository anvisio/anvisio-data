#!/usr/bin/env node
/**
 * Gate 2 — Schema validation.
 *
 * Validates changed YAML / JSON files against their JSON Schema:
 *   - manifests/<saas>/apis.yaml         → schemas/manifest-v60/apis.schema.json
 *   - manifests/<saas>/widgets.yaml      → schemas/manifest-v60/widgets.schema.json
 *   - manifests/<saas>/schemas/*.yaml    → schemas/manifest-v60/entity-schema.schema.json
 *   - manifests/<saas>/views/*.yaml      → schemas/manifest-v60/view.schema.json
 *   - manifests/<saas>/actions/*.yaml    → schemas/manifest-v60/action.schema.json
 *   - manifests/<saas>/workflows/*.yaml  → schemas/manifest-v60/workflow.schema.json
 *   - intent.yaml fixtures               → schemas/intent-v60.json
 *   - test_catalog.json files            → schemas/test-catalog-v60.json
 *
 * The umbrella `schemas/manifest-v60.json` describes the bundle envelope
 * shape that propose-step emits (`{ files: {...} }`) and is not applied
 * to per-file content. It's kept for cross-refs from prompts and for
 * future bundle-validation use cases.
 *
 * Markdown prompt files are exempt — they're free-form prose with frontmatter
 * (frontmatter is gated by check-frontmatter.mjs).
 *
 * USAGE:
 *   node ci/check-schema.mjs              # PR-mode
 *   node ci/check-schema.mjs --all        # validate every applicable file
 */

import { readFileSync } from 'node:fs';
// Ajv 2020 build registers the draft-2020-12 meta-schema by default.
// The default `from 'ajv'` import is draft-07 and cannot resolve
// `"$schema": "https://json-schema.org/draft/2020-12/schema"`.
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import YAML from 'yaml';
import { changedFiles } from './lib/changed-files.mjs';
import { runGate } from './lib/summary.mjs';

// `validateSchema: false` — the repo's CDN-frontmatter convention puts an
// object at `$comment.data_cdn_meta` (per spec 60.3 §3 + tools-build/ci/
// lib/frontmatter.mjs). Ajv 2020 enforces the draft-2020-12 meta-schema
// which requires `$comment` to be a string; skipping meta-schema validation
// lets our schemas compile while keeping data-validation semantics intact.
const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
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
  // Per-SaaS manifest YAML files — route per-role.
  if (repoPath.startsWith('manifests/') && (repoPath.endsWith('.yaml') || repoPath.endsWith('.yml'))) {
    if (repoPath.match(/^manifests\/[^/]+\/apis\.ya?ml$/)) {
      return 'schemas/manifest-v60/apis.schema.json';
    }
    if (repoPath.match(/^manifests\/[^/]+\/widgets\.ya?ml$/)) {
      return 'schemas/manifest-v60/widgets.schema.json';
    }
    if (repoPath.match(/^manifests\/[^/]+\/schemas\/[^/]+\.ya?ml$/)) {
      return 'schemas/manifest-v60/entity-schema.schema.json';
    }
    if (repoPath.match(/^manifests\/[^/]+\/views\/[^/]+\.ya?ml$/)) {
      return 'schemas/manifest-v60/view.schema.json';
    }
    if (repoPath.match(/^manifests\/[^/]+\/actions\/[^/]+\.ya?ml$/)) {
      return 'schemas/manifest-v60/action.schema.json';
    }
    if (repoPath.match(/^manifests\/[^/]+\/workflows\/[^/]+\.ya?ml$/)) {
      return 'schemas/manifest-v60/workflow.schema.json';
    }
    // Any other yaml under manifests/<saas>/ is unrecognised — let it
    // through (gate 4 cross-refs + gate 1 frontmatter still apply).
    return null;
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
