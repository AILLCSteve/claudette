alter table public.projects
  add column if not exists local_path text default '',
  add column if not exists marker_synced_at timestamptz;
