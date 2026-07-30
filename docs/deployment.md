# Deployment Guide

## Prerequisites
- Docker and Docker Compose installed
- Supabase project (cloud or self-hosted)
- Domain name with DNS configured

## Production Build

\\\ash
# Build all services
npm run build

# Build Docker images
docker compose build

# Start services
docker compose up -d
\\\

## Environment Variables

Set the following on your deployment platform:

| Variable | Description |
|----------|-------------|
| SUPABASE_URL | Supabase project URL |
| SUPABASE_ANON_KEY | Public anon key |
| SUPABASE_SERVICE_KEY | Private service role key |
| NODE_ENV | Set to production |

## Database Migrations

\\\ash
supabase db push
supabase db push --db-url ""
\\\

## Health Check

The API exposes \/health\ for monitoring. Expected response: \{"status":"ok"}\.
