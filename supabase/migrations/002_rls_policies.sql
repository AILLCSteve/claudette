alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.bugs enable row level security;
alter table public.obstacles enable row level security;
alter table public.session_logs enable row level security;
alter table public.decisions enable row level security;
alter table public.agents enable row level security;
alter table public.session_queues enable row level security;
alter table public.dev_plans enable row level security;
alter table public.dev_plan_tasks enable row level security;

create policy "users_own_projects" on public.projects for all using (auth.uid() = user_id);

create policy "tasks_via_project" on public.tasks for all using (
  project_id in (select id from public.projects where user_id = auth.uid())
);

create policy "bugs_via_project" on public.bugs for all using (
  project_id in (select id from public.projects where user_id = auth.uid())
);

create policy "obstacles_via_project" on public.obstacles for all using (
  project_id in (select id from public.projects where user_id = auth.uid())
);

create policy "session_logs_via_project" on public.session_logs for all using (
  project_id in (select id from public.projects where user_id = auth.uid())
);

create policy "decisions_via_project" on public.decisions for all using (
  project_id in (select id from public.projects where user_id = auth.uid())
);

create policy "users_own_agents" on public.agents for all using (auth.uid() = user_id);

create policy "users_own_queues" on public.session_queues for all using (auth.uid() = user_id);

create policy "dev_plans_via_project" on public.dev_plans for all using (
  project_id in (select id from public.projects where user_id = auth.uid())
);

create policy "dev_plan_tasks_via_plan" on public.dev_plan_tasks for all using (
  dev_plan_id in (
    select dp.id from public.dev_plans dp
    join public.projects p on dp.project_id = p.id
    where p.user_id = auth.uid()
  )
);
