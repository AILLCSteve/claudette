import { sanitizeForPrompt } from '@/lib/anthropic/sanitize'
import type { Agent, Project, Task, Bug, Obstacle, Decision, SessionLog } from '@/types'

export function generateMemoryMD(
  agent: Agent,
  project: Project & {
    tasks: Task[]
    bugs: Bug[]
    obstacles: Obstacle[]
    decisions: Decision[]
    session_logs: SessionLog[]
  }
): string {
  const activeTasks = project.tasks.filter(t => t.status === 'in-progress' || t.status === 'ready')
  const openBugs = project.bugs.filter(b => b.status !== 'resolved')
  const openObstacles = project.obstacles.filter(o => o.status === 'open')
  const lastSession = project.session_logs[0]

  const lines = [
    `# MEMORY.md — ${agent.name}`,
    `_Last updated: ${new Date().toISOString().split('T')[0]}_`,
    '',
    '## Current Assignment',
    `**Project:** ${sanitizeForPrompt(project.name)}`,
    `**Sprint Goal:** ${sanitizeForPrompt(project.sprint_goal)}`,
    `**Sprint End:** ${project.sprint_end ?? 'Not set'}`,
    `**My Domain:** ${agent.domain}`,
    '',
    '## Active Tasks',
    ...activeTasks.map(t => `- [${t.status}] ${sanitizeForPrompt(t.title)}`),
    activeTasks.length === 0 ? '- No active tasks' : '',
    '',
    '## Last Session',
  ]

  if (lastSession) {
    lines.push(
      `**Date:** ${lastSession.session_date}`,
      `**Completed:** ${lastSession.tasks_completed.join(', ') || 'None'}`,
      `**Partial:** ${lastSession.tasks_partial.join(', ') || 'None'}`,
      `**Tokens used:** ${lastSession.tokens_used_k}K`,
      `**Notes:** ${sanitizeForPrompt(lastSession.notes)}`,
    )
  } else {
    lines.push('No previous session on record.')
  }

  lines.push('', '## Open Issues I Know About')
  if (openBugs.length > 0) {
    openBugs.slice(0, 10).forEach(b => {
      lines.push(`- [${b.severity.toUpperCase()} BUG] ${sanitizeForPrompt(b.title)}`)
    })
  } else {
    lines.push('- No open bugs')
  }

  lines.push('', '## Decisions Already Made')
  if (project.decisions.length > 0) {
    project.decisions.slice(0, 10).forEach(d => {
      lines.push(`- **${sanitizeForPrompt(d.title)}**: ${sanitizeForPrompt(d.rationale)}`)
    })
  } else {
    lines.push('- No recorded decisions')
  }

  lines.push('', '## Things To Watch')
  if (openObstacles.length > 0) {
    openObstacles.slice(0, 5).forEach(o => {
      lines.push(`- [${o.urgency.toUpperCase()}] ${sanitizeForPrompt(o.description)} → ${sanitizeForPrompt(o.workaround)}`)
    })
  } else {
    lines.push('- No open obstacles')
  }

  return lines.filter(l => l !== undefined).join('\n')
}
