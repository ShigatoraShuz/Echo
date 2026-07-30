# Architecture Overview

## System Design

\\\
[Client Browser]
      |
[Next.js Frontend] --- (API calls) ---> [Express Backend] ---> [Supabase/PostgreSQL]
      |                                       |
[Service Worker]                       [RLS Policies]
      |                                       |
[Cache Layer]                          [Auth Middleware]
\\\

## Frontend Architecture (MVVM)

Each feature follows the Model-View-ViewModel pattern:
- **Model**: Data types, DTOs, service interfaces
- **View**: React components in view/ and components/
- **ViewModel**: State management and business logic hooks

## Backend Architecture

Layered architecture:
- Routes (feature-level HTTP handlers)
- Middleware (auth, error handling, validation)
- Shared (Zod schemas, types, utilities)

## Security

- JWT authentication on all protected routes
- RLS at database level for data isolation
- HTTPS enforced in production
- Helmet.js for HTTP headers

## Accessibility

- WCAG 2.2 AA compliance target
- ARIA labels and landmarks throughout
- Keyboard navigable with visible focus indicators
- Screen reader announcements via live regions
- Motion reduction support for vestibular disorders
