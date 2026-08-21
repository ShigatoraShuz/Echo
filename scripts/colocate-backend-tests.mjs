#!/usr/bin/env node
/**
 * colocate-backend-tests.mjs
 * Migrates backend tests to feature co-located directories and e2e/security folders.
 */

import fs from 'node:fs';
import path from 'node:path';

const MONOREPO_ROOT = process.cwd();
const BACKEND_DIR = path.join(MONOREPO_ROOT, 'backend');
const BACKEND_SRC = path.join(BACKEND_DIR, 'src');
const BACKEND_TESTS = path.join(BACKEND_DIR, 'tests');

// Migration matrix
const TEST_MOVES = [
  // Health Feature
  {
    from: path.join(BACKEND_TESTS, 'health.test.ts'),
    to: path.join(BACKEND_SRC, 'features', 'health', '__tests__', 'health.test.ts')
  },
  // Experience Feature
  {
    from: path.join(BACKEND_TESTS, 'experience.routes.test.ts'),
    to: path.join(BACKEND_SRC, 'features', 'experience', '__tests__', 'experience.routes.test.ts')
  },
  {
    from: path.join(BACKEND_TESTS, 'unit', 'mock-analysis.provider.test.ts'),
    to: path.join(BACKEND_SRC, 'features', 'experience', '__tests__', 'mock-analysis.provider.test.ts')
  },
  // Verification Feature
  {
    from: path.join(BACKEND_TESTS, 'verification.routes.test.ts'),
    to: path.join(BACKEND_SRC, 'features', 'verification', '__tests__', 'verification.routes.test.ts')
  },
  {
    from: path.join(BACKEND_TESTS, 'unit', 'verification.service.test.ts'),
    to: path.join(BACKEND_SRC, 'features', 'verification', '__tests__', 'verification.service.test.ts')
  },
  // Journals Feature
  {
    from: path.join(BACKEND_TESTS, 'unit', 'encryption.service.test.ts'),
    to: path.join(BACKEND_SRC, 'features', 'journals', '__tests__', 'encryption.service.test.ts')
  },
  // E2E / Integration tests consolidation
  {
    from: path.join(BACKEND_TESTS, 'contract.test.ts'),
    to: path.join(BACKEND_TESTS, 'e2e', 'contract.test.ts')
  },
  {
    from: path.join(BACKEND_TESTS, 'live-integration.mjs'),
    to: path.join(BACKEND_TESTS, 'e2e', 'live-integration.mjs')
  },
  // Security tests consolidation
  {
    from: path.join(BACKEND_TESTS, 'auth.fail-closed.test.ts'),
    to: path.join(BACKEND_TESTS, 'security', 'auth.fail-closed.test.ts')
  },
  {
    from: path.join(BACKEND_TESTS, 'uuid-validation.test.ts'),
    to: path.join(BACKEND_TESTS, 'security', 'uuid-validation.test.ts')
  }
];

function fixImports(content, toPath) {
  if (toPath.includes(path.join('src', 'features'))) {
    // We are in src/features/<feature>/__tests__/<file>.test.ts
    // 1. ../src/app.js -> ../../../app.js
    content = content.replace(/(['"])\.\.\/src\/app(\.js)?(['"])/g, '$1../../../app$2$3');
    // 2. ../src/shared/ -> ../../../shared/
    content = content.replace(/(['"])\.\.\/src\/shared\//g, '$1../../../shared/');
    // 3. ../../src/infrastructure/ or ../src/infrastructure/ -> ../../../infrastructure/
    content = content.replace(/(['"])(\.\.\/)+src\/infrastructure\//g, '$1../../../infrastructure/');
    // 4. Same feature references: ../src/features/<feat>/ -> ../ or ../../<feat>/
    const featureMatch = toPath.match(/features[\\/]([a-zA-Z0-9_-]+)[\\/]/);
    const currentFeature = featureMatch ? featureMatch[1] : '';
    
    content = content.replace(/(['"])(\.\.\/)+src\/features\/([a-zA-Z0-9_-]+)\//g, (m, q, dots, feat) => {
      if (feat === currentFeature) {
        return `${q}../`;
      }
      return `${q}../../${feat}/`;
    });
    content = content.replace(/(['"])\.\.\/src\/features\/([a-zA-Z0-9_-]+)\//g, (m, q, feat) => {
      if (feat === currentFeature) {
        return `${q}../`;
      }
      return `${q}../../${feat}/`;
    });
  } else if (toPath.includes(path.join('tests', 'e2e')) || toPath.includes(path.join('tests', 'security'))) {
    // We are in tests/e2e or tests/security (2 levels deep from backend)
    // ../src/ -> ../../src/
    content = content.replace(/(['"])\.\.\/src\//g, '$1../../src/');
  }
  return content;
}

function processAllTestFiles() {
  const targetFiles = [
    path.join(BACKEND_SRC, 'features', 'health', '__tests__', 'health.test.ts'),
    path.join(BACKEND_SRC, 'features', 'experience', '__tests__', 'experience.routes.test.ts'),
    path.join(BACKEND_SRC, 'features', 'experience', '__tests__', 'mock-analysis.provider.test.ts'),
    path.join(BACKEND_SRC, 'features', 'verification', '__tests__', 'verification.routes.test.ts'),
    path.join(BACKEND_SRC, 'features', 'verification', '__tests__', 'verification.service.test.ts'),
    path.join(BACKEND_SRC, 'features', 'journals', '__tests__', 'encryption.service.test.ts'),
    path.join(BACKEND_TESTS, 'e2e', 'contract.test.ts'),
    path.join(BACKEND_TESTS, 'e2e', 'live-integration.mjs'),
    path.join(BACKEND_TESTS, 'security', 'auth.fail-closed.test.ts'),
    path.join(BACKEND_TESTS, 'security', 'uuid-validation.test.ts'),
  ];

  for (const file of targetFiles) {
    if (fs.existsSync(file)) {
      let content = fs.readFileSync(file, 'utf-8');
      const updated = fixImports(content, file);
      if (updated !== content) {
        fs.writeFileSync(file, updated, 'utf-8');
        console.log(`[Fixed Imports] ${path.relative(BACKEND_DIR, file)}`);
      }
    }
  }
}

function moveFile(from, to) {
  if (!fs.existsSync(from)) return;
  const targetDir = path.dirname(to);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let content = fs.readFileSync(from, 'utf-8');
  content = fixImports(content, to);

  fs.writeFileSync(to, content, 'utf-8');
  fs.unlinkSync(from);
  console.log(`[Moved Test] ${path.relative(BACKEND_DIR, from)} -> ${path.relative(BACKEND_DIR, to)}`);
}

function cleanupEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      cleanupEmptyDirs(fullPath);
    }
  }
  if (fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }
}

function run() {
  console.log('=== Starting Backend Test Co-location ===');
  for (const move of TEST_MOVES) {
    moveFile(move.from, move.to);
  }
  processAllTestFiles();
  cleanupEmptyDirs(path.join(BACKEND_TESTS, 'unit'));
  console.log('=== Backend Test Co-location Complete ===');
}

run();
