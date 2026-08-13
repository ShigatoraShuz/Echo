# ECHO contracts

This package owns transport-safe DTOs and validation schemas shared by service boundaries. It intentionally contains no React, Express, FastAPI, or database implementation code.

The current TypeScript contracts are the source of truth for Node.js validation. The matching JSON schemas in `schemas/` are for tooling and cross-language contract checks.
