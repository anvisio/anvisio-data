#!/usr/bin/env node
/**
 * Gate 7 — PII scrub (heuristic).
 *
 * Session-log artifacts and manifest fixtures should not contain real PII.
 * This gate is a heuristic-based filter — it catches obvious leaks (email
 * addresses, phone numbers, real-looking names) but is NOT a complete
 * privacy filter. Human review remains the last line of defense.
 *
 * What it flags:
 *   - Email addresses NOT on a known-safe list (anvisio.com, example.com,
 *     test.com, *.invalid, noreply@)
 *   - Phone numbers in common formats (US/E164)
 *   - Hardcoded names from a small "common-fixture-names" namelist
 *     (common test names that should never appear in committed data)
 *
 * Exemptions:
 *   - Files in test_fixtures/ and **\/_test_*.* (test data, not user data)
 *   - The PR carries label `gate-override: pii` (maintainer escape hatch)
 *
 * USAGE:
 *   node ci/check-pii.mjs
 */

import { readFileSync } from 'node:fs';
import { changedFiles } from './lib/changed-files.mjs';
import { runGate } from './lib/summary.mjs';

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_REGEX = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

const SAFE_EMAIL_DOMAINS = new Set([
  'anvisio.com',
  'anvisio.ai',
  'example.com',
  'example.org',
  'test.com',
  'noreply.anthropic.com',
]);
const SAFE_EMAIL_LOCALS = new Set(['noreply', 'no-reply', 'support', 'admin']);

// Common fixture names that should never appear in committed data
// (extend as we find more — this is a heuristic, not exhaustive)
const FIXTURE_NAMES = [
  'jane.doe', 'john.doe', 'jane.smith', 'john.smith',
  'sarah.lee', 'sarah.connor', 'bob.smith', 'alice.smith',
  'foo.bar', 'foo.baz', 'lorem.ipsum',
];

function isExempt(filePath) {
  if (filePath.includes('test_fixtures/')) return true;
  if (filePath.includes('/_test_')) return true;
  if (filePath.endsWith('.test.json') || filePath.endsWith('.test.yaml')) return true;
  // CI tooling source is not user data — and this very file carries the
  // fixture-name detection list, which would otherwise self-flag.
  if (filePath.startsWith('tools-build/')) return true;
  return false;
}

function isLabeled(label) {
  // GitHub Actions: PR labels are NOT directly exposed via env. The workflow
  // would need to fetch + pass them. For now, this returns false; override
  // requires manual maintainer merge bypassing the CI check.
  return process.env.PR_LABELS?.split(',').includes(label) ?? false;
}

function isSafeEmail(addr) {
  const [local, domain] = addr.toLowerCase().split('@');
  if (SAFE_EMAIL_DOMAINS.has(domain)) return true;
  if (SAFE_EMAIL_LOCALS.has(local)) return true;
  if (domain.endsWith('.invalid')) return true;
  return false;
}

await runGate('PII scrub (gate 7)', async () => {
  if (isLabeled('gate-override: pii')) {
    return { status: 'skip', detail: 'override label set' };
  }

  const files = changedFiles().filter((f) => !isExempt(f));

  if (files.length === 0) {
    return { status: 'skip', detail: 'no in-scope files changed' };
  }

  const findings = [];

  for (const file of files) {
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const emailMatches = [...content.matchAll(EMAIL_REGEX)]
      .map((m) => m[0])
      .filter((addr) => !isSafeEmail(addr));
    if (emailMatches.length > 0) {
      findings.push(`${file}: email(s) ${emailMatches.slice(0, 2).join(', ')}${emailMatches.length > 2 ? `…+${emailMatches.length - 2}` : ''}`);
    }

    const phoneMatches = [...content.matchAll(PHONE_REGEX)]
      .filter((m) => {
        // Skip decimal-tailed numbers (Unix timestamps / versions like the
        // Slack ts "1700000000.000100") — these are not phone numbers.
        const after = content.slice(m.index + m[0].length, m.index + m[0].length + 2);
        if (/^\.\d/.test(after)) return false;
        // Skip NANP reserved-fictional 555-0100..555-0199 (the phone-number
        // equivalent of example.com) used in sample data.
        if (/55501\d\d/.test(m[0].replace(/\D/g, ''))) return false;
        return true;
      })
      .map((m) => m[0]);
    if (phoneMatches.length > 0) {
      findings.push(`${file}: phone(s) ${phoneMatches.slice(0, 2).join(', ')}${phoneMatches.length > 2 ? `…+${phoneMatches.length - 2}` : ''}`);
    }

    const lower = content.toLowerCase();
    const nameMatches = FIXTURE_NAMES.filter((n) => lower.includes(n));
    if (nameMatches.length > 0) {
      findings.push(`${file}: fixture name(s) ${nameMatches.join(', ')}`);
    }
  }

  if (findings.length > 0) {
    return {
      status: 'fail',
      detail: `${findings.length} finding(s): ${findings.slice(0, 3).join('; ')}${findings.length > 3 ? `; …${findings.length - 3} more` : ''}`,
    };
  }

  return { status: 'pass', detail: `${files.length} file(s) PII-clean` };
});
