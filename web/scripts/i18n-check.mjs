#!/usr/bin/env node
/**
 * Fails the build if:
 *   1. any locale under src/i18n/locales is missing a key that en.json has, or
 *   2. any component outside src/i18n contains a raw non-Latin-script string
 *      literal (Arabic/Cyrillic/CJK/Hebrew/etc.) — this codebase's actual
 *      hardcoded-text bugs were always a string typed directly in one
 *      non-English script instead of going through t(), so that's what this
 *      heuristic looks for. It can't catch a hardcoded *English* string
 *      without false-positiving on every className/URL in the app, so this
 *      is a best-effort net, not a substitute for code review.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const localesDir = join(root, 'src/i18n/locales');
const srcDir = join(root, 'src');

let failed = false;

// ── 1. Locale key parity ────────────────────────────────────────────────

function flatten(obj, prefix = '') {
  const out = new Set();
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const k of flatten(value, path)) out.add(k);
    } else {
      out.add(path);
    }
  }
  return out;
}

const localeFiles = readdirSync(localesDir).filter((f) => f.endsWith('.json'));
const enKeys = flatten(JSON.parse(readFileSync(join(localesDir, 'en.json'), 'utf-8')));

for (const file of localeFiles) {
  if (file === 'en.json') continue;
  const locale = file.replace(/\.json$/, '');
  const keys = flatten(JSON.parse(readFileSync(join(localesDir, file), 'utf-8')));
  const missing = [...enKeys].filter((k) => !keys.has(k));
  if (missing.length > 0) {
    failed = true;
    console.error(`\n[i18n:check] "${locale}" is missing ${missing.length} key(s) present in en.json:`);
    for (const k of missing) console.error(`  - ${k}`);
  }
}

// ── 2. Hardcoded non-Latin-script literals outside the locale files ────

// Arabic, Hebrew, Cyrillic, CJK Unified Ideographs, Hiragana/Katakana.
const NON_LATIN = /[֐-ࣿЀ-ӿ一-鿿぀-ヿ]/;
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx']);
// 'admin' is the platform staff's own internal tool (not a restaurant-facing
// page) — out of scope for the customer-facing i18n pass this check guards;
// drop this exclusion if/when that tool is translated too.
const EXCLUDED_DIRS = new Set(['i18n', 'node_modules', 'admin']);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), files);
    } else if (SCAN_EXTENSIONS.has(extname(entry.name)) && !entry.name.endsWith('.test.tsx') && !entry.name.endsWith('.test.ts')) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

for (const file of walk(srcDir)) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    // Skip comment lines — an explanatory comment in another script isn't a
    // user-facing string, and several files legitimately document bugs like
    // this one in prose.
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    // Explicit, auditable escape hatch for legitimate non-Latin literals —
    // e.g. a language picker's own native name ("العربية") for Arabic itself,
    // which by definition can't be translated into something else.
    if (line.includes('i18n-check-ignore')) return;
    if (NON_LATIN.test(line)) {
      failed = true;
      console.error(`[i18n:check] ${relative(root, file)}:${i + 1}: possible hardcoded non-Latin text — move it into src/i18n/locales/*.json`);
      console.error(`  ${trimmed.slice(0, 120)}`);
    }
  });
}

if (failed) {
  console.error('\n[i18n:check] FAILED — see above.');
  process.exit(1);
} else {
  console.log('[i18n:check] OK — every locale has every en.json key, no hardcoded non-Latin text found.');
}
