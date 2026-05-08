/**
 * CI summary writer — appends rows to ci-summary.md which the validate.yml
 * workflow comments on the PR after all gates run.
 *
 * Each gate calls appendRow once with its name, status (pass / fail / skip),
 * and a 1-line message. The aggregated summary is what the PR author sees.
 */

import { existsSync, appendFileSync, writeFileSync } from 'node:fs';

const SUMMARY_PATH = process.env.CI_SUMMARY_PATH || 'ci-summary.md';

/**
 * Initialize the summary file with a header. Idempotent — if the file
 * already exists, leaves it alone.
 */
export function initSummary() {
  if (existsSync(SUMMARY_PATH)) return;
  writeFileSync(
    SUMMARY_PATH,
    '| Gate | Status | Detail |\n|---|---|---|\n',
    'utf8',
  );
}

/**
 * Append a row to the summary table.
 * @param {string} gate - human-readable gate name
 * @param {'pass'|'fail'|'skip'} status
 * @param {string} detail - 1-line message
 */
export function appendRow(gate, status, detail) {
  initSummary();
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⏭️';
  const safeDetail = String(detail).replace(/\n/g, ' ').replace(/\|/g, '\\|');
  appendFileSync(SUMMARY_PATH, `| ${gate} | ${icon} ${status} | ${safeDetail} |\n`, 'utf8');
}

/**
 * Wrap a gate's main fn with consistent error handling + summary writing.
 * @param {string} gateName
 * @param {() => Promise<{ status: 'pass'|'fail'|'skip', detail: string }>} fn
 */
export async function runGate(gateName, fn) {
  try {
    const { status, detail } = await fn();
    appendRow(gateName, status, detail);
    if (status === 'fail') {
      console.error(`❌ ${gateName}: ${detail}`);
      process.exit(1);
    }
    console.log(`${status === 'pass' ? '✅' : '⏭️'} ${gateName}: ${detail}`);
  } catch (err) {
    appendRow(gateName, 'fail', err.message || String(err));
    console.error(`❌ ${gateName}: ${err.message || err}`);
    process.exit(1);
  }
}
