import { sanitizeForPrompt } from './sanitize'
import type { Project, Task, Bug, Obstacle, SessionLog, Agent, SessionQueue } from '@/types'

interface PortfolioContext {
  projects: Project[]
  tasks: Task[]
  bugs: Bug[]
  obstacles: Obstacle[]
  recentSessions: SessionLog[]
  agents: Agent[]
  queues: SessionQueue[]
}

export function buildCompressedContext(ctx: PortfolioContext): string {
  const { projects, tasks, bugs, obstacles, recentSessions, agents, queues } = ctx

  const openObstacles = obstacles.filter(o => o.status === 'open' && o.needs_human)
  const criticalBugs = bugs.filter(b => b.severity === 'critical' && b.status !== 'resolved')
  const blockedTasks = tasks.filter(t => t.status === 'blocked')
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress')

  const lines: string[] = [
    `## Portfolio (${projects.length} projects)`,
    ...projects.map(p =>
      `- ${sanitizeForPrompt(p.name)} [${p.health}] stack:${p.stack.join(',')} agent:${p.agent_assigned || 'unassigned'}`
    ),
    '',
    `## Active Issues`,
    `- Critical bugs: ${criticalBugs.length}`,
    `- Blocked tasks: ${blockedTasks.length}`,
    `- In-progress: ${inProgressTasks.length}`,
    `- Needs human decision: ${openObstacles.length}`,
    '',
  ]

  if (openObstacles.length > 0) {
    lines.push('## Decisions Needed')
    openObstacles.slice(0, 5).forEach(o => {
      lines.push(`- [${o.urgency.toUpperCase()}] ${sanitizeForPrompt(o.description)}`)
    })
    lines.push('')
  }

  if (criticalBugs.length > 0) {
    lines.push('## Critical Bugs')
    criticalBugs.slice(0, 5).forEach(b => {
      lines.push(`- ${sanitizeForPrompt(b.title)} (${b.status})`)
    })
    lines.push('')
  }

  lines.push('## Agent Queues')
  queues.forEach(q => {
    const agent = agents.find(a => a.id === q.agent_id)
    if (agent && q.tasks.length > 0) {
      lines.push(`- ${agent.name}: ${q.tasks.length} tasks queued`)
    }
  })

  if (recentSessions.length > 0) {
    lines.push('')
    lines.push('## Recent Sessions (last 3)')
    recentSessions.slice(0, 3).forEach(s => {
      lines.push(`- ${s.agent_id} on ${s.session_date}: ${s.tasks_completed.length} done, ${s.tokens_used_k}K tokens`)
    })
  }

  return lines.join('\n')
}
