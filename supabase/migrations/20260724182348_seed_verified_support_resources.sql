-- The Find Help directory must only display resources that have an explicit
-- verification source and date. The insert is idempotent so restoring or
-- replaying this migration cannot create duplicate directory entries.
insert into public.support_resources (
  country_code,
  region_code,
  support_resource_type,
  organization_name,
  resource_name,
  description,
  phone_number,
  availability_text,
  is_active,
  is_verified,
  display_priority,
  verification_source,
  last_verified_at
)
select
  'PH',
  null,
  'crisis_hotline',
  'National Center for Mental Health',
  'NCMH Crisis Hotline',
  'Free, compassionate and confidential phone support for people in the Philippines experiencing emotional distress.',
  '1800-1888-1553',
  '24 hours a day, 7 days a week',
  true,
  true,
  10,
  'OpenAI Hotline Directory',
  timezone('utc', now())
where not exists (
  select 1
  from public.support_resources
  where country_code = 'PH'
    and organization_name = 'National Center for Mental Health'
    and resource_name = 'NCMH Crisis Hotline'
);
