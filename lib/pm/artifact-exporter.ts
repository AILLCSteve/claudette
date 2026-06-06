import { sanitizeForPrompt } from '@/lib/anthropic/sanitize'
import type { Project, Task, Bug, Obstacle, Agent, SessionLog, DevPlan, DevPlanTask } from '@/types'

interface ArtifactContext {
  project: Project & {
    tasks: Task[]
    bugs: Bug[]
    obstacles: Obstacle[]
    session_logs: SessionLog[]
    dev_plans: (DevPlan & { dev_plan_tasks: DevPlanTask[] })[]
  }
  agent: Agent
  sessionWindow?: number
}

export function generateContextArtifact(ctx: ArtifactContext): string {
  const { project, agent, sessionWindow } = ctx

  const activePlan = project.dev_plans.find(p => p.status === 'active') ?? project.dev_plans[0]
  const pendingTasks = activePlan?.dev_plan_tasks
    .filter(t => t.status === 'pending' || t.status === 'in-progress')
    .sort((a, b) => a.position - b.position)
    ?? []

  const windowTasks = sessionWindow
    ? pendingTasks.filter(t => t.session_window === sessionWindow)
    : pendingTasks.slice(0, 10)

  const recentSessions = project.session_logs.slice(0, 3)
  const openObstacles = project.obstacles.filter(o => o.status === 'open' && o.needs_human)
  const critBugs = project.bugs.filter(b => b.severity === 'critical' && b.status !== 'resolved')

  const lines = [
    `# Claude PM Context Artifact`,
    `_Export date: ${new Date().toISOString()}_`,
    `_Feed this file to any Claude session to bootstrap full project context_`,
    '',
    '---',
    '',
    '## Project State',
    `**Name:** ${sanitizeForPrompt(project.name)}`,
    `**Health:** ${project.health}`,
    `**Stack:** ${project.stack.join(', ')}`,
    `**GitHub:** ${project.github_repo || 'Not connected'}`,
    `**Sprint Goal:** ${sanitizeForPrompt(project.sprint_goal)}`,
    `**Sprint End:** ${project.sprint_end ?? 'Not set'}`,
    '',
    '## Assigned Agent',
    `**Agent:** ${agent.name} (${agent.agent_key})`,
    `**Domain:** ${agent.domain}`,
    `**Session Budget:** ${agent.session_budget_k}K tokens`,
    '',
  ]

  if (activePlan) {
    lines.push(
      '## Active Development Plan',
      `**Plan:** ${sanitizeForPrompt(activePlan.title)}`,
      `**Overview:** ${sanitizeForPrompt(activePlan.overview)}`,
      `**Total Sessions Estimated:** ${activePlan.total_sessions_estimated}`,
      '',
      `### Next Tasks${sessionWindow ? ` (Session Window ${sessionWindow})` : ''}`,
      ...windowTasks.map((t, i) =>
        `${i + 1}. **${sanitizeForPrompt(t.title)}** (~${t.estimated_tokens_k}K tokens)\n   ${sanitizeForPrompt(t.description)}\n   Acceptance: ${t.acceptance_criteria.map(sanitizeForPrompt).join('; ')}`
      ),
      '',
    )
  }

  lines.push('## Project Tasks (Open)')
  const openTasks = project.tasks.filter(t => t.status !== 'done')
  openTasks.slice(0, 15).forEach(t => {
    lines.push(`- [${t.status}] ${sanitizeForPrompt(t.title)} (${t.priority})`)
  })
  lines.push('')

  if (critBugs.length > 0) {
    lines.push('## Critical Bugs')
    critBugs.forEach(b => {
      lines.push(`- [${b.status}] ${sanitizeForPrompt(b.title)}: ${sanitizeForPrompt(b.description)}`)
    })
    lines.push('')
  }

  if (openObstacles.length > 0) {
    lines.push('## Decisions Needed (Blocking)')
    openObstacles.forEach(o => {
      lines.push(
        `- [${o.urgency.toUpperCase()}] ${sanitizeForPrompt(o.description)}`,
        `  Options: ${o.options.map(sanitizeForPrompt).join(' | ')}`,
        `  Recommendation: ${sanitizeForPrompt(o.recommendation)}`,
        `  Workaround: ${sanitizeForPrompt(o.workaround)}`,
      )
    })
    lines.push('')
  }

  if (recentSessions.length > 0) {
    lines.push('## Recent Session History')
    recentSessions.forEach(s => {
      lines.push(
        `**${s.session_date} — ${s.agent_id}** (${s.tokens_used_k}K tokens)`,
        `  Completed: ${s.tasks_completed.join(', ') || 'none'}`,
        `  Partial: ${s.tasks_partial.join(', ') || 'none'}`,
        `  Notes: ${sanitizeForPrompt(s.notes)}`,
      )
    })
    lines.push('')
  }

  lines.push(
    '---',
    '',
    '## How to Use This Artifact',
    '1. Start a new Claude Code session (any account)',
    '2. Feed this file: `claude --file context-artifact.md`',
    '3. Or paste it as the first message',
    '4. Claude will have full project context and can resume work immediately',
    '5. After the session, export a new artifact to capture what changed',
  )

  return lines.join('\n')
}
