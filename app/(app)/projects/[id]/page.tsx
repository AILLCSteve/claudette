import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { HealthBadge } from '@/components/portfolio/health-badge'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MarkerFilePanel } from '@/components/projects/marker-file-panel'
import { GeneratePlanPanel } from '@/components/projects/generate-plan-panel'
import { notFound } from 'next/navigation'
import type { Health } from '@/types'

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: project, error } = await supabase
    .from('projects')
    .select('*, tasks(*), bugs(*), obstacles(*), session_logs(*), decisions(*), dev_plans(*, dev_plan_tasks(*))')
    .eq('id', params.id)
    .single()

  if (error || !project) notFound()

  const tasks = project.tasks ?? []
  const bugs = project.bugs ?? []
  const obstacles = project.obstacles ?? []
  const devPlans = project.dev_plans ?? []

  const doneTasks = tasks.filter((t: any) => t.status === 'done').length
  const openBugs = bugs.filter((b: any) => b.status !== 'resolved').length
  const decisionsNeeded = obstacles.filter((o: any) => o.status === 'open' && o.needs_human).length

  const statusOrder = ['in-progress', 'ready', 'blocked', 'backlog', 'done']

  return (
    <div className="flex flex-col h-full">
      <Header title={project.name} />
      <div className="flex-1 overflow-auto p-6">
        {/* Project header */}
        <div className="flex items-start justify-between mb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{project.name}</h1>
              <HealthBadge health={project.health as Health} />
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground max-w-lg">{project.description}</p>
            )}
            {project.sprint_goal && (
              <p className="text-xs text-muted-foreground/70 italic">&ldquo;{project.sprint_goal}&rdquo;</p>
            )}
            {project.local_path && (
              <p className="text-xs text-muted-foreground font-mono">{project.local_path}</p>
            )}
            {project.stack?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {project.stack.map((s: string) => (
                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Tasks Done', value: `${doneTasks}/${tasks.length}` },
              { label: 'Open Bugs', value: openBugs },
              { label: 'Decisions', value: decisionsNeeded },
            ].map(stat => (
              <div key={stat.label} className="border border-border rounded p-2 min-w-[70px]">
                <p className="text-lg font-semibold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <Tabs defaultValue="plans">
          <TabsList>
            <TabsTrigger value="plans">
              Dev Plans {devPlans.length > 0 && `(${devPlans.length})`}
            </TabsTrigger>
            <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
            <TabsTrigger value="bugs">Bugs ({openBugs})</TabsTrigger>
            <TabsTrigger value="obstacles">Obstacles</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="marker">.claudepm</TabsTrigger>
          </TabsList>

          {/* Dev Plans — primary tab */}
          <TabsContent value="plans" className="mt-4">
            <GeneratePlanPanel projectId={project.id} initialPlans={devPlans} />
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <div className="space-y-1.5">
              {tasks.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No tasks yet — generate a dev plan to create them automatically.
                </p>
              )}
              {statusOrder.map(status => {
                const group = tasks.filter((t: any) => t.status === status)
                if (!group.length) return null
                const labelMap: Record<string, string> = {
                  'in-progress': 'In Progress', ready: 'Ready', blocked: 'Blocked',
                  backlog: 'Backlog', done: 'Done',
                }
                return (
                  <div key={status} className="mb-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                      {labelMap[status]} ({group.length})
                    </p>
                    {group.map((task: any) => (
                      <div key={task.id} className="flex items-center justify-between border border-border/60 rounded px-3 py-2 text-sm bg-card mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="text-xs font-mono shrink-0">{task.status}</Badge>
                          <span className="truncate">{task.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {task.assigned_agent && (
                            <Badge variant="outline" className="text-xs text-violet-400 border-violet-500/30">
                              {task.assigned_agent}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">{task.priority}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="bugs" className="mt-4">
            <div className="space-y-1.5">
              {bugs.length === 0 && <p className="text-sm text-muted-foreground">No bugs.</p>}
              {bugs.map((bug: any) => (
                <div key={bug.id} className="flex items-center justify-between border border-border/60 rounded px-3 py-2 text-sm bg-card">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${bug.severity === 'critical' ? 'border-red-500/50 text-red-400' : ''}`}
                    >
                      {bug.severity}
                    </Badge>
                    <span>{bug.title}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{bug.status}</Badge>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="obstacles" className="mt-4">
            <div className="space-y-2">
              {obstacles.length === 0 && <p className="text-sm text-muted-foreground">No obstacles.</p>}
              {obstacles.map((o: any) => (
                <div key={o.id} className="border border-border/60 rounded p-3 text-sm bg-card space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{o.urgency}</Badge>
                    <Badge variant="outline" className="text-xs">{o.status}</Badge>
                    {o.needs_human && (
                      <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-400">needs human</Badge>
                    )}
                  </div>
                  <p className="font-medium">{o.description}</p>
                  {o.recommendation && (
                    <p className="text-xs text-muted-foreground">Rec: {o.recommendation}</p>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sessions" className="mt-4">
            <div className="space-y-2">
              {(project.session_logs ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No sessions logged.</p>
              )}
              {(project.session_logs ?? []).map((log: any) => (
                <div key={log.id} className="border border-border/60 rounded p-3 text-sm bg-card space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{log.agent_id} — {log.session_date}</span>
                    <span className="text-xs text-muted-foreground">{log.tokens_used_k}K tokens</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Done: {(log.tasks_completed ?? []).join(', ') || 'none'}
                  </p>
                  {log.notes && <p className="text-xs text-muted-foreground">{log.notes}</p>}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="marker" className="mt-4">
            <MarkerFilePanel project={project} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
