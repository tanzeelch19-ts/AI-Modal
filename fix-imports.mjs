// fix-imports.mjs
// Run it inside the project folder (the one that has package.json and the "src" folder):
//
//     node fix-imports.mjs            fixes the imports
//     node fix-imports.mjs --check    only shows what is wrong, changes nothing
//
// It reads every .js / .jsx file in src and looks at each import that starts with ./ ../ or @/.
// If the file it points to does not exist (wrong capital/small letters, a missing or extra letter,
// the file is in another folder), the import is changed to point to the real file.
// Your files are never renamed or moved. Changed files are first copied to node_modules/.fix-imports-backup.
import fs from 'node:fs';
import path from 'node:path';

const CHECK = process.argv.includes('--check');
const SRC = path.resolve('src');
if (!fs.existsSync(SRC)) {
  console.log('Run this inside the project folder (the one that contains the "src" folder).');
  process.exit(1);
}

const isCode = (f) => /\.jsx?$/.test(f);
const toPosix = (p) => p.split(path.sep).join('/');
const relSrc = (p) => toPosix(path.relative(path.dirname(SRC), p));

// ---------- all files in src ----------
const allFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else allFiles.push(p);
  }
})(SRC);
const codeFiles = allFiles.filter(isCode);

const dirCache = new Map();
function list(dir) {
  if (!dirCache.has(dir)) {
    try { dirCache.set(dir, fs.readdirSync(dir, { withFileTypes: true })); } catch { dirCache.set(dir, []); }
  }
  return dirCache.get(dir);
}

