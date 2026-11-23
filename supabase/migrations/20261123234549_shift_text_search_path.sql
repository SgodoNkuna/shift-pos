-- Pin the helper's search path (security advisor).
alter function private.shift_text(public.shifts) set search_path = '';
