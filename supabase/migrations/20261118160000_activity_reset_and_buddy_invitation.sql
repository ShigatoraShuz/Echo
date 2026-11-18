begin;

create table user_service.activity_reset_receipts (
 request_id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 image_paths jsonb not null default '[]', completed boolean not null default false, created_at timestamptz not null default now()
);
alter table user_service.activity_reset_receipts enable row level security;
grant select,insert,update,delete on user_service.activity_reset_receipts to service_role;
create table insights_service.buddy_invitation_state (
 user_id uuid primary key references auth.users(id) on delete cascade, last_shown_at timestamptz not null
);
alter table insights_service.buddy_invitation_state enable row level security;
grant select,insert,update,delete on insights_service.buddy_invitation_state to service_role;

create function notification_service.record_activity_notice(p_user_id uuid,p_type text,p_journal_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 if p_type not in ('analysis_completed','analysis_failed') then raise exception 'INVALID_NOTIFICATION_TYPE'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('echo:notice:'||p_user_id::text||p_type||p_journal_id::text,0));
 if not exists(select 1 from journal_service.journals where id=p_journal_id and user_id=p_user_id and deleted_at is null) or
 not exists(select 1 from user_service.notification_preferences where user_id=p_user_id and in_app_enabled and insight_notifications_enabled) then return false; end if;
 if exists(select 1 from notification_service.notifications where user_id=p_user_id and notification_type=p_type and resource_type='journal' and resource_id=p_journal_id) then return false; end if;
 insert into notification_service.notifications(user_id,notification_type,title,message,resource_type,resource_id)
 values(p_user_id,p_type,case when p_type='analysis_completed' then 'Journal analysis ready' else 'Journal analysis needs attention' end,
 case when p_type='analysis_completed' then 'Your private journal analysis is ready to view.' else 'Your reflection is saved. Open it to review the analysis status and retry.' end,'journal',p_journal_id);
 return true;
end $$;

create function insights_service.claim_buddy_invitation(p_user_id uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare claimed uuid; preference record; local_time time;
begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 if not exists(select 1 from user_service.notification_preferences n join user_service.privacy_preferences p using(user_id)
 where n.user_id=p_user_id and n.in_app_enabled and n.insight_notifications_enabled and p.journal_ai_analysis_enabled) then return false; end if;
 select n.quiet_hours_start,n.quiet_hours_end,coalesce(n.reminder_timezone,p.timezone,'UTC') as zone into preference
 from user_service.notification_preferences n join user_service.profiles p using(user_id) where n.user_id=p_user_id;
 if preference.quiet_hours_start is not null then
  local_time:=(now() at time zone preference.zone)::time;
  if (case when preference.quiet_hours_start<preference.quiet_hours_end then local_time>=preference.quiet_hours_start and local_time<preference.quiet_hours_end
   else local_time>=preference.quiet_hours_start or local_time<preference.quiet_hours_end end) then return false; end if;
 end if;
 insert into insights_service.buddy_invitation_state(user_id,last_shown_at) values(p_user_id,now())
 on conflict(user_id) do update set last_shown_at=excluded.last_shown_at
 where buddy_invitation_state.last_shown_at<now()-interval '7 days' returning user_id into claimed;
 if claimed is null then return false; end if;
 insert into notification_service.notifications(user_id,notification_type,title,message,resource_type)
 values(p_user_id,'buddy_invitation','A moment for yourself','Buddy and grounding exercises are here whenever you would like a gentle pause.','buddy');
 return true;
end $$;

grant select,delete on professional_service.support_requests to service_role;
grant select,update on professional_service.appointments,professional_service.case_shared_records to service_role;

create function user_service.reset_account_activity(p_user_id uuid,p_request_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare previous user_service.activity_reset_receipts; images jsonb; target text; relation regclass;
begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 if p_user_id is null or p_request_id is null then raise exception 'RESET_OWNER_REQUIRED'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('echo:activity-reset:'||p_user_id::text,0));
 select * into previous from user_service.activity_reset_receipts where request_id=p_request_id;
 if found then
  if previous.user_id<>p_user_id then raise exception 'RESET_CONFLICT'; end if;
  return jsonb_build_object('imagePaths',previous.image_paths,'completed',previous.completed,'requestId',previous.request_id);
 end if;
 select * into previous from user_service.activity_reset_receipts where user_id=p_user_id and not completed order by created_at limit 1;
 if found then return jsonb_build_object('imagePaths',previous.image_paths,'completed',false,'requestId',previous.request_id); end if;
 if not exists(select 1 from user_service.profiles where user_id=p_user_id and account_status='active') then raise exception 'RESET_ACCOUNT_UNAVAILABLE'; end if;
 select coalesce(jsonb_agg(distinct storage_path),'[]') into images from (
 select storage_path from journal_service.journal_images where user_id=p_user_id
 union select storage_path from journal_service.journal_draft_images where user_id=p_user_id
 union select storage_path from journal_service.image_deletion_queue where storage_path like p_user_id::text||'/%') paths;
 insert into user_service.activity_reset_receipts(request_id,user_id,image_paths) values(p_request_id,p_user_id,images);
 -- Revoke shared access and cancel appointments before clearing patient-owned cases.
 update professional_service.appointments set status='canceled',updated_at=now() where status in ('proposed','confirmed') and request_id in
 (select id from professional_service.support_requests where user_id=p_user_id);
 update professional_service.case_shared_records set revoked_at=coalesce(revoked_at,now()),revoked_by=p_user_id where owner_user_id=p_user_id and revoked_at is null;
 delete from professional_service.support_requests where user_id=p_user_id;
 delete from notification_service.notification_logs where notification_id in (select id from notification_service.notifications where user_id=p_user_id);
 -- Fixed list: profile, verification, consent, contacts, preferences and security audit records are retained.
 foreach target in array array[
 'notification_service.support_contact_requests','notification_service.notifications',
 'buddy_service.recommendation_handoffs','buddy_service.buddy_feedback','buddy_service.conversation_search_tokens','buddy_service.buddy_messages','buddy_service.buddy_conversations',
 'ai_analysis.owner_continuations','ai_analysis.recommendation_selections','ai_analysis.risk_signal_snapshots',
 'ai_analysis.journal_face_results','ai_analysis.safety_events','ai_analysis.analysis_requests','ai_analysis.idempotency_records',
 'journal_service.journal_analyses','journal_service.journal_images','journal_service.journal_draft_images','journal_service.journal_drafts','journal_service.journals',
 'grounding_service.grounding_sessions','grounding_service.breathing_sessions',
 'insights_service.phq8_assessments','insights_service.mood_entries','insights_service.insight_snapshots','insights_service.weekly_analysis_metrics','insights_service.support_prompt_state','insights_service.buddy_invitation_state',
 'user_service.daily_distress_checkins','user_service.calendar_items','user_service.data_export_requests',
 'public.analysis_feedback','public.analysis_status_projection','public.safety_events','public.journal_analyses','public.journal_drafts','public.journals',
 'public.buddy_messages','public.buddy_conversations','public.grounding_sessions','public.mood_entries','public.notifications','public.data_export_requests','public.export_requests'] loop
  relation:=pg_catalog.to_regclass(target);
  if relation is not null then execute format('delete from %s where user_id=$1',relation) using p_user_id; end if;
 end loop;
 insert into journal_service.image_deletion_queue(storage_path) select jsonb_array_elements_text(images) on conflict do nothing;
 insert into user_service.audit_events(user_id,actor_user_id,event_type,resource_type,resource_id,metadata)
 values(p_user_id,p_user_id,'settings.activity_reset','activity_reset',p_request_id,'{}');
 return jsonb_build_object('imagePaths',images,'completed',false,'requestId',p_request_id);
end $$;

create function user_service.guard_activity_reset() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('echo:activity-reset:'||new.user_id::text,0));
 if exists(select 1 from user_service.activity_reset_receipts where user_id=new.user_id and not completed) then raise exception 'ACTIVITY_RESET_PENDING'; end if;
 return new;
