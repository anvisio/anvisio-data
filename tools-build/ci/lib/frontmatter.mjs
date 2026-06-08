/**
 * Frontmatter parser — handles the three native containers per spec 60.3 §3:
 *   - Markdown (.md):    `---` YAML frontmatter
 *   - YAML (.yaml):      top-level `_meta:` key (real key, parser-friendly)
 *   - JSON (.json):      `$comment.data_cdn_meta` field
 *
 * Returns { meta, body } where:
 *   - meta: parsed frontmatter object (or null if no metadata block found)
 *   - body: the file's content with the frontmatter stripped (where applicable)
 *
 * Required fields per spec 60.3 §3.4:
 *   - name (with extension, e.g. 'prompts/propose.md')
 *   - version (semver)
 *   - cdn_schema_version (semver)
 *   - description
 *   - authored_at (ISO date)
 * Optional: authored_by, changelog, related_*
 */

import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import matter from 'gray-matter';
import YAML from 'yaml';

export const REQUIRED_FIELDS = ['name', 'version', 'cdn_schema_version', 'description', 'authored_at'];

/**
 * Parse a data file's frontmatter + body.
 * @param {string} filePath - absolute or relative path
 * @returns {{ meta: object|null, body: string, container: string }}
 */
export function parseFile(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const ext = extname(filePath).toLowerCase();

  if (ext === '.md') {
    const parsed = matter(raw);
    return {
      meta: Object.keys(parsed.data).length > 0 ? parsed.data : null,
      body: parsed.content,
      container: 'frontmatter',
    };
  }

  if (ext === '.yaml' || ext === '.yml') {
    let doc;
    try {
      doc = YAML.parse(raw);
    } catch (err) {
      return { meta: null, body: raw, container: '_meta', parseError: err.message };
    }
    if (doc && typeof doc === 'object' && doc._meta && typeof doc._meta === 'object') {
      return { meta: doc._meta, body: raw, container: '_meta' };
    }
    return { meta: null, body: raw, container: '_meta' };
  }

  if (ext === '.json') {
    let doc;
    try {
      doc = JSON.parse(raw);
    } catch (err) {
      return { meta: null, body: raw, container: '$comment', parseError: err.message };
    }
    if (doc && typeof doc === 'object' && doc.$comment?.data_cdn_meta) {
      return { meta: doc.$comment.data_cdn_meta, body: raw, container: '$comment' };
    }
    return { meta: null, body: raw, container: '$comment' };
  }

  return { meta: null, body: raw, container: 'unknown' };
}

/**
 * Validate that a meta block has all required fields.
 * Returns { ok, missing[] } where ok=true means all required fields present.
 */
export function validateRequired(meta) {
  if (!meta || typeof meta !== 'object') return { ok: false, missing: REQUIRED_FIELDS };
  const missing = REQUIRED_FIELDS.filter((f) => !meta[f]);
  return { ok: missing.length === 0, missing };
}

/**
 * Validate that `name` field includes the file extension AND matches the path.
 * Per D3.6: name = full canonical CDN path with extension (e.g. `prompts/propose.md`).
 */
export function validateName(meta, expectedRepoPath) {
  if (!meta?.name) return { ok: false, reason: 'missing name field' };
  if (meta.name !== expectedRepoPath) {
    return { ok: false, reason: `name=${JSON.stringify(meta.name)} does not match repo path ${JSON.stringify(expectedRepoPath)}` };
  }
  if (!extname(meta.name)) {
    return { ok: false, reason: `name=${JSON.stringify(meta.name)} is missing extension (per D3.6, name carries extension to align with session-log prompt_name)` };
  }
  return { ok: true };
}

/**
 * Files we expect to carry frontmatter. Returns true if the path
 * SHOULD have a frontmatter block, false otherwise (e.g. README.md,
 * CONTRIBUTING.md, CODEOWNERS, .gitignore).
 */
export function expectsFrontmatter(repoPath) {
  if (repoPath.startsWith('prompts/') && repoPath.endsWith('.md')) return true;
  if (repoPath.startsWith('widget-libraries/') && (repoPath.endsWith('.yaml') || repoPath.endsWith('.yml'))) return true;
  if (repoPath.startsWith('schemas/') && repoPath.endsWith('.json')) return true;
  if (repoPath.startsWith('tools/') && repoPath.endsWith('.json')) return true;
  // Blueprints are engine-format orchestrations (a `document:` block with
  // name/version/title/summary, not a CDN `_meta:` block). They're validated
  // by the runtime blueprint parser + the plugin's load-definitions, not this
  // CDN frontmatter gate. (check-schema.mjs already treats them as pass-through.)
  if (/^manifests\/[^/]+\/blueprints\//.test(repoPath)) return false;
  if (repoPath.startsWith('manifests/') && (repoPath.endsWith('.yaml') || repoPath.endsWith('.yml'))) return true;
  return false;
}
