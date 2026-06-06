import { sanitizeForPrompt } from '@/lib/anthropic/sanitize'
import type { Agent, Project, Task, Bug, Obstacle, SessionQueue } from '@/types'

export function generateBootstrapPrompt(
  agent: Agent,
  queue: SessionQueue,
  project: Project & { tasks: Task[]; bugs: Bug[]; obstacles: Obstacle[] },
  sessionWindow: number
): string {
  const openObstacles = project.obstacles.filter(
    o => o.status === 'open' && o.needs_human
  )
  const criticalBugs = project.bugs.filter(
    b => b.severity === 'critical' && b.status !== 'resolved'
  )
  const assignedTasks = project.tasks
    .filter(t => t.session_window === sessionWindow && t.status !== 'done')
    .sort((a, b) => a.estimated_tokens_k - b.estimated_tokens_k)

  return `# ${agent.name} — Session Bootstrap

## Your Identity
- Agent ID: ${agent.agent_key}
- Account: ${agent.account_email}
- Domain: ${agent.domain}
- Session Budget: ${agent.session_budget_k}K tokens

## STEP 1: Read These Files First
Before doing ANYTHING, read in this order:
1. @MEMORY.md — your persistent memory and current assignment
2. @CLAUDE.md — project laws and conventions
3. @digestsynopsisSUMMARY.md — full architecture map (if present)

## STEP 2: Your Task Queue (Session Window ${sessionWindow})
Project: ${sanitizeForPrompt(project.name)}
Sprint Goal: ${sanitizeForPrompt(project.sprint_goal)}

Tasks (in order):
${assignedTasks.map((t, i) => `${i + 1}. [${t.status.toUpperCase()}] ${sanitizeForPrompt(t.title)} (~${t.estimated_tokens_k}K tokens)
   ${sanitizeForPrompt(t.description)}`).join('\n\n')}

${queue.notes ? `\nSpecial Instructions:\n${sanitizeForPrompt(queue.notes)}` : ''}

## STEP 3: Pre-Flight Checks
${openObstacles.length > 0 ? `
### Obstacles Requiring Human Decision
${openObstacles.map(o => `- [${o.urgency.toUpperCase()}] ${sanitizeForPrompt(o.description)}
  Options: ${o.options.map(sanitizeForPrompt).join(' | ')}
  Recommendation: ${sanitizeForPrompt(o.recommendation)}
  Workaround: ${sanitizeForPrompt(o.workaround)}`).join('\n\n')}
` : '### No Obstacles Requiring Human Decision\n'}
${criticalBugs.length > 0 ? `
### Critical Bugs
${criticalBugs.map(b => `- ${sanitizeForPrompt(b.title)} (${b.status}): ${sanitizeForPrompt(b.description)}`).join('\n')}
` : '### No Critical Bugs\n'}

## Token Budget Protocol
- Session budget: ${agent.session_budget_k}K tokens
- PM reserve: 20K (DO NOT use for feature work)
- When ${agent.session_budget_k - 20}K used: transition to graceful shutdown
- Shutdown sequence: update task statuses → write session log → write handoff note

## BEGIN
`
}
