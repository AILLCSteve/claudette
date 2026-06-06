import type { DevPlanTask } from '@/types'

const SESSION_BUDGET_K = 300
const PM_RESERVE_K = 20
const USABLE_BUDGET_K = SESSION_BUDGET_K - PM_RESERVE_K

export interface SessionWindow {
  windowNumber: number
  tasks: DevPlanTask[]
  estimatedTokensK: number
  budgetUtilizationPct: number
}

interface TaskNode {
  task: DevPlanTask
  deps: Set<string>
}

function topoSort(tasks: DevPlanTask[]): DevPlanTask[] {
  const nodes = new Map<string, TaskNode>()
  for (const task of tasks) {
    nodes.set(task.id, {
      task,
      deps: new Set(task.depends_on),
    })
  }

  const sorted: DevPlanTask[] = []
  const visited = new Set<string>()

  function visit(id: string) {
    if (visited.has(id)) return
    visited.add(id)
    const node = nodes.get(id)
    if (!node) return
    for (const depId of Array.from(node.deps)) {
      visit(depId)
    }
    sorted.push(node.task)
  }

  for (const id of Array.from(nodes.keys())) {
    visit(id)
  }

  return sorted
}

export function partitionIntoSessions(tasks: DevPlanTask[]): SessionWindow[] {
  const sorted = topoSort(tasks)

  const sessions: SessionWindow[] = []
  let currentWindow: DevPlanTask[] = []
  let currentBudgetK = 0
  let windowNumber = 1

  for (const task of sorted) {
    const taskCostK = task.estimated_tokens_k || 20

    if (currentBudgetK + taskCostK > USABLE_BUDGET_K && currentWindow.length > 0) {
      sessions.push({
        windowNumber,
        tasks: currentWindow,
        estimatedTokensK: currentBudgetK,
        budgetUtilizationPct: Math.round((currentBudgetK / USABLE_BUDGET_K) * 100),
      })
      windowNumber++
      currentWindow = []
      currentBudgetK = 0
    }

    currentWindow.push(task)
    currentBudgetK += taskCostK
  }

  if (currentWindow.length > 0) {
    sessions.push({
      windowNumber,
      tasks: currentWindow,
      estimatedTokensK: currentBudgetK,
      budgetUtilizationPct: Math.round((currentBudgetK / USABLE_BUDGET_K) * 100),
    })
  }

  return sessions
}

export function generateSessionBriefing(session: SessionWindow, agentId: string): string {
  const lines = [
    `# Session Window ${session.windowNumber} — ${agentId}`,
    `**Estimated token cost:** ~${session.estimatedTokensK}K / ${USABLE_BUDGET_K}K usable`,
    `**Budget utilization:** ${session.budgetUtilizationPct}%`,
    `**PM reserve:** ${PM_RESERVE_K}K held back for session log + status updates`,
    '',
    '## Tasks for This Window',
    ...session.tasks.map((t, i) =>
      `${i + 1}. [${t.status}] ${t.title} (~${t.estimated_tokens_k}K tokens)\n   ${t.description}`
    ),
    '',
    '## When Budget Hits 20K Remaining',
    '1. Stop current task at a natural commit point',
    '2. POST /api/sessions with completed/partial task lists',
    '3. PATCH /api/tasks/[id] to update statuses',
    '4. POST /api/obstacles if blocked',
    '5. Write handoff note and stop',
  ]

  return lines.join('\n')
}
