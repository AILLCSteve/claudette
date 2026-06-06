export interface MarkerFrontmatter {
  claudepm?: string
  name?: string
  description?: string
  stack?: string
  health?: string
  agent?: string
  sprint_goal?: string
  local_path?: string
  pm_project_id?: string
  github_repo?: string
  claudette_url?: string
  claudette_token?: string
}

export interface ParsedMarker {
  frontmatter: MarkerFrontmatter
  body: string
}

export interface MarkerTask {
  id: string
  title: string
  status: string
  priority: string
  assigned_agent?: string | null
}

export interface MarkerSession {
  agent_id?: string | null
  session_date: string
  tokens_used_k?: number | null
  tasks_completed?: string[]
  notes?: string | null
}

export interface MarkerObstacle {
  description: string
  status: string
  urgency?: string | null
  needs_human?: boolean
  recommendation?: string | null
  options?: string[]
}

export interface RichProject {
  id: string
  name: string
  description?: string | null
  stack?: string[] | null
  health?: string | null
  agent_assigned?: string | null
  sprint_goal?: string | null
  local_path?: string | null
  github_repo?: string | null
  token_budget_k?: number | null
  tokens_used_k?: number | null
  claudette_url?: string
  claudette_token?: string
  tasks?: MarkerTask[]
  session_logs?: MarkerSession[]
  obstacles?: MarkerObstacle[]
}

export function parseMarkerFile(content: string): ParsedMarker | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)/)
  if (!match) return null

  const frontmatter: MarkerFrontmatter = {}
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*"?([^"#\r]*?)"?\s*$/)
    if (kv) (frontmatter as Record<string, string>)[kv[1]] = kv[2].trim()
  }

  return { frontmatter, body: match[2].trim() }
}

const PRIORITY_ICON: Record<string, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '⚪',
}

const STATUS_ICON: Record<string, string> = {
  ready: '▶',
  'in-progress': '⚡',
  blocked: '🔒',
  done: '✅',
  backlog: '○',
}

