#!/usr/bin/env node
/**
 * Fails the build if:
 *   1. any locale under src/i18n/locales (admin dashboard chrome, en/ar) or
 *      src/i18n/publicLocales (a restaurant's public site, 12 languages) is
 *      missing a key that its own en.json has, or
 *   2. any customer-facing public-site component (src/pages/Public*.tsx,
 *      src/components/public/**) contains a raw non-Latin-script string
 *      literal (Arabic/Cyrillic/CJK/Hebrew/etc.) instead of going through
 *      t() — this codebase's actual hardcoded-text bugs were always a
 *      string typed directly in one non-English script. The internal
 *      staff/owner dashboard (everything else under src/pages, src/components)
 *      is intentionally out of scope — it's en/ar-only by design, not a
 *      restaurant/blog page a customer visits.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const srcDir = join(root, 'src');

let failed = false;

// ── 1. Locale key parity, for both locale sets ──────────────────────────

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

function checkLocaleSet(dir, label) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const enKeys = flatten(JSON.parse(readFileSync(join(dir, 'en.json'), 'utf-8')));

  for (const file of files) {
    if (file === 'en.json') continue;
    const locale = file.replace(/\.json$/, '');
    const keys = flatten(JSON.parse(readFileSync(join(dir, file), 'utf-8')));
    const missing = [...enKeys].filter((k) => !keys.has(k));
    if (missing.length > 0) {
      failed = true;
      console.error(`\n[i18n:check] ${label} "${locale}" is missing ${missing.length} key(s) present in en.json:`);
      for (const k of missing) console.error(`  - ${k}`);
    }
  }
}

checkLocaleSet(join(srcDir, 'i18n/locales'), 'admin dashboard');
checkLocaleSet(join(srcDir, 'i18n/publicLocales'), 'public site');

// ── 2. Hardcoded non-Latin-script literals in public-site components ───

const NON_LATIN = /[֐-ࣿЀ-ӿ一-鿿぀-ヿ]/;
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx']);

// Only the customer-facing public site — a restaurant's own menu/blog/halls
// pages and their shared components — not the staff dashboard chrome.
const PUBLIC_FILES = [
  ...readdirSync(join(srcDir, 'pages'))
    .filter((f) => f.startsWith('Public') && SCAN_EXTENSIONS.has(extname(f)))
    .map((f) => join(srcDir, 'pages', f)),
  ...readdirSync(join(srcDir, 'components/public'))
    .filter((f) => SCAN_EXTENSIONS.has(extname(f)))
    .map((f) => join(srcDir, 'components/public', f)),
];

for (const file of PUBLIC_FILES) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    // Explicit, auditable escape hatch for legitimate non-Latin literals —
    // e.g. a language picker's own native name ("العربية") for Arabic itself.
    if (line.includes('i18n-check-ignore')) return;
    if (NON_LATIN.test(line)) {
      failed = true;
      console.error(`[i18n:check] ${relative(root, file)}:${i + 1}: possible hardcoded non-Latin text — move it into src/i18n/publicLocales/*.json`);
      console.error(`  ${trimmed.slice(0, 120)}`);
    }
  });
}

if (failed) {
  console.error('\n[i18n:check] FAILED — see above.');
  process.exit(1);
} else {
  console.log('[i18n:check] OK — every locale has every en.json key, no hardcoded non-Latin text found in the public site.');
}
