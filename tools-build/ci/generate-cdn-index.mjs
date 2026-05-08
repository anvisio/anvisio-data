#!/usr/bin/env node
/**
 * Generate .cdn-index.json — the discovery file plugins fetch on boot.
 *
 * Per spec 60.3 §2.2: plugin fetches
 *   https://cdn.jsdelivr.net/gh/anvisio/anvisio-data@<channel>/.cdn-index.json
 * to know what files exist + their current versions. This script walks the
 * repo's data directories, parses each file's frontmatter, and emits the
 * index with current versions, sizes, content hashes.
 *
 * Invoked by `.github/workflows/publish.yml` on every merge to main / beta
 * / release. Channel is read from $GITHUB_REF_NAME (the branch the workflow
 * triggered on).
 *
 * USAGE:
 *   node ci/generate-cdn-index.mjs --channel <channel>
 *
 * If --channel is omitted, falls back to GITHUB_REF_NAME or 'main'.
 */

import { writeFileSync, statSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { walkDataDirs } from './lib/changed-files.mjs';
import { parseFile, expectsFrontmatter } from './lib/frontmatter.mjs';

const args = process.argv.slice(2);
const channelIdx = args.indexOf('--channel');
const channel = channelIdx >= 0
  ? args[channelIdx + 1]
  : process.env.GITHUB_REF_NAME || 'main';

const commitSha = (() => {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
})();

const files = walkDataDirs().filter((f) => expectsFrontmatter(f));

const out = {
  cdn_schema_version: '60.3.0',
  generated_at: new Date().toISOString(),
  channel,
  commit_sha: commitSha,
  files: [],
};

const errors = [];

for (const file of files) {
  const { meta } = parseFile(file);
  if (!meta?.name || !meta?.version) {
    errors.push(`${file}: missing name or version (skipped)`);
    continue;
  }
  const stat = statSync(file);
  const content = readFileSync(file);
  const sha256 = createHash('sha256').update(content).digest('hex');

  out.files.push({
    path: meta.name,
    version: meta.version,
    size_bytes: stat.size,
    sha256,
    description: meta.description?.split('\n')[0]?.trim() ?? '',
    retired: !!meta.retired_at,
  });
}

out.files.sort((a, b) => a.path.localeCompare(b.path));

writeFileSync('.cdn-index.json', JSON.stringify(out, null, 2) + '\n', 'utf8');

if (errors.length > 0) {
  console.warn(`Skipped ${errors.length} file(s):`);
  for (const e of errors) console.warn(`  - ${e}`);
}
console.log(`Wrote .cdn-index.json with ${out.files.length} entries (channel=${channel}, sha=${commitSha.slice(0, 7)})`);
