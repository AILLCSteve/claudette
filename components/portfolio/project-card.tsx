import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import { HealthBadge, healthBorderColor } from './health-badge'
import { cn } from '@/lib/utils'
import { Bug, AlertTriangle, Bot, GitBranch } from 'lucide-react'
import type { Project, Task, Bug as BugType, Obstacle } from '@/types'

interface ProjectCardProps {
  project: Project
  tasks: Task[]
  bugs: BugType[]
  obstacles: Obstacle[]
}

export function ProjectCard({ project, tasks, bugs, obstacles }: ProjectCardProps) {
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const totalTasks = tasks.length
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const openBugs = bugs.filter(b => b.status !== 'resolved').length
  const critBugs = bugs.filter(b => b.severity === 'critical' && b.status !== 'resolved').length
  const needsHuman = obstacles.filter(o => o.status === 'open' && o.needs_human).length
  const borderColor = healthBorderColor[project.health] ?? healthBorderColor.idle

  return (
    <Link href={`/projects/${project.id}`} className="block group">
      <div
        className="relative h-full bg-card rounded-lg border border-border/60 overflow-hidden hover:border-border transition-colors duration-150 pl-[3px]"
      >
        {/* Health color left border */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg"
          style={{ backgroundColor: borderColor }}
        />

        <div className="p-4 space-y-3">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-medium text-sm text-foreground leading-snug truncate group-hover:text-primary transition-colors">
                {project.name}
              </h3>
              {project.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                  {project.description}
                </p>
              )}
            </div>
            <HealthBadge health={project.health} />
          </div>

          {/* Stack tags */}
          {project.stack.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {project.stack.slice(0, 5).map(s => (
                <span
                  key={s}
                  className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground"
                >
                  {s}
                </span>
              ))}
              {project.stack.length > 5 && (
                <span className="text-[11px] text-muted-foreground/60">+{project.stack.length - 5}</span>
              )}
            </div>
          )}

          {/* Progress */}
          {totalTasks > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{progressPct}% complete</span>
                <span>{doneTasks}/{totalTasks}</span>
              </div>
              <Progress value={progressPct} className="h-1" />
            </div>
          )}

          {/* Footer metadata */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
            {openBugs > 0 && (
              <span className={cn('flex items-center gap-1', critBugs > 0 && 'text-red-400')}>
                <Bug className="h-3 w-3" />
                {openBugs} bug{openBugs !== 1 ? 's' : ''}
                {critBugs > 0 && <span className="text-red-400 font-medium">({critBugs} crit)</span>}
              </span>
            )}
            {needsHuman > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                {needsHuman} decision{needsHuman !== 1 ? 's' : ''}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {project.github_repo && (
                <GitBranch className="h-3 w-3 text-muted-foreground/50" />
              )}
              {project.agent_assigned && (
                <span className="flex items-center gap-1">
                  <Bot className="h-3 w-3" />
                  {project.agent_assigned}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
