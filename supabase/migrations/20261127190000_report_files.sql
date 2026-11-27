-- Report files (PDF + spreadsheet) kept online, so a phone that cannot save or share files can send a link instead.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reports', 'reports', false, 5242880, array['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;
create policy reports_read on storage.objects for select to authenticated using (bucket_id = 'reports' and private.my_staff_id() is not null);
create policy reports_add on storage.objects for insert to authenticated with check (bucket_id = 'reports' and private.my_staff_id() is not null);
create policy reports_replace on storage.objects for update to authenticated using (bucket_id = 'reports' and private.my_staff_id() is not null) with check (bucket_id = 'reports' and private.my_staff_id() is not null);