end $$;
revoke all on function user_service.guard_activity_reset() from public,anon,authenticated;
do $$ declare target text; begin
 foreach target in array array['journal_service.journals','journal_service.journal_drafts','journal_service.journal_images','journal_service.journal_draft_images',
 'buddy_service.buddy_conversations','buddy_service.buddy_messages','insights_service.phq8_assessments','insights_service.mood_entries',
 'grounding_service.grounding_sessions','grounding_service.breathing_sessions','user_service.calendar_items'] loop
 execute format('create trigger activity_reset_guard before insert or update on %s for each row execute function user_service.guard_activity_reset()',target);
 end loop;
end $$;

-- Only the backend service role can perform the explicit activity cleanup.
do $$ declare target text; begin
 foreach target in array array[
 'notification_service.support_contact_requests','notification_service.notifications',
 'buddy_service.recommendation_handoffs','buddy_service.buddy_feedback','buddy_service.conversation_search_tokens','buddy_service.buddy_messages','buddy_service.buddy_conversations',
 'ai_analysis.owner_continuations','ai_analysis.recommendation_selections','ai_analysis.risk_signal_snapshots',
 'ai_analysis.journal_face_results','ai_analysis.safety_events','ai_analysis.analysis_requests','ai_analysis.idempotency_records',
 'journal_service.journal_analyses','journal_service.journal_images','journal_service.journal_draft_images','journal_service.journal_drafts','journal_service.journals',
 'grounding_service.grounding_sessions','grounding_service.breathing_sessions',
 'insights_service.phq8_assessments','insights_service.mood_entries','insights_service.insight_snapshots','insights_service.weekly_analysis_metrics','insights_service.support_prompt_state','insights_service.buddy_invitation_state',
 'user_service.daily_distress_checkins','user_service.calendar_items','user_service.data_export_requests',
 'public.analysis_feedback','public.analysis_status_projection','public.safety_events','public.journal_analyses','public.journal_drafts','public.journals',
 'public.buddy_messages','public.buddy_conversations','public.grounding_sessions','public.mood_entries','public.notifications','public.data_export_requests','public.export_requests'] loop
  if pg_catalog.to_regclass(target) is not null then execute format('grant select,delete on %s to service_role',target); end if;
 end loop;
end $$;

revoke all on function notification_service.record_activity_notice(uuid,text,uuid),insights_service.claim_buddy_invitation(uuid),user_service.reset_account_activity(uuid,uuid) from public,anon,authenticated;
grant execute on function notification_service.record_activity_notice(uuid,text,uuid),insights_service.claim_buddy_invitation(uuid),user_service.reset_account_activity(uuid,uuid) to service_role;
commit;
