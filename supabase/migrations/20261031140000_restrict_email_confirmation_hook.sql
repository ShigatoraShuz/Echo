-- The trigger function was introduced after the original schema-wide grants
-- were revoked. Keep it executable only by the trusted trigger owner.
revoke all on function auth_provisioning.consume_confirmed_email_signup()
  from public, anon, authenticated;
