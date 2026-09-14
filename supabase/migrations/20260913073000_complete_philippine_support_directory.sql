-- Complete the reviewed Philippine support directory with additional
-- numbers confirmed from current government sources.
--
-- This migration intentionally adds new records instead of modifying the
-- historical 20260912013000_reviewed_philippine_support_resources.sql file.
--
-- Verified: 2026-09-13.

-- NCMH toll-free crisis hotline.
insert into grounding_service.support_resources (
  country_code,
  support_resource_type,
  organization_name,
  resource_name,
  phone_number,
  availability_text,
  website_url,
  verification_source,
  is_active,
  is_verified,
  last_verified_at,
  display_priority
)
select
  'PH',
  'crisis_hotline',
  'NCMH',
  'NCMH Crisis Hotline - Toll Free',
  '1800-1888-1553',
  '24-hour crisis support; network access may vary.',
  'https://ncmh.gov.ph/',
  'https://quezoncity.gov.ph/national-suicide-prevention-week-4/',
  true,
  true,
  '2026-09-13T00:00:00Z',
  5
where not exists (
  select 1
  from grounding_service.support_resources
  where country_code = 'PH'
    and support_resource_type = 'crisis_hotline'
    and phone_number = '1800-1888-1553'
);

-- Hopeline short code for Globe/TM subscribers.
insert into grounding_service.support_resources (
  country_code,
  support_resource_type,
  organization_name,
  resource_name,
  phone_number,
  availability_text,
  website_url,
  verification_source,
  is_active,
  is_verified,
  last_verified_at,
  display_priority
)
select
  'PH',
  'crisis_hotline',
  'Hopeline PH',
  'Hopeline PH - Globe/TM',
  '2919',
  'Crisis support; current operating hours not independently confirmed.',
  'https://quezoncity.gov.ph/national-suicide-prevention-week-4/',
  'https://quezoncity.gov.ph/national-suicide-prevention-week-4/',
  true,
  true,
  '2026-09-13T00:00:00Z',
  12
where not exists (
  select 1
  from grounding_service.support_resources
  where country_code = 'PH'
    and support_resource_type = 'crisis_hotline'
    and phone_number = '2919'
);

-- Additional official Cavite Center for Mental Health contact.
insert into grounding_service.support_resources (
  country_code,
  support_resource_type,
  organization_name,
  resource_name,
  phone_number,
  availability_text,
  website_url,
  verification_source,
  is_active,
  is_verified,
  last_verified_at,
  display_priority
)
select
  'PH',
  'clinic',
  'Cavite Center for Mental Health',
  'Cavite Center for Mental Health - Admin',
  '+63464190125',
  'Administrative contact; operating hours not independently confirmed.',
  'https://cavite.gov.ph/directory/',
  'https://cavite.gov.ph/directory/',
  true,
  true,
  '2026-09-13T00:00:00Z',
  21
where not exists (
  select 1
  from grounding_service.support_resources
  where country_code = 'PH'
    and support_resource_type = 'clinic'
    and phone_number = '+63464190125'
);

-- Unified nationwide emergency hotline.
insert into grounding_service.support_resources (
  country_code,
  support_resource_type,
  organization_name,
  resource_name,
  phone_number,
  availability_text,
  website_url,
  verification_source,
  is_active,
  is_verified,
  last_verified_at,
  display_priority
)
select
  'PH',
  'emergency',
  'Department of the Interior and Local Government',
  'Unified 911 Emergency Hotline',
  '911',
  'Free nationwide emergency hotline available 24 hours a day.',
  'https://calabarzon.dilg.gov.ph/one-number-for-all-emergencies-unified-911-to-launch-nationwide/',
  'https://calabarzon.dilg.gov.ph/one-number-for-all-emergencies-unified-911-to-launch-nationwide/',
  true,
  true,
  '2026-09-13T00:00:00Z',
  1
where not exists (
  select 1
  from grounding_service.support_resources
  where country_code = 'PH'
    and support_resource_type = 'emergency'
    and phone_number = '911'
);