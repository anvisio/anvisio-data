/**
 * Discover changed files for the current PR.
 *
 * In CI, `GITHUB_BASE_REF` is set to the target branch (e.g. `main`) and
 * `git diff origin/<base>...HEAD` lists touched files.
 *
 * Locally, falls back to `git diff HEAD~1` for development. Pass
 * `--all` to bypass git diff and process every data file (useful
 * during initial bootstrap).
 */

import { execSync } from 'node:child_process';
import { resolve, relative } from 'node:path';
import { existsSync, readdirSync, statSync } from 'node:fs';

/**
 * Run a shell command, return stdout. Throw on non-zero exit.
 */
function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    throw new Error(`Command failed: ${cmd}\n${err.message}`);
  }
}

/**
 * Get the list of changed files in this PR.
 * @param {object} opts
 * @param {boolean} opts.all - if true, returns all data files (bypasses git diff)
 * @returns {string[]} repo-relative paths
 */
export function changedFiles({ all = false } = {}) {
  if (all || process.argv.includes('--all')) {
    return walkDataDirs();
  }

  const baseRef = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : 'HEAD~1';

  try {
    const out = sh(`git diff --name-only --diff-filter=AM ${baseRef}...HEAD`);
    return out.split('\n').filter(Boolean);
  } catch {
    // First commit, or no diff context — fall back to all
    return walkDataDirs();
  }
}

/**
 * Walk the data directories and return all files that look like
 * CDN-served data (skip CI scripts, .github, etc.).
 */
export function walkDataDirs(repoRoot = process.cwd()) {
  const dirs = ['prompts', 'widget-libraries', 'schemas', 'tools', 'manifests'];
  const out = [];
  for (const dir of dirs) {
    const abs = resolve(repoRoot, dir);
    if (!existsSync(abs)) continue;
    walk(abs, out, repoRoot);
  }
  return out;
}

function walk(absDir, accumulator, repoRoot) {
  for (const entry of readdirSync(absDir)) {
    const abs = resolve(absDir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      walk(abs, accumulator, repoRoot);
    } else if (stat.isFile()) {
      const rel = relative(repoRoot, abs);
      // Skip non-data files that may have slipped in
      if (rel.includes('node_modules/')) continue;
      if (rel.endsWith('.md') || rel.endsWith('.yaml') || rel.endsWith('.yml') || rel.endsWith('.json')) {
        accumulator.push(rel);
      }
    }
  }
}

/**
 * Read a file's content from a specific git ref. Returns null if the file
 * didn't exist at that ref (e.g. newly added file). Used for version-bump
 * comparison.
 */
export function readAtRef(filePath, ref) {
  try {
    return execSync(`git show ${ref}:${filePath}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

export function getBaseRef() {
  return process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : 'HEAD~1';
}