// Windows ignores capital/small letters, but Vite does not, so existence is checked letter by letter.
function existsExact(abs) {
  const rel = path.relative(SRC, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  let cur = SRC, ent = null;
  for (const seg of rel.split(path.sep)) {
    ent = list(cur).find((e) => e.name === seg);
    if (!ent) return null;
    cur = path.join(cur, seg);
  }
  return { ent, abs: cur };
}

function goodTarget(abs) {
  const tries = isCode(abs) ? [abs] : [abs + '.js', abs + '.jsx', path.join(abs, 'index.js'), path.join(abs, 'index.jsx')];
  for (const t of tries) {
    const r = existsExact(t);
    if (r && r.ent.isFile()) return r.abs;
  }
  return null;
}

// ---------- finding the file that was meant ----------
const norm = (name) => name.replace(/\.jsx?$/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function lev(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

// cands: [{ full }]. Returns the one clearly closest to `want`, or null when unsure.
function pick(cands, want, maxDiff) {
  const scored = cands
    .map((c) => ({ c, d: lev(norm(path.basename(c.full)), want) }))
    .sort((a, b) => a.d - b.d);
  const [best, next] = scored;
  if (!best || best.d > maxDiff) return null;
  if (next && next.d - best.d < (best.d === 0 ? 1 : 2)) return null;   // two files fit equally well: do not guess
  return best.c.full;
}

function findReal(abs) {
  const want = norm(path.basename(abs));
  if (!want) return null;
  // 1. same folder (folder names matched ignoring capitals); the file name may have a few letters wrong
  const rel = path.relative(SRC, path.dirname(abs));
  if (!rel.startsWith('..')) {
    let cur = SRC, ok = true;
    for (const seg of rel.split(path.sep).filter(Boolean)) {
      const d = list(cur).find((e) => e.isDirectory() && e.name.toLowerCase() === seg.toLowerCase());
      if (!d) { ok = false; break; }
      cur = path.join(cur, d.name);
    }
    if (ok) {
      const here = list(cur).filter((e) => e.isFile() && isCode(e.name)).map((e) => ({ full: path.join(cur, e.name) }));
      const m = pick(here, want, Math.max(1, Math.min(4, Math.floor(want.length / 3))));
      if (m) return m;
    }
  }
  // 2. another folder: the file was put somewhere else, but has exactly this name (capitals do not matter)
  return pick(codeFiles.map((full) => ({ full })), want, 0);
}

function newSpec(fromFile, real, oldSpec) {
  const keepExt = /\.jsx?$/.test(oldSpec);
  const target = keepExt ? real : real.replace(/\.jsx?$/, '');
  if (oldSpec.startsWith('@/')) return '@/' + toPosix(path.relative(SRC, target));
  const r = toPosix(path.relative(path.dirname(fromFile), target));
  return r.startsWith('.') ? r : './' + r;
}

// ---------- pass 1: fix the paths ----------
const IMPORT = /(\b(?:from|import)\s*\(?\s*)(['"])([^'"\n]+)\2/g;
const isLocal = (s) => s.startsWith('./') || s.startsWith('../') || s.startsWith('@/');
const absOf = (file, spec) => (spec.startsWith('@/') ? path.join(SRC, spec.slice(2)) : path.resolve(path.dirname(file), spec));
const lineOf = (text, i) => text.slice(0, i).split('\n').length;
const skipSpec = (s) => { const x = path.extname(s); return x && !/^\.jsx?$/.test(x); };   // .css, .svg, .png ...

let stampValue = '';
const changes = [], broken = [], changedFiles = [];
for (const file of codeFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const out = text.replace(IMPORT, (all, pre, q, spec, offset) => {
    if (!isLocal(spec) || skipSpec(spec)) return all;
    const abs = absOf(file, spec);
    if (goodTarget(abs)) return all;
    const real = findReal(abs);
    if (!real) { broken.push(`${relSrc(file)} line ${lineOf(text, offset)}: '${spec}' - no matching file found`); return all; }
    const fixed = newSpec(file, real, spec);
    changes.push(`${relSrc(file)} line ${lineOf(text, offset)}:  '${spec}'  ->  '${fixed}'`);
    return pre + q + fixed + q;
  });
  if (out !== text) {
    changedFiles.push(file);
    if (!CHECK) {
      const stamp = fixImportsStamp();
      const backup = path.join('node_modules', '.fix-imports-backup', stamp, toPosix(path.relative(SRC, file)));
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.writeFileSync(backup, text);
      fs.writeFileSync(file, out);
    }
  }
}
function fixImportsStamp() {
  if (!stampValue) stampValue = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return stampValue;
}

// ---------- pass 2: names inside { } that the file does not export ----------
function exportsOf(file) {
  const t = fs.readFileSync(file, 'utf8');
  const names = new Set();
  let star = /export\s*\*\s*from/.test(t);
  if (/export\s+default\b/.test(t)) names.add('default');
  for (const m of t.matchAll(/export\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of t.matchAll(/export\s+(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of t.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const bits = part.trim().split(/\s+as\s+/);
      if (bits[0]) names.add((bits[1] || bits[0]).trim());
    }
  }
  return { names, star };
}

const nameProblems = [];
const FULL_IMPORT = /import\s+([\s\S]*?)\s+from\s*(['"])([^'"\n]+)\2/g;
for (const file of codeFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(FULL_IMPORT)) {
    const spec = m[3];
    if (!isLocal(spec) || skipSpec(spec) || m[1].includes('*')) continue;
    const target = goodTarget(absOf(file, spec));
    if (!target) continue;
    const { names, star } = exportsOf(target);
    if (star) continue;
    const clause = m[1].trim();
    const braces = clause.match(/\{([^}]*)\}/);
    const def = clause.replace(/\{[^}]*\}/, '').replace(/,/g, '').trim();
    const where = `${relSrc(file)} line ${lineOf(text, m.index)}`;
    const close = (w) => [...names].filter((n) => n !== 'default' && n.toLowerCase() === w.toLowerCase());
    if (def && !names.has('default')) {
      const alt = [...names].filter((n) => n !== 'default');
      nameProblems.push(`${where}: '${def}' is imported as the main export of '${spec}', but that file has none.${alt.length ? ` It exports: { ${alt.join(', ')} } - write the import as  import { ${alt[0]} } from '${spec}'` : ''}`);
    }
    if (braces) {
      for (const part of braces[1].split(',')) {
        const w = part.trim().split(/\s+as\s+/)[0].trim();
        if (!w || names.has(w)) continue;
        const hint = close(w);
        nameProblems.push(`${where}: '${w}' is not exported by '${spec}'.${hint.length ? ` Did you mean '${hint[0]}'? (and use that exact spelling in the file below)` : ` It exports: ${[...names].join(', ') || '(nothing)'}`}`);
      }
    }
  }
}

// ---------- report ----------
const bar = '-'.repeat(60);
if (!changes.length && !broken.length && !nameProblems.length) {
  console.log('All imports in src point to real files with the exact right letters. Nothing to fix.');
  process.exit(0);
}
if (changes.length) {
  console.log(`${bar}\n${CHECK ? 'Would fix' : 'Fixed'} ${changes.length} import line(s) in ${changedFiles.length} file(s):\n`);
  for (const c of changes) console.log('  ' + c);
  if (!CHECK) console.log(`\n(The old copies of the changed files are in node_modules/.fix-imports-backup/${fixImportsStamp()})`);
}
if (broken.length) {
  console.log(`${bar}\nCould not find a file for ${broken.length} import(s). The file is missing or named very differently:\n`);
  for (const b of broken) console.log('  ' + b);
}
if (nameProblems.length) {
  console.log(`${bar}\nNames inside imports that the other file does not have (fix these by hand):\n`);
  for (const n of nameProblems) console.log('  ' + n);
}
console.log(`${bar}\n${changes.length && !CHECK ? 'Now restart:  npm run dev' : ''}`);
