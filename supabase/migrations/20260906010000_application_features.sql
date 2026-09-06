-- Forward-only feature data, isolated to its owning service.
create table public.phq8_assessments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 answers integer[] not null check (cardinality(answers)=8 and array_ndims(answers)=1 and array_lower(answers,1)=1 and array_position(answers,null) is null and answers <@ array[0,1,2,3]),
 score integer not null check (score between 0 and 24),
 severity text not null check (severity in ('minimal','mild','moderate','moderately_severe','severe')),
 completed_at timestamptz not null default now(),
 check (score = answers[1]+answers[2]+answers[3]+answers[4]+answers[5]+answers[6]+answers[7]+answers[8])
);
create index phq8_user_history on public.phq8_assessments(user_id, completed_at desc);
alter table public.phq8_assessments enable row level security;
revoke all on public.phq8_assessments from public, anon, authenticated;
alter table public.phq8_assessments owner to assessment_service_role;

create table public.journal_attachments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 journal_id uuid references public.journals(id) on delete cascade,
 draft_id uuid references public.journal_drafts(id) on delete cascade,
 storage_path text not null unique,
 mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
 size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
 display_order bigint not null default 0,
 created_at timestamptz not null default now(),
 check (num_nonnulls(journal_id,draft_id)=1)
);
create index journal_attachment_history on public.journal_attachments(user_id,journal_id,display_order);
create index journal_attachment_drafts on public.journal_attachments(user_id,draft_id,display_order);
alter table public.journal_attachments enable row level security;
revoke all on public.journal_attachments from public, anon, authenticated;
alter table public.journal_attachments owner to journal_service_role;
-- Keep a durable idempotency key for finalization retries.
alter table public.journals add column source_draft_id uuid unique;
create function public.finalize_journal_draft(p_user_id uuid, p_draft_id uuid, p_word_count integer)
returns setof public.journals language plpgsql security invoker set search_path = '' as $$
declare d public.journal_drafts; j public.journals;
begin
 select * into d from public.journal_drafts where id=p_draft_id and user_id=p_user_id for update;
 if not found then
  return query select * from public.journals where source_draft_id=p_draft_id and user_id=p_user_id;
  return;
 end if;
 insert into public.journals(user_id,source_draft_id,title,content,content_ciphertext,encryption_iv,encryption_auth_tag,encryption_key_version,word_count,mood,emotions,tags,privacy_status,analysis_consent)
 values(p_user_id,d.id,null,null,d.content_ciphertext,d.encryption_iv,d.encryption_auth_tag,d.encryption_key_version,p_word_count,d.mood,to_jsonb(d.emotions),to_jsonb(d.tags),d.privacy_status,d.analysis_consent) returning * into j;
 update public.journal_attachments set journal_id=j.id,draft_id=null where draft_id=d.id and user_id=p_user_id;
 delete from public.journal_drafts where id=d.id and user_id=p_user_id;
 return next j;
end $$;
revoke all on function public.finalize_journal_draft(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.finalize_journal_draft(uuid,uuid,integer) to journal_service_role;

do $$ begin
 if not exists(select 1 from pg_roles where rolname='journal_storage_role') then
  create role journal_storage_role nologin noinherit nobypassrls;
 end if;
 grant journal_storage_role to authenticator;
end $$;
alter role journal_storage_role nobypassrls;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('journal-images','journal-images',false,5242880,array['image/jpeg','image/png','image/webp']);
grant usage on schema storage to journal_storage_role;
grant select on storage.buckets to journal_storage_role;
grant select,insert,delete on storage.objects to journal_storage_role;
create policy journal_storage_bucket on storage.buckets for select to journal_storage_role using(id='journal-images');
create policy journal_storage_read on storage.objects for select to journal_storage_role using(bucket_id='journal-images');
create policy journal_storage_insert on storage.objects for insert to journal_storage_role with check(bucket_id='journal-images');
create policy journal_storage_delete on storage.objects for delete to journal_storage_role using(bucket_id='journal-images');

-- A metadata row may never associate one user's bytes with another user's page.
create function public.check_journal_attachment_owner() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.journal_id is not null and not exists(select 1 from public.journals where id=new.journal_id and user_id=new.user_id) then
  raise exception 'Attachment journal owner mismatch' using errcode='23514';
 end if;
 if new.draft_id is not null and not exists(select 1 from public.journal_drafts where id=new.draft_id and user_id=new.user_id) then
  raise exception 'Attachment draft owner mismatch' using errcode='23514';
 end if;
 if new.storage_path not like new.user_id::text || '/%' then
  raise exception 'Attachment storage owner mismatch' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.check_journal_attachment_owner() from public,anon,authenticated;
grant execute on function public.check_journal_attachment_owner() to journal_service_role;
create trigger journal_attachment_owner before insert or update on public.journal_attachments for each row execute function public.check_journal_attachment_owner();
