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
}

export interface ParsedMarker {
  frontmatter: MarkerFrontmatter
  body: string
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

export function generateMarkerFile(project: {
  name: string
  description?: string
  stack?: string[]
  health?: string
  agent_assigned?: string
  sprint_goal?: string
  local_path?: string
  id?: string
  github_repo?: string
}): string {
  const lines = [
    '---',
    'claudepm: "1.0"',
    `name: "${project.name}"`,
    `description: "${(project.description ?? '').replace(/"/g, "'")}"`,
    `stack: "${(project.stack ?? []).join(',')}"`,
    `health: "${project.health ?? 'idle'}"`,
    `agent: "${project.agent_assigned ?? ''}"`,
    `sprint_goal: "${(project.sprint_goal ?? '').replace(/"/g, "'")}"`,
    `local_path: "${project.local_path ?? ''}"`,
    `pm_project_id: "${project.id ?? ''}"`,
    `github_repo: "${project.github_repo ?? ''}"`,
    '---',
    '',
    `# ${project.name} — Project Context`,
    '',
    '## Agent Instructions',
    '',
    'When working on this project:',
    '1. Read this file first to orient yourself',
    '2. Check open obstacles in Claude PM before starting new work',
    '3. Use `POST /api/sessions` to log completed work',
    '4. Use `POST /api/obstacles` to escalate blockers that need human input',
    '5. Update task statuses via `PATCH /api/tasks/[id]` as you work',
    '',
    '## Notes',
    '',
    '_Add project-specific context here that helps Claude understand this codebase._',
  ]

  return lines.join('\n')
}
