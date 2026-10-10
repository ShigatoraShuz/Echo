-- The original NCMH seed used a directory name where an official URL was required.
-- Correct only that seed's matching rows; preserve all other reviewed resources.
update public.support_resources
set verification_source = 'https://pia.gov.ph/news/luzon/doh-mental-health-programs-crisis-hotlines-available-this-undas/',
    last_verified_at = '2026-09-29T00:00:00Z'
where country_code = 'PH'
  and support_resource_type = 'crisis_hotline'
  and phone_number = '1800-1888-1553'
  and verification_source = 'OpenAI Hotline Directory';

update grounding_service.support_resources
set verification_source = 'https://pia.gov.ph/news/luzon/doh-mental-health-programs-crisis-hotlines-available-this-undas/',
    source_url = 'https://pia.gov.ph/news/luzon/doh-mental-health-programs-crisis-hotlines-available-this-undas/',
    last_verified_at = '2026-09-29T00:00:00Z'
where country_code = 'PH'
  and support_resource_type = 'crisis_hotline'
  and phone_number = '1800-1888-1553'
  and verification_source = 'OpenAI Hotline Directory';

-- Keep the short code in the public directory even when older seed migrations
-- were not applied to the connected database.
insert into grounding_service.support_resources (
  country_code, support_resource_type, organization_name, resource_name,
  description, phone_number, call_uri, availability_text, website_url,
  verification_source, source_url, is_active, is_verified,
  last_verified_at, display_priority
)
select
  'PH', 'crisis_hotline', 'National Center for Mental Health', 'NCMH Crisis Hotline (1553)',
  'Compassionate phone support for people in the Philippines experiencing emotional distress.',
  '1553', 'tel:1553', '24 hours a day, 7 days a week; network access may vary.',
  null,
  'https://pia.gov.ph/news/luzon/doh-mental-health-programs-crisis-hotlines-available-this-undas/',
  'https://pia.gov.ph/news/luzon/doh-mental-health-programs-crisis-hotlines-available-this-undas/',
  true, true, '2026-09-29T00:00:00Z', 1
where not exists (
  select 1 from grounding_service.support_resources
  where country_code = 'PH' and support_resource_type = 'crisis_hotline'
    and phone_number = '1553'
);
