# Canonical database architecture

Supabase Auth owns `auth.*`; ECHO application data has one canonical schema, `public`. The additive migration `20260828000000_canonical_public_service_ownership.sql` retires the unused duplicate schemas/tables introduced by the earlier experiment and partitions public-table privileges among custom non-login service roles.

Browser roles have no protected application-table privileges. The API Gateway validates browser sessions through Supabase Auth. Each domain service receives a distinct server-only Supabase key carrying only its custom role claim. Services obtain another domain's data through its HTTP API, never its tables.

See [the full ownership matrix and conflict analysis](microservices.md#database-architecture-and-ownership) and the pgTAP tests in `supabase/tests/database/`.
