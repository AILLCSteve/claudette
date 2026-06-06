import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { ProjectCard } from '@/components/portfolio/project-card'
import { Button } from '@/components/ui/button'
import { Plus, Sparkles, Bug, AlertTriangle, CheckSquare } from 'lucide-react'
import Link from 'next/link'

export default async function PortfolioPage() {
  const supabase = await createClient()

  const [projectsRes, tasksRes, bugsRes, obstaclesRes] = await Promise.all([
    supabase.from('projects').select('*').order('updated_at', { ascending: false }),
    supabase.from('tasks').select('*'),
    supabase.from('bugs').select('*'),
    supabase.from('obstacles').select('*'),
  ])

  const projects = projectsRes.data ?? []
  const tasks = tasksRes.data ?? []
  const bugs = bugsRes.data ?? []
  const obstacles = obstaclesRes.data ?? []

  const totalDone = tasks.filter(t => t.status === 'done').length
  const openBugs = bugs.filter(b => b.status !== 'resolved').length
  const decisionsNeeded = obstacles.filter(o => o.status === 'open' && o.needs_human).length
  const onTrack = projects.filter(p => p.health === 'on-track').length

  const stats = [
    { label: 'Projects', value: projects.length, icon: Sparkles, color: 'text-primary' },
    { label: 'Tasks Done', value: `${totalDone}/${tasks.length}`, icon: CheckSquare, color: 'text-emerald-400' },
    { label: 'Open Bugs', value: openBugs, icon: Bug, color: openBugs > 0 ? 'text-red-400' : 'text-muted-foreground' },
    { label: 'Decisions Needed', value: decisionsNeeded, icon: AlertTriangle, color: decisionsNeeded > 0 ? 'text-amber-400' : 'text-muted-foreground' },
  ]

  return (
    <div className="flex flex-col h-full">
      <Header title="Portfolio" description={onTrack > 0 ? `${onTrack} of ${projects.length} on track` : undefined} />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border/60 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <Icon className={`h-3.5 w-3.5 ${color}`} />
              </div>
              <p className="text-2xl font-semibold tracking-tight">{value}</p>
            </div>
          ))}
        </div>

        {/* Projects section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Projects</h2>
            <Link href="/projects/new">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 border-border/60 hover:border-border">
                <Plus className="h-3.5 w-3.5" />
                New Project
              </Button>
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className="border border-dashed border-border/60 rounded-lg p-16 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No projects yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create a project or run <code className="font-mono bg-secondary px-1 rounded">/pm-init</code> in a project directory
                </p>
              </div>
              <Link href="/projects/new">
                <Button size="sm" className="mt-1">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Create your first project
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {projects.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  tasks={tasks.filter(t => t.project_id === project.id)}
                  bugs={bugs.filter(b => b.project_id === project.id)}
                  obstacles={obstacles.filter(o => o.project_id === project.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
