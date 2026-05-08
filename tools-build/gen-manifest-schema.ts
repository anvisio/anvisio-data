#!/usr/bin/env tsx
/**
 * Generate schemas/manifest-v60.json from the canonical TypeScript types
 * in the main anvisio repo (`anvisio/manifest-redesign/validator/manifest_types.ts`).
 *
 * Per Phase 0 D3.5: TypeScript types are the source-of-truth; the JSON
 * Schema served by the data CDN is a generated artifact, never hand-edited.
 *
 * USAGE:
 *   pnpm tsx tools-build/gen-manifest-schema.ts \
 *     --types-source ../anvisio/manifest-redesign/validator/manifest_types.ts \
 *     --out schemas/manifest-v60.json
 *
 * INVOKED BY:
 *   - Manual: maintainers run before opening a PR that touches manifest_types.ts
 *   - CI (anvisio main repo): on push to main, regenerates + opens PR against
 *     anvisio-data with the new schema. Reviewer merges into anvisio-data:main.
 *
 * DEPENDS ON:
 *   - ts-json-schema-generator (https://github.com/vega/ts-json-schema-generator)
 *   - The anvisio main repo cloned alongside or accessible via path arg
 */

import { writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  createGenerator,
  type Config,
} from 'ts-json-schema-generator';

interface CliArgs {
  typesSource: string;
  out: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const typesSourceIdx = args.indexOf('--types-source');
  const outIdx = args.indexOf('--out');
  if (typesSourceIdx < 0 || outIdx < 0) {
    console.error('Usage: gen-manifest-schema.ts --types-source <path> --out <path>');
    process.exit(2);
  }
  return {
    typesSource: resolve(process.cwd(), args[typesSourceIdx + 1]),
    out: resolve(process.cwd(), args[outIdx + 1]),
  };
}

function readVersion(): string {
  // The current version is in the existing manifest-v60.json's $comment
  // metadata. Bump per spec 60.3 §3.5: minor for additive type changes,
  // major for breaking ones. Default-bump heuristic is too risky to
  // automate; the maintainer authors the version bump in a separate
  // commit, then runs this script.
  try {
    const existing = JSON.parse(readFileSync(resolve(process.cwd(), 'schemas/manifest-v60.json'), 'utf8'));
    return existing.$comment?.data_cdn_meta?.version ?? '1.0.0';
  } catch {
    return '1.0.0';
  }
}

function main() {
  const args = parseArgs();
  const version = readVersion();
  const today = new Date().toISOString().slice(0, 10);

  const config: Config = {
    path: args.typesSource,
    type: 'Manifest',                  // The top-level type to generate from
    expose: 'export',
    topRef: false,
    additionalProperties: false,
    skipTypeCheck: false,
    encodeRefs: true,
  };

  const generator = createGenerator(config);
  const generatedSchema = generator.createSchema(config.type) as Record<string, unknown>;

  // Inject the data-CDN metadata block at the top
  const wrapped = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://cdn.jsdelivr.net/gh/anvisio/anvisio-data@release/schemas/manifest-v60.json',
    $comment: {
      data_cdn_meta: {
        name: 'schemas/manifest-v60.json',
        version,
        cdn_schema_version: '60.3.0',
        authored_by: 'cd2k + claude (via gen-manifest-schema.ts)',
        authored_at: today,
        description: 'Spec 60 manifest format JSON Schema. Generated from validator/manifest_types.ts; do not hand-edit. Re-run gen-manifest-schema.ts to regenerate.',
      },
    },
    ...generatedSchema,
  };

  writeFileSync(args.out, JSON.stringify(wrapped, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${args.out} (manifest-v60.json @ v${version})`);
}

main();
