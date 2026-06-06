create extension if not exists "uuid-ossp";

create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text default '',
  health text default 'idle' check (health in ('on-track','blocked','needs-attention','idle')),
  stack text[] default '{}',
  repo_url text default '',
  github_repo text default '',
  sprint_goal text default '',
  sprint_end date,
  token_budget_k integer default 300,
  agent_assigned text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  description text default '',
  status text default 'backlog' check (status in ('backlog','ready','in-progress','blocked','done')),
  priority text default 'medium' check (priority in ('low','medium','high','critical')),
  assigned_agent text default '',
  estimated_tokens_k integer default 0,
  session_window integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.bugs (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  description text default '',
  status text default 'open' check (status in ('open','in-progress','resolved')),
  severity text default 'medium' check (severity in ('low','medium','high','critical')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.obstacles (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  description text not null,
  options text[] default '{}',
  recommendation text default '',
  workaround text default '',
  status text default 'open' check (status in ('open','assumed','cleared')),
  needs_human boolean default true,
  urgency text default 'medium' check (urgency in ('low','medium','high')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.session_logs (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  agent_id text not null,
  tasks_completed text[] default '{}',
  tasks_partial text[] default '{}',
  bugs_logged text[] default '{}',
  obstacles_logged text[] default '{}',
  tokens_used_k numeric default 0,
  notes text default '',
  session_date date default current_date,
  created_at timestamptz default now()
);

create table public.decisions (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  rationale text default '',
  created_at timestamptz default now()
);

create table public.agents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  agent_key text not null,
  name text not null,
  domain text default '',
  account_email text default '',
  color text default '#58A6FF',
  session_budget_k integer default 300,
  created_at timestamptz default now()
);

create table public.session_queues (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  agent_id uuid references public.agents(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete set null,
  tasks text[] default '{}',
  notes text default '',
  updated_at timestamptz default now(),
  unique(agent_id)
);

create table public.dev_plans (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  overview text default '',
  status text default 'draft' check (status in ('draft','active','completed','archived')),
  total_sessions_estimated integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.dev_plan_tasks (
  id uuid primary key default uuid_generate_v4(),
  dev_plan_id uuid references public.dev_plans(id) on delete cascade not null,
  title text not null,
  description text default '',
  acceptance_criteria text[] default '{}',
  depends_on uuid[] default '{}',
  assigned_agent text default '',
  estimated_tokens_k integer default 0,
  session_window integer default 1,
  status text default 'pending' check (status in ('pending','in-progress','blocked','done','skipped')),
  position integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at before update on public.projects for each row execute function public.handle_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function public.handle_updated_at();
create trigger bugs_updated_at before update on public.bugs for each row execute function public.handle_updated_at();
create trigger obstacles_updated_at before update on public.obstacles for each row execute function public.handle_updated_at();
create trigger session_queues_updated_at before update on public.session_queues for each row execute function public.handle_updated_at();
create trigger dev_plans_updated_at before update on public.dev_plans for each row execute function public.handle_updated_at();
create trigger dev_plan_tasks_updated_at before update on public.dev_plan_tasks for each row execute function public.handle_updated_at();
