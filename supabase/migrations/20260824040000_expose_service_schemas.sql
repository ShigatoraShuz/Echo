-- Expose the owned service schemas through the Supabase Data API.
-- Keep the legacy public and graphql_public schemas available as required.

alter role authenticator set pgrst.db_schemas = 'public,graphql_public,user_service,journal_service,buddy_service,verification_service,notification_service,grounding_service,insights_service,ai_analysis';

notify pgrst;