function esc(s: string) {
  return s.replace(/"/g, "'")
}

export function generateMarkerFile(project: RichProject): string {
  const claudette_url = project.claudette_url ?? ''
  const claudette_token = project.claudette_token ?? ''
  const projectUrl = claudette_url && project.id
    ? `${claudette_url}/projects/${project.id}`
    : ''
  const budgetLine = (project.token_budget_k && project.tokens_used_k != null)
    ? `${project.tokens_used_k}K / ${project.token_budget_k}K tokens used`
    : ''

  const tasks = project.tasks ?? []
  const obstacles = project.obstacles ?? []
  const sessions = project.session_logs ?? []

  // Group tasks by status
  const byStatus: Record<string, MarkerTask[]> = {}
  for (const t of tasks) {
    if (!byStatus[t.status]) byStatus[t.status] = []
    byStatus[t.status].push(t)
  }

  const statusOrder = ['in-progress', 'ready', 'blocked', 'backlog', 'done']

  function taskSection(label: string, list: MarkerTask[]) {
    if (!list?.length) return []
    const lines: string[] = [`#### ${label} (${list.length})`]
    for (const t of list) {
      const icon = PRIORITY_ICON[t.priority] ?? '·'
      const agent = t.assigned_agent ? ` → **${t.assigned_agent}**` : ''
      lines.push(`- \`${t.id.slice(0, 8)}\` ${icon} [${t.priority}] ${t.title}${agent}`)
    }
    return lines
  }

  const openObstacles = obstacles.filter(o => o.status === 'open')
  const humanObstacles = openObstacles.filter(o => o.needs_human)

  const apiBase = claudette_url || 'YOUR_CLAUDETTE_URL'
  const authHeader = claudette_token
    ? `Authorization: Bearer ${claudette_token}`
    : 'Authorization: Bearer YOUR_CLAUDETTE_TOKEN'
  const pid = project.id || 'YOUR_PROJECT_ID'

  const lines: string[] = [
    '---',
    'claudepm: "2.0"',
    `name: "${esc(project.name)}"`,
    `description: "${esc(project.description ?? '')}"`,
    `stack: "${(project.stack ?? []).join(',')}"`,
    `health: "${project.health ?? 'idle'}"`,
    `agent: "${project.agent_assigned ?? ''}"`,
    `sprint_goal: "${esc(project.sprint_goal ?? '')}"`,
    `local_path: "${project.local_path ?? ''}"`,
    `pm_project_id: "${project.id}"`,
    `github_repo: "${project.github_repo ?? ''}"`,
    `claudette_url: "${claudette_url}"`,
    `claudette_token: "${claudette_token}"`,
    `token_budget_k: ${project.token_budget_k ?? 200}`,
    `tokens_used_k: ${project.tokens_used_k ?? 0}`,
    `updated_at: "${new Date().toISOString()}"`,
    '---',
    '',
    `# ${project.name} — Project Context`,
  ]

  if (projectUrl) lines.push(`> Claudette PM Dashboard: ${projectUrl}`)
  if (project.sprint_goal) lines.push(`> Sprint Goal: ${project.sprint_goal}`)

  lines.push(
    '',
    '---',
    '',
    '## Claudette API Playbook',
    '',
    `**Base:** \`${apiBase}\``,
    `**Auth header (every request):** \`${authHeader}\``,
    '',
    '### 1. Session Start — Read BEFORE doing any work',
    '```',
    `GET ${apiBase}/api/tasks?project_id=${pid}&status=ready`,
    `GET ${apiBase}/api/obstacles?project_id=${pid}&status=open&needs_human=false`,
    `${authHeader}`,
    '```',
    '',
    '### 2. During Work — Update as you go',
    '```',
    `# Claim a task`,
    `PATCH ${apiBase}/api/tasks/{task_id}`,
    `Body: { "status": "in-progress" }`,
    '',
    `# Complete a task`,
    `PATCH ${apiBase}/api/tasks/{task_id}`,
    `Body: { "status": "done" }`,
    '',
    `# Log a bug`,
    `POST ${apiBase}/api/bugs`,
    `Body: { "project_id": "${pid}", "title": "...", "description": "...", "severity": "medium", "status": "open" }`,
    '```',
    '',
    '### 3. Escalate Blockers → PM Inbox',
    '```',
    `POST ${apiBase}/api/obstacles`,
    `Body: {`,
    `  "project_id": "${pid}",`,
    `  "description": "What is blocking you — be specific",`,
    `  "options": ["Option A — describe trade-offs", "Option B — describe trade-offs"],`,
    `  "recommendation": "Your recommended path and why",`,
    `  "workaround": "Any temporary workaround you can use",`,
    `  "needs_human": true,`,
    `  "urgency": "high",`,
    `  "status": "open"`,
    `}`,
    '```',
    '',
    '### 4. Session End — REQUIRED every session',
    '```',
    `POST ${apiBase}/api/sessions`,
    `Body: {`,
    `  "project_id": "${pid}",`,
    `  "agent_id": "AGENT_A",`,
    `  "tasks_completed": ["Exact title of task 1", "Exact title of task 2"],`,
    `  "tasks_partial": ["Title of task started but not finished"],`,
    `  "bugs_logged": ["Bug title if any"],`,
    `  "obstacles_logged": ["Blocker description if any"],`,
    `  "tokens_used_k": 45,`,
    `  "notes": "What was accomplished. What is next. Any decisions made.",`,
    `  "session_date": "${new Date().toISOString().split('T')[0]}"`,
    `}`,
    '```',
  )

  // Sprint / task section
  if (tasks.length > 0) {
    lines.push(
      '',
      '---',
      '',
      '## Current Sprint',
    )
    if (project.health || budgetLine) {
      const parts = [project.health && `health: **${project.health}**`, budgetLine].filter(Boolean)
      lines.push(`_${parts.join(' | ')}_`)
    }
    lines.push('')

    for (const status of statusOrder) {
      const list = byStatus[status]
      if (!list?.length) continue
      const labelMap: Record<string, string> = {
        'in-progress': 'In Progress',
        ready: 'Ready to Work',
        blocked: 'Blocked',
        backlog: 'Backlog',
        done: 'Done',
      }
      const icon = STATUS_ICON[status] ?? '·'
      lines.push(`### ${icon} ${labelMap[status] ?? status} (${list.length})`)
      for (const t of list) {
        const pri = PRIORITY_ICON[t.priority] ?? '·'
        const agent = t.assigned_agent ? ` → **${t.assigned_agent}**` : ''
        lines.push(`- \`${t.id.slice(0, 8)}\` ${pri} [${t.priority}] ${t.title}${agent}`)
      }
      lines.push('')
    }
  }

  // Obstacles
  if (humanObstacles.length > 0) {
    lines.push('## ⚠️ Open Blockers — Needs Human Decision')
    for (const o of humanObstacles) {
      lines.push(`- **[${o.urgency?.toUpperCase() ?? 'HIGH'}]** ${o.description}`)
      if (o.recommendation) lines.push(`  - Rec: ${o.recommendation}`)
    }
    lines.push('')
  }

  // Recent sessions
  const recentSessions = sessions.slice(0, 3)
  if (recentSessions.length > 0) {
    lines.push('## Recent Sessions')
    for (const s of recentSessions) {
      const agent = s.agent_id ?? 'Agent'
      const date = s.session_date
      const tokens = s.tokens_used_k ? `${s.tokens_used_k}K tokens` : ''
      lines.push(`### ${agent} — ${date}${tokens ? ' · ' + tokens : ''}`)
      if (s.tasks_completed?.length) {
        lines.push(`Completed: ${s.tasks_completed.join(', ')}`)
      }
      if (s.notes) lines.push(s.notes)
      lines.push('')
    }
  }

  lines.push(
    '## Notes',
    '',
    '_Add project-specific context here that helps the agent understand this codebase._',
  )

  return lines.join('\n')
}
