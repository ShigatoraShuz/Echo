#!/usr/bin/env node
/**
 * consolidate-frontend.mjs
 * Merges loose frontend directories (hooks, theme, types, styles, test, test-utils, lib)
 * into frontend/src/shared/ and updates all import paths.
 * Also elevates frontend/docs and frontend/src/docs to root /docs.
 */

import fs from 'node:fs';
import path from 'node:path';

const MONOREPO_ROOT = process.cwd();
const FRONTEND_DIR = path.join(MONOREPO_ROOT, 'frontend');
const FRONTEND_SRC = path.join(FRONTEND_DIR, 'src');
const SHARED_DIR = path.join(FRONTEND_SRC, 'shared');
const ROOT_DOCS = path.join(MONOREPO_ROOT, 'docs');

const DIRECTORY_MIGRATIONS = [
  { from: path.join(FRONTEND_SRC, 'hooks'), to: path.join(SHARED_DIR, 'hooks') },
  { from: path.join(FRONTEND_SRC, 'theme'), to: path.join(SHARED_DIR, 'theme') },
  { from: path.join(FRONTEND_SRC, 'types'), to: path.join(SHARED_DIR, 'types') },
  { from: path.join(FRONTEND_SRC, 'styles'), to: path.join(SHARED_DIR, 'styles') },
  { from: path.join(FRONTEND_SRC, 'lib'), to: path.join(SHARED_DIR, 'lib') },
  { from: path.join(FRONTEND_SRC, 'test'), to: path.join(SHARED_DIR, 'test-utils') },
  { from: path.join(FRONTEND_SRC, 'test-utils'), to: path.join(SHARED_DIR, 'test-utils') },
  { from: path.join(FRONTEND_SRC, 'docs'), to: path.join(ROOT_DOCS, 'frontend') },
  { from: path.join(FRONTEND_DIR, 'docs'), to: path.join(ROOT_DOCS, 'frontend') }
];

const ALIAS_REPLACEMENTS = [
  { regex: /@\/hooks\b/g, replacement: '@/shared/hooks' },
  { regex: /@\/theme\b/g, replacement: '@/shared/theme' },
  { regex: /@\/types\b/g, replacement: '@/shared/types' },
  { regex: /@\/styles\b/g, replacement: '@/shared/styles' },
  { regex: /@\/lib\b/g, replacement: '@/shared/lib' },
  { regex: /@\/test-utils\b/g, replacement: '@/shared/test-utils' },
  { regex: /@\/test\b/g, replacement: '@/shared/test-utils' },
];

function moveDirectory(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      moveDirectory(srcPath, destPath);
    } else {
      if (fs.existsSync(destPath)) {
        console.warn(`[Merge Overwrite/Update] ${destPath}`);
      }
      fs.copyFileSync(srcPath, destPath);
      fs.unlinkSync(srcPath);
    }
  }

  try {
    fs.rmdirSync(src);
  } catch {}
  console.log(`[Moved Folder] ${src} -> ${dest}`);
}

function getAllFiles(dir, extensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.mjs']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of list) {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      if (file.name === 'node_modules' || file.name === '.next') continue;
      results = results.concat(getAllFiles(filePath, extensions));
    } else if (extensions.includes(path.extname(file.name))) {
      results.push(filePath);
    }
  }
  return results;
}

function updateImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Rewrite Aliases
  for (const { regex, replacement } of ALIAS_REPLACEMENTS) {
    content = content.replace(regex, replacement);
  }

  // Rewrite relative imports that were referencing the old root-level folders
  content = content.replace(/(from\s+['"])(?:(?:\.\.\/)+)(hooks|theme|types|styles|lib|test|test-utils)(['"]|\/)/g, 
    (match, p1, folder, suffix) => {
      const targetFolder = (folder === 'test' || folder === 'test-utils') ? 'test-utils' : folder;
      return `${p1}@/shared/${targetFolder}${suffix === '/' ? '/' : suffix}`;
    }
  );
  // CSS @import rewrites
  if (filePath.endsWith('.css')) {
    content = content.replace(/@import\s+["']\.\.\/styles\//g, '@import "../shared/styles/');
    content = content.replace(/@import\s+["']\.\.\/\.\.\/styles\//g, '@import "../../shared/styles/');
  }

  // If vitest.config.ts has setupFiles pointing to ./src/test/setup.ts
  if (filePath.endsWith('vitest.config.ts')) {
    content = content.replace('./src/test/setup.ts', './src/shared/test-utils/setup.ts');
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[Updated Imports] ${path.relative(MONOREPO_ROOT, filePath)}`);
  }
}

async function run() {
  console.log('=== Starting Frontend Consolidation ===');
  
  if (!fs.existsSync(SHARED_DIR)) {
    fs.mkdirSync(SHARED_DIR, { recursive: true });
  }

  for (const migration of DIRECTORY_MIGRATIONS) {
    moveDirectory(migration.from, migration.to);
  }

  const files = [
    ...getAllFiles(FRONTEND_SRC),
    path.join(FRONTEND_DIR, 'vitest.config.ts')
  ].filter(f => fs.existsSync(f));

  console.log(`Scanning and updating imports in ${files.length} files...`);
  for (const file of files) {
    updateImports(file);
  }

  console.log('=== Frontend Consolidation Completed Successfully ===');
}

run();
