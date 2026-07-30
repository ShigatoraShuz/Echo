# Testing Guide

## Frontend Tests

Run with: \
pm run test -w frontend\

- \*.test.ts\ — Unit and integration tests
- \*A11y.test.tsx\ — Accessibility audits via jest-axe
- \*.stories.ts\ — Storybook story files

## Backend Tests

Run with: \
pm run test -w backend\

- \integration/*.test.ts\ — API endpoint integration tests

## Coverage Requirements

- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%
