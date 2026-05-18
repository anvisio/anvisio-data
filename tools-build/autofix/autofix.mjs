#!/usr/bin/env node
/**
 * Auto-fix: scaffold mechanical metadata that CI gates require but
 * are easy for an LLM (or human) to forget when promoting manifests.
 *
 * Two fixes today:
 *   1. _meta block missing → scaffold name/version/cdn_schema_version/
 *      authored_at/description with sensible defaults. description is
 *      a placeholder the user MUST edit.
 *   2. top-level `name:` missing on views → derive from filename.
 *
 * Targets: manifests/<saas>/**\/*.yaml.
 *
 * USAGE:
 *   node tools-build/autofix/autofix.mjs              # fix all eligible files
 *   node tools-build/autofix/autofix.mjs --dry-run    # report what would change
 *   node tools-build/autofix/autofix.mjs --paths foo bar/baz.yaml  # target specific paths
 *
 * Always prints a summary of files modified + a REVIEW list of files
 * that contain TODO placeholders.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, basename, relative, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import YAML from 'yaml';

const REPO_ROOT = process.cwd();
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const pathsIdx = args.indexOf('--paths');
const TARGET_PATHS = pathsIdx >= 0 ? args.slice(pathsIdx + 1) : null;

// Most-recent cdn_schema_version in the repo (60.4.2 as of 2026-05-18).
// Bump this constant when the schema family advances.
const DEFAULT_CDN_SCHEMA_VERSION = '60.4.2';
const DEFAULT_AUTHOR = 'anvisio';
const TODO_DESCRIPTION = 'TODO: replace with a 1-2 sentence file-specific summary (this placeholder was inserted by validate:fix and must be edited before commit)';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function gitFirstAddedDate(filePath) {
  try {
    const out = execSync(`git log --diff-filter=A --follow --format=%aI -- "${filePath}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!out) return null;
    return out.split('\n').pop().slice(0, 10);
  } catch {
    return null;
  }
}

function walkManifests(root) {
  const out = [];
  const manifestsDir = resolve(root, 'manifests');
  if (!existsSync(manifestsDir)) return out;
  walk(manifestsDir, out);
  return out;

  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const abs = resolve(dir, entry);
      const stat = statSync(abs);
      if (stat.isDirectory()) {
        walk(abs);
      } else if (stat.isFile() && (entry.endsWith('.yaml') || entry.endsWith('.yml'))) {
        out.push(relative(root, abs));
      }
    }
  }
}

function filesToProcess() {
  if (TARGET_PATHS) {
    return TARGET_PATHS.filter((p) => existsSync(resolve(REPO_ROOT, p)));
  }
  return walkManifests(REPO_ROOT);
}

function isViewFile(repoPath) {
  return /\/views\/[^/]+\.(yaml|yml)$/.test(repoPath);
}

function viewNameFromPath(repoPath) {
  return basename(repoPath).replace(/\.(yaml|yml)$/, '');
}

function scaffoldMeta(repoPath) {
  const authoredAt = gitFirstAddedDate(repoPath) || todayIso();
  return [
    '_meta:',
    `  name: ${repoPath}`,
    '  version: 1.0.0',
    `  cdn_schema_version: ${DEFAULT_CDN_SCHEMA_VERSION}`,
    `  authored_by: ${DEFAULT_AUTHOR}`,
    `  authored_at: ${authoredAt}`,
    '  description: |',
    `    ${TODO_DESCRIPTION}`,
    '',
    '',
  ].join('\n');
}

function processFile(repoPath) {
  const abs = resolve(REPO_ROOT, repoPath);
  const raw = readFileSync(abs, 'utf8');

  let doc;
  try {
    doc = YAML.parse(raw);
  } catch (err) {
    return { repoPath, changed: false, error: `YAML parse error: ${err.message}` };
  }

  const changes = [];
  let newContent = raw;
  let needsHumanReview = false;

  const hasMeta = doc && typeof doc === 'object' && doc._meta && typeof doc._meta === 'object';

  if (!hasMeta) {
    newContent = scaffoldMeta(repoPath) + newContent;
    changes.push('+_meta');
    needsHumanReview = true;
  }

  if (isViewFile(repoPath)) {
    const hasTopLevelName = doc && typeof doc === 'object' && typeof doc.name === 'string';
    if (!hasTopLevelName) {
      const viewName = viewNameFromPath(repoPath);
      // Insert `name: <ViewName>` after the _meta block (or at the top if no
      // _meta yet). Because we may have just prepended _meta above, the
      // simplest robust approach: re-parse the in-memory content to find the
      // first non-meta top-level line and insert before it.
      newContent = insertTopLevelName(newContent, viewName);
      changes.push('+name');
    }
  }

  if (changes.length === 0) {
    return { repoPath, changed: false };
  }

  if (!DRY_RUN) {
    writeFileSync(abs, newContent, 'utf8');
  }

  return { repoPath, changed: true, changes, needsHumanReview };
}

/**
 * Insert `name: <value>` as a top-level key. If the file starts with a
 * `_meta:` block, insert right after the block's last indented line.
 * Otherwise insert at the very top.
 */
function insertTopLevelName(content, value) {
  const lines = content.split('\n');

  // Walk lines: if first non-blank line is `_meta:`, find end of its block
  // (next non-indented non-blank line).
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;

  if (i < lines.length && lines[i].startsWith('_meta:')) {
    let j = i + 1;
    while (j < lines.length) {
      const l = lines[j];
      if (l === '' || l.startsWith(' ') || l.startsWith('\t')) {
        j++;
        continue;
      }
      break;
    }
    // Insert `name: <value>` before line j (the first non-indented line
    // after _meta). Add a blank line separator if not present.
    const insertion = [`name: ${value}`, ''];
    lines.splice(j, 0, ...insertion);
    return lines.join('\n');
  }

  // No _meta block at top — insert at very beginning.
  return `name: ${value}\n\n${content}`;
}

// ───────── main ─────────

const files = filesToProcess();
if (files.length === 0) {
  console.log('autofix: no eligible files');
  process.exit(0);
}

const results = files.map(processFile);
const changed = results.filter((r) => r.changed);
const errored = results.filter((r) => r.error);
const reviewNeeded = results.filter((r) => r.needsHumanReview);

if (errored.length > 0) {
  console.error('\n⚠️  Files with errors:');
  for (const r of errored) console.error(`  ${r.repoPath}: ${r.error}`);
}

if (changed.length === 0) {
  console.log(`autofix: scanned ${files.length} file(s), no fixes needed`);
  process.exit(errored.length > 0 ? 1 : 0);
}

const verb = DRY_RUN ? 'Would modify' : 'Modified';
console.log(`\n${verb} ${changed.length} file(s):`);
for (const r of changed) {
  console.log(`  ${r.repoPath}  [${r.changes.join(', ')}]`);
}

if (reviewNeeded.length > 0) {
  console.log(`\n🔍 REVIEW REQUIRED — scaffolded description placeholders in ${reviewNeeded.length} file(s):`);
  for (const r of reviewNeeded) {
    console.log(`  ${r.repoPath}`);
  }
  console.log('\nGrep for "TODO: replace with" and fill in real summaries before committing.');
}

if (DRY_RUN) {
  console.log('\n(dry-run — no files written)');
}

process.exit(errored.length > 0 ? 1 : 0);
