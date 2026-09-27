begin;
insert into auth.users(id,email) values
 ('40000000-0000-4000-8000-000000000001','export-a@example.test'),
 ('40000000-0000-4000-8000-000000000002','export-b@example.test');
insert into user_service.profiles(user_id,display_name) values
 ('40000000-0000-4000-8000-000000000001','EXPORT_OWNER_A'),('40000000-0000-4000-8000-000000000002','EXPORT_OWNER_B') on conflict(user_id) do update set display_name=excluded.display_name;
set local role service_role;
do $$ declare request uuid; snapshot jsonb; result text; begin
 snapshot:=user_service.collect_user_export('40000000-0000-4000-8000-000000000001');
 if snapshot::text not like '%EXPORT_OWNER_A%' or snapshot::text like '%EXPORT_OWNER_B%' then raise exception 'Export snapshot crossed ownership'; end if;
 request:=user_service.begin_data_export('40000000-0000-4000-8000-000000000001');
 begin perform user_service.begin_data_export('40000000-0000-4000-8000-000000000001'); raise exception 'Concurrent export admitted';
 exception when raise_exception then if sqlerrm<>'EXPORT_BUSY' then raise; end if; end;
 begin perform user_service.finish_data_export('40000000-0000-4000-8000-000000000002',request,'echo:encrypted:v1:synthetic'); raise exception 'Foreign export finalized';
 exception when raise_exception then if sqlerrm<>'EXPORT_NOT_AVAILABLE' then raise; end if; end;
 begin perform user_service.finish_data_export('40000000-0000-4000-8000-000000000001',request,'plaintext'); raise exception 'Plaintext export persisted';
 exception when check_violation then null; end;
 if exists(select 1 from user_service.export_artifacts where request_id=request) then raise exception 'Failed generation left artifact'; end if;
 perform user_service.finish_data_export('40000000-0000-4000-8000-000000000001',request,'echo:encrypted:v1:synthetic');
 if user_service.consume_data_export('40000000-0000-4000-8000-000000000002',request) is not null then raise exception 'Cross-user download'; end if;
 result:=user_service.consume_data_export('40000000-0000-4000-8000-000000000001',request);
 if result<>'echo:encrypted:v1:synthetic' then raise exception 'Owner download failed'; end if;
 if user_service.consume_data_export('40000000-0000-4000-8000-000000000001',request) is not null then raise exception 'Export replay'; end if;
 if not exists(select 1 from user_service.audit_events where resource_id=request and event_type='privacy.export_downloaded') then raise exception 'Download audit missing'; end if;
end $$;
reset role;
do $$ declare request uuid; begin
 request:=user_service.begin_data_export('40000000-0000-4000-8000-000000000001');
 perform user_service.finish_data_export('40000000-0000-4000-8000-000000000001',request,'echo:encrypted:v1:expired');
 update user_service.export_artifacts set expires_at=now()-interval '1 second' where request_id=request;
 if user_service.consume_data_export('40000000-0000-4000-8000-000000000001',request) is not null then raise exception 'Expired download'; end if;
 if user_service.expire_data_exports()<>1 then raise exception 'Expiry cleanup failed'; end if;
 if exists(select 1 from user_service.export_artifacts where request_id=request) then raise exception 'Expired ciphertext retained'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000001"}',true);
do $$ begin
 begin perform user_service.collect_user_export('40000000-0000-4000-8000-000000000002'); raise exception 'Browser invoked privileged snapshot'; exception when insufficient_privilege then null; end;
 begin perform * from user_service.export_artifacts; raise exception 'Browser read artifact directly'; exception when insufficient_privilege then null; end;
 begin perform user_service.consume_data_export('40000000-0000-4000-8000-000000000001',gen_random_uuid()); raise exception 'Browser bypassed recent authentication'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
