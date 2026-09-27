begin;

create function pg_temp.check_wellness(
  ok boolean,
  label text
)
returns void
language plpgsql
as $$
begin
  if ok is distinct from true then
    raise exception 'ASSERTION FAILED: %', label;
  end if;
end
$$;

insert into auth.users(id, email)
values
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'wellness@example.invalid'
  ),
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'other-wellness@example.invalid'
  );

do $$
declare
  a insights_service.phq8_assessments;
  b insights_service.phq8_assessments;
  jid uuid;
  job uuid;
  img uuid;
  stale_img uuid;
  replacement_img uuid;
  extra_img uuid;
  pending_id uuid;
  path text;
  stale_path text;
begin
  perform pg_temp.check_wellness(
    not has_table_privilege(
      'authenticated',
      'insights_service.phq8_assessments',
      'select'
    ),
    'screening answers are API-only'
  );

  perform pg_temp.check_wellness(
    not has_function_privilege(
      'authenticated',
      'insights_service.save_encrypted_phq8(uuid,uuid,text,integer)',
      'execute'
    ),
    'browser cannot impersonate an assessment owner'
  );

  perform pg_temp.check_wellness(
    not has_table_privilege(
      'authenticated',
      'insights_service.support_prompt_state',
      'update'
    ),
    'browser cannot reset cooldown'
  );

  perform pg_temp.check_wellness(
    not has_table_privilege(
      'authenticated',
      'journal_service.journal_images',
      'select'
    ),
    'private image paths are API-only'
  );

  perform pg_temp.check_wellness(
    (
      select not public
      from storage.buckets
      where id = 'journal-images'
    ),
    'image bucket remains private'
  );

  a := insights_service.save_encrypted_phq8(
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    gen_random_uuid(),
    'echo:encrypted:v1:synthetic-severe',
    7
  );

  perform pg_temp.check_wellness(
    a.score is null and a.severity is null and a.responses is null
    and a.assessment_ciphertext = 'echo:encrypted:v1:synthetic-severe',
    'PHQ-8 sensitive values stored only inside ciphertext'
  );

  b := insights_service.save_encrypted_phq8(
    a.user_id,
    a.submission_id,
    a.assessment_ciphertext,
    7
  );

  perform pg_temp.check_wellness(
    a.id = b.id,
    'same submission replays'
  );

  b := insights_service.save_encrypted_phq8(
    a.user_id,
    gen_random_uuid(),
    'echo:encrypted:v1:synthetic-minimal',
    7
  );

  perform pg_temp.check_wellness(
    a.id = b.id,
    'second tab cannot submit before due'
  );

  update insights_service.phq8_assessments
  set completed_at = now() - interval '3 days'
  where id = a.id;

  b := insights_service.save_encrypted_phq8(
    a.user_id,
    gen_random_uuid(),
    'echo:encrypted:v1:synthetic-minimal',
    3
  );

  perform pg_temp.check_wellness(
    a.id <> b.id
    and b.score is null and b.severity is null and b.responses is null
    and b.assessment_ciphertext = 'echo:encrypted:v1:synthetic-minimal',
    'configured interval and history retained'
  );

  begin
    perform insights_service.save_encrypted_phq8(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      gen_random_uuid(),
      'plaintext-disallowed',
      7
    );

    raise exception 'invalid response unexpectedly accepted';
  exception
    when check_violation then
      null;
  end;

  perform pg_temp.check_wellness(
    not insights_service.claim_support_prompt(
      a.user_id,
      3,
      14,
      7
    ),
    'PHQ-8 severity is separate from journal support threshold'
  );

  for i in 1..3 loop
    select journal_id
    into jid
    from journal_service.submit_journal(
      a.user_id,
      '[encrypted]',
      'cipher',
      'iv',
      'tag',
      1,
      2,
      'sad',
      '[]',
      '[]',
      'private',
      false,
      'saved',
      null,
      'disabled',
      'v1',
      'wellness-' || i,
      'hash-' || i
    );

    job := gen_random_uuid();

    insert into ai_analysis.analysis_requests(
      id,
      request_id,
      user_id,
      source_feature,
      source_record_id,
      analysis_type,
      status,
      journal_id
    )
    values(
      job,
      gen_random_uuid(),
      a.user_id,
      'journal',
      jid,
      'journal_reflection',
      'completed',
      jid
    );

    insert into ai_analysis.analysis_results(analysis_request_id,user_id,severity,summary,is_demo_data,is_simulated,result_payload)
    values(job,a.user_id,'severe','[encrypted]',false,false,'{"ciphertext":"echo:encrypted:v1:synthetic-sql-fixture"}');
  end loop;

  perform pg_temp.check_wellness(
    insights_service.recent_concerning_journals(
      a.user_id,
      14
    ) = 3,
    'three distinct real journals counted'
  );

  perform pg_temp.check_wellness(
    insights_service.claim_support_prompt(
      a.user_id,
      3,
      14,
      7
    ),
    'threshold reached'
  );

  perform pg_temp.check_wellness(
    not insights_service.claim_support_prompt(
      a.user_id,
      3,
      14,
      7
    ),
    'cooldown prevents repeated popup'
  );

  update insights_service.support_prompt_state
  set last_prompted_at =
    now() - interval '7 days'
  where user_id = a.user_id;

  perform pg_temp.check_wellness(
    insights_service.claim_support_prompt(
      a.user_id,
      3,
      14,
      7
    ),
    'exact cooldown boundary allows next suggestion'
  );

  -- Replace the synthetic scenario; real completed results remain immutable.
  with removed as (delete from ai_analysis.analysis_results where analysis_request_id=job returning *)
  insert into ai_analysis.analysis_results select (jsonb_populate_record(null::ai_analysis.analysis_results,to_jsonb(removed)||jsonb_build_object('is_demo_data',true,'is_simulated',true))).* from removed;

  perform pg_temp.check_wellness(
    insights_service.recent_concerning_journals(
      a.user_id,
      14
    ) = 2,
    'simulated output excluded'
  );

  -- Replace the synthetic scenario; real completed results remain immutable.
  with removed as (delete from ai_analysis.analysis_results where analysis_request_id=job returning *)
  insert into ai_analysis.analysis_results select (jsonb_populate_record(null::ai_analysis.analysis_results,to_jsonb(removed)||jsonb_build_object('is_demo_data',false,'is_simulated',false,'urgent_language_detected',true))).* from removed;

  perform pg_temp.check_wellness(
    insights_service.recent_concerning_journals(
      a.user_id,
      14
    ) = 2,
    'urgent safety distinct from repeated severity'
  );

  -- Replace the synthetic scenario; real completed results remain immutable.
  with removed as (delete from ai_analysis.analysis_results where analysis_request_id=job returning *)
  insert into ai_analysis.analysis_results select (jsonb_populate_record(null::ai_analysis.analysis_results,to_jsonb(removed)||jsonb_build_object('urgent_language_detected',false,'created_at',now()-interval '15 days'))).* from removed;

  perform pg_temp.check_wellness(
    insights_service.recent_concerning_journals(
      a.user_id,
      14
    ) = 2,
    'old output excluded'
  );

  perform pg_temp.check_wellness(
    insights_service.recent_concerning_journals(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      14
    ) = 0,
    'owner isolation'
  );

  perform pg_temp.check_wellness(
    not user_service.has_valid_trusted_contact(
      a.user_id
    ),
    'missing contact blocks AI'
  );

  insert into user_service.trusted_contacts(
    user_id,
    contact_name,
    contact_email,
    relationship
  )
  values(
    a.user_id,
    'Friend',
    'friend@example.invalid',
    'Friend'
  );

  perform pg_temp.check_wellness(
    not user_service.has_valid_trusted_contact(
      a.user_id
    ),
    'permission required'
  );

  update user_service.trusted_contacts
  set permission_acknowledged_at = now()
  where user_id = a.user_id;

  perform pg_temp.check_wellness(
    user_service.has_valid_trusted_contact(
      a.user_id
    ),
    'existing settings contact satisfies completeness gate'
  );

  -- Journal image reservation lifecycle.
  img := gen_random_uuid();

  path :=
    journal_service.reserve_journal_image(
      a.user_id,
      jid,
      img,
      'test-hash',
      'image/png'
    );

  perform pg_temp.check_wellness(
    path =
      journal_service.reserve_journal_image(
        a.user_id,
        jid,
        img,
        'test-hash',
        'image/png'
      ),
    'image retry is idempotent'
  );

  -- One completed image permanently occupies one of the five slots.
  update journal_service.journal_images
  set uploaded = true
  where id = img;

  perform pg_temp.check_wellness(
    (
      select
        uploaded = true
        and reservation_expires_at is null
      from journal_service.journal_images
      where id = img
    ),
    'uploaded image permanently occupies a slot'
  );

  -- Add three normal active reservations.
  for i in 1..3 loop
    perform journal_service.reserve_journal_image(
      a.user_id,
      jid,
      gen_random_uuid(),
      'hash-' || i,
      'image/png'
    );
  end loop;

  -- The fifth active slot is a reservation that we will later expire.
  stale_img := gen_random_uuid();

  stale_path :=
    journal_service.reserve_journal_image(
      a.user_id,
      jid,
      stale_img,
      'stale-hash',
      'image/png'
    );

  begin
    perform journal_service.reserve_journal_image(
      a.user_id,
      jid,
      gen_random_uuid(),
      'sixth',
      'image/png'
    );

    raise exception 'sixth image unexpectedly accepted';
  exception
    when others then
      if sqlerrm <> 'IMAGE_LIMIT' then
        raise;
      end if;
  end;

  -- A failed or abandoned pending reservation stops consuming a slot.
  update journal_service.journal_images
  set reservation_expires_at =
    now() - interval '1 second'
  where id = stale_img
    and uploaded = false;

  replacement_img := gen_random_uuid();

  perform journal_service.reserve_journal_image(
    a.user_id,
    jid,
    replacement_img,
    'replacement-hash',
    'image/png'
  );

  perform pg_temp.check_wellness(
    exists(
      select 1
      from journal_service.journal_images
      where id = stale_img
        and uploaded = false
        and reservation_expires_at <= now()
    ),
    'expired failed reservation remains retryable but no longer consumes a slot'
  );

  -- Because the replacement used the newly available slot, the expired photo
  -- cannot reclaim another slot until room exists again.
  begin
    perform journal_service.reserve_journal_image(
      a.user_id,
      jid,
      stale_img,
      'stale-hash',
      'image/png'
    );

    raise exception 'expired reservation exceeded the five-slot limit';
  exception
    when others then
      if sqlerrm <> 'IMAGE_LIMIT' then
        raise;
      end if;
  end;

  -- Release the replacement slot, then prove the original failed photo can
  -- safely reclaim its original reservation and storage path.
  update journal_service.journal_images
  set reservation_expires_at =
    now() - interval '1 second'
  where id = replacement_img
    and uploaded = false;

  perform pg_temp.check_wellness(
    stale_path =
      journal_service.reserve_journal_image(
        a.user_id,
        jid,
        stale_img,
        'stale-hash',
        'image/png'
      ),
    'expired image retry reclaims its original reservation when capacity is available'
  );

  -- Finalize the four currently active pending images. Together with the
  -- already uploaded image, the journal now contains five completed photos.
  for pending_id in
    select id
    from journal_service.journal_images
    where journal_id = jid
      and uploaded = false
      and reservation_expires_at > now()
    order by created_at asc
  loop
    update journal_service.journal_images
    set uploaded = true
    where id = pending_id;
  end loop;

  perform pg_temp.check_wellness(
    (
      select count(*)
      from journal_service.journal_images
      where journal_id = jid
        and uploaded = true
    ) = 5,
    'journal can contain exactly five uploaded images'
  );

  -- Even a manually present expired reservation cannot become a sixth
  -- completed image because finalization has its own hard database guard.
  extra_img := gen_random_uuid();

  insert into journal_service.journal_images(
    id,
    journal_id,
    user_id,
    storage_path,
    content_hash,
    mime_type,
    uploaded,
    reservation_expires_at
  )
  values(
    extra_img,
    jid,
    a.user_id,
    a.user_id::text
      || '/'
      || jid::text
      || '/'
      || extra_img::text,
    'extra-hash',
    'image/png',
    false,
    now() - interval '1 second'
  );

  begin
    update journal_service.journal_images
    set uploaded = true
    where id = extra_img;

    raise exception 'sixth uploaded image unexpectedly accepted';
  exception
    when others then
      if sqlerrm <> 'IMAGE_LIMIT' then
        raise;
      end if;
  end;

  perform pg_temp.check_wellness(
    (
      select uploaded = false
      from journal_service.journal_images
      where id = extra_img
    ),
    'hard upload limit leaves the sixth reservation unattached'
  );

  begin
    perform journal_service.reserve_journal_image(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      jid,
      gen_random_uuid(),
      'foreign',
      'image/png'
    );

    raise exception 'foreign journal unexpectedly accepted';
  exception
    when others then
      if sqlerrm <> 'JOURNAL_NOT_FOUND' then
        raise;
      end if;
  end;

  update journal_service.journals
  set deleted_at = now()
  where id = jid;

  perform pg_temp.check_wellness(
    not exists(
      select 1
      from journal_service.journal_images
      where journal_id = jid
    ),
    'deleted journals lose image associations'
  );

  perform pg_temp.check_wellness(
    exists(
      select 1
      from journal_service.image_deletion_queue
      where storage_path = path
    ),
    'physical deletion is durably queued'
  );
end;
$$;

rollback;