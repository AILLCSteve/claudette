-- API tokens for Claude Code agent authentication
create table if not exists public.api_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  name        text not null,
  token       text unique not null,
  last_used_at timestamptz,
  created_at  timestamptz default now()
);

alter table public.api_tokens enable row level security;

create policy "Users manage own tokens"
  on public.api_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast token lookup (the hot path on every API call)
create index if not exists api_tokens_token_idx on public.api_tokens(token);
