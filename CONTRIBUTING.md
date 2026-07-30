# Contributing to Echo

## Getting Started
1. Fork the repository.
2. Clone your fork.
3. Run \
pm install\ in both \rontend/\ and \ackend/\.
4. Copy \.env.example\ to \.env.local\ and fill in values.
5. Run \
pm run dev\ to start the development environment.

## Code Style
- TypeScript strict mode is enabled.
- Follow the existing MVVM pattern for features.
- Use named exports for all components and utilities.
- Run \
pm run lint\ before committing.

## Commit Messages
Use conventional commits: \	ype(scope): description\.
Types: feat, fix, docs, test, refactor, chore, style, perf.

## Pull Requests
- Keep changes focused and atomic.
- Include tests for new functionality.
- Update documentation when adding features.
- Ensure all CI checks pass.

## Code Review
All submissions require review. Maintainers will review within 2 business days.
