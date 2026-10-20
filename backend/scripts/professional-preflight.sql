-- Read-only prerequisite report. Requires the original Professional Portal schema.
-- Run on disposable staging first; remote execution requires separate owner approval.
begin transaction read only;
select jsonb_build_object(
  'activeClinicalMemberships',(select count(*) from professional_service.memberships where status='active' and role in ('counselor','psychologist','social_worker')),
  'activeClinicalWithoutCredentialLink',(select count(*) from professional_service.memberships m where status='active' and role in ('counselor','psychologist','social_worker') and to_jsonb(m)->>'approved_credential_id' is null),
  'pendingClinicalMemberships',(select count(*) from professional_service.memberships where status='pending' and role in ('counselor','psychologist','social_worker')),
  'nonfiniteAppointments',(select count(*) from professional_service.appointments where not isfinite(starts_at) or not isfinite(ends_at)),
  'overlappingActiveAppointments',(select count(*) from professional_service.appointments a join professional_service.appointments b
    on a.id<b.id and a.professional_user_id=b.professional_user_id and a.starts_at<b.ends_at and b.starts_at<a.ends_at
    where a.status in ('proposed','confirmed') and b.status in ('proposed','confirmed')),
  'invalidAssignmentStates',(select count(*) from professional_service.support_requests where (status in ('assigned','scheduled') and assigned_to is null) or (status='submitted' and assigned_to is not null)),
  'tablesWithoutRls',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='professional_service' and c.relkind='r' and not c.relrowsecurity),
  'browserSchemaAccess',(select count(*) from (values ('anon'),('authenticated')) roles(name) where has_schema_privilege(roles.name,'professional_service','USAGE')),
  'browserTablePrivileges',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join (values ('anon'),('authenticated')) roles(name)
    where n.nspname='professional_service' and c.relkind='r' and has_table_privilege(roles.name,c.oid,'SELECT,INSERT,UPDATE,DELETE')),
  'browserFunctionPrivileges',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join (values ('anon'),('authenticated')) roles(name)
    where n.nspname='professional_service' and has_function_privilege(roles.name,p.oid,'EXECUTE')),
  'btreeGistInstalled',exists(select 1 from pg_extension where extname='btree_gist'),
  'appointmentExclusionValidated',exists(select 1 from pg_constraint where conrelid='professional_service.appointments'::regclass and conname='professional_appointment_no_overlap' and contype='x' and convalidated),
  'caseSnapshotAvailable',to_regprocedure('professional_service.case_snapshot(uuid,uuid)') is not null,
  'followUpsAvailable',to_regprocedure('professional_service.create_follow_up(uuid,uuid,text,timestamptz,uuid)') is not null,
  'eventProcessingAvailable',to_regprocedure('professional_service.process_events(integer)') is not null,
  'eventHealthAvailable',to_regprocedure('professional_service.event_health()') is not null
) as report;
commit;
