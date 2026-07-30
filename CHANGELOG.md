# Changelog

## [1.0.0-beta] - 2026-07-30

### Added
- Buddy AI chat with conversation history and mood-aware responses
- Journal with rich editor, emotion tags, search, filters, and autosave
- Insights dashboard with emotion trends, risk signals, and facial camera widget
- Grounding exercises (Box Breathing, Sensory, 5-4-3-2-1) with timer and pace control
- Settings with profile, notifications, privacy controls, trusted contacts, export, and account deletion
- Onboarding flow with consent, profile setup, permissions, and theme selection
- Landing page with feature overview, privacy section, and CTAs
- Backend API with Supabase integration, authentication, and RLS policies
- Accessibility: screen reader support, keyboard navigation, focus management, motion reduction
- Internationalization: i18n setup with English locale and translation infrastructure
- Storybook component documentation with a11y addon integration

### Changed
- Migrated from mock data to Supabase backend for all features
- Enhanced journal with HTTP adapter and backend CRUD endpoints
- Improved form accessibility across all feature components

### Security
- Row-Level Security policies on all database tables
- JWT-based authentication middleware
- Account deletion with 30-day grace period
