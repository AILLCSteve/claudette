import { getAnthropicClient } from '@/lib/anthropic/client'
import { sanitizeForPrompt } from '@/lib/anthropic/sanitize'
import { getRequestUser } from '@/lib/auth/api-auth'
import { NextResponse } from 'next/server'

const SESSION_WINDOW_TOKENS_K = 150 // tokens per 5-hour session window

export async function POST(request: Request) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, scope, constraints, githubAnalysis } = await request.json()

  const { data: project } = await user.supabase
    .from('projects')
    .select('*, tasks(*), bugs(*), obstacles(*), decisions(*), session_logs(*)')
    .eq('id', projectId)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const existingTasks = (project.tasks ?? [])
    .map((t: any) => `- [${t.status}] ${sanitizeForPrompt(t.title)}`)
    .join('\n')

  const openBugs = (project.bugs ?? [])
    .filter((b: any) => b.status !== 'resolved')
    .map((b: any) => `- [${b.severity}] ${sanitizeForPrompt(b.title)}`)
    .join('\n')

  const sessionSummaries = (project.session_logs ?? [])
    .slice(0, 5)
    .map((s: any) => `- ${s.session_date}: ${sanitizeForPrompt(s.notes)}`)
    .join('\n')

  const prompt = `You are Claudette, an expert software engineering PM AI. Generate an EXTREMELY detailed, thorough, production-grade development plan.

## Project Context
NAME: ${sanitizeForPrompt(project.name)}
DESCRIPTION: ${sanitizeForPrompt(project.description)}
STACK: ${project.stack?.join(', ') ?? 'Unknown'}
SPRINT GOAL: ${sanitizeForPrompt(project.sprint_goal ?? '')}
HEALTH: ${project.health}
SCOPE: ${sanitizeForPrompt(scope || 'Full project development')}
CONSTRAINTS: ${sanitizeForPrompt(constraints || 'None')}

${githubAnalysis ? `## GitHub Analysis\n${sanitizeForPrompt(githubAnalysis)}\n` : ''}

EXISTING TASKS:
${existingTasks || 'None yet'}

OPEN BUGS:
${openBugs || 'None'}

RECENT SESSIONS:
${sessionSummaries || 'No sessions yet'}

## Planning Instructions

Think through this plan exhaustively across multiple dimensions before writing it:

**Round 1 — Feature Decomposition**
Break down every feature into atomic, independently-testable units. Consider the full lifecycle: scaffolding, core logic, error handling, tests, edge cases, integration.

**Round 2 — Architecture Decisions**
Decide data models, API contracts, component boundaries, state management patterns. Make these decisions explicit in task descriptions so agents don't have to guess.

**Round 3 — Testing Strategy**
Every feature needs: unit tests, integration tests, edge case tests. Plan them explicitly — which test file, which cases, what the test verifies. TDD: test first, then implementation.

**Round 4 — Risk & Dependency Analysis**
What are the hard parts? What could go wrong? What external dependencies (APIs, DBs) could fail? Build defensive handling and fallbacks into the tasks.

**Round 5 — Session Window Planning**
Group tasks into 5-hour session windows (~${SESSION_WINDOW_TOKENS_K}K tokens per window). Add a CHECKPOINT task at the end of each window where the agent steps back, runs all tests, reviews progress, updates the PM dashboard, and decides if the approach needs adjustment.

## Output Format

Return ONLY valid JSON matching this schema exactly:

{
  "title": "Concise plan title",
  "overview": "3-4 paragraph executive summary covering: what is being built, the architecture approach, testing strategy, and key risks/mitigations",
  "tasks": [
    {
      "title": "Task title (imperative verb: Implement X, Add Y, Write tests for Z)",
      "description": "DETAILED description: what to build, exact file paths, function signatures, data schemas, API contracts, edge cases to handle. Minimum 3-5 sentences. Be specific enough that an agent with no other context can execute this.",
      "acceptance_criteria": [
        "Specific testable criterion — can be verified by running a test or checking output",
        "Another criterion"
      ],
      "depends_on_titles": ["Title of a prerequisite task"],
      "assigned_agent": "AGENT_A",
      "estimated_tokens_k": 30,
      "session_window": 1,
      "priority": "high",
      "is_checkpoint": false,
      "test_commands": ["npm test", "npm run build"],
      "files_to_create": ["src/components/Foo.tsx"],
      "files_to_modify": ["src/app/page.tsx"]
    },
    {
      "title": "CHECKPOINT 1 — Review, test, and reassess",
      "description": "Stop all feature work. Run: (1) full test suite, (2) lint, (3) build. Review tasks completed vs. planned. Check for regressions. Update task statuses in Claudette via PATCH /api/tasks/{id}. Log session via POST /api/sessions. Assess: is the current approach still correct? If any tests fail or the architecture feels wrong, post an obstacle to Claudette via POST /api/obstacles with needs_human: true before continuing.",
      "acceptance_criteria": [
        "All tests pass",
        "No lint errors",
        "Build succeeds",
        "Session logged to Claudette",
        "Task statuses updated in Claudette"
      ],
      "depends_on_titles": [],
      "assigned_agent": "AGENT_A",
      "estimated_tokens_k": 10,
      "session_window": 1,
      "priority": "high",
      "is_checkpoint": true,
      "test_commands": [],
      "files_to_create": [],
      "files_to_modify": []
    }
  ]
}

Rules:
- estimated_tokens_k: 10-20K for simple tasks, 25-50K for medium, 50-80K for complex. Checkpoints always 10K.
- session_window: group tasks so each window totals ~${SESSION_WINDOW_TOKENS_K}K tokens. Add a CHECKPOINT at the end of every window.
- assigned_agent: AGENT_A for backend/DB/API/infra, AGENT_B for frontend/UI/components/styles
- priority: "critical" for blockers, "high" for core features, "medium" for enhancements, "low" for polish
- is_checkpoint: true only for CHECKPOINT tasks
- At least 15 tasks minimum, no maximum
- Every feature task must have a corresponding test task before it or be TDD (test written first in the same task)
- File paths must be real/plausible for the detected stack
- Return ONLY valid JSON. No markdown fences, no explanation.`

  const anthropic = getAnthropicClient()

  // Use extended thinking for deep autonomous reasoning
  let rawText: string
  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 16000,
      thinking: { type: 'enabled', budget_tokens: 8000 },
      messages: [{ role: 'user', content: prompt }],
    } as any)

    rawText = response.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')
  } catch {
    // Fallback if thinking isn't available on this tier
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 12000,
      messages: [{ role: 'user', content: prompt }],
    })
    rawText = response.content[0].type === 'text' ? response.content[0].text : '{}'
  }

  let planData: any
  try {
    planData = JSON.parse(rawText)
  } catch {
    const match = rawText.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
    if (match) {
      try { planData = JSON.parse(match[1]) } catch {
        return NextResponse.json({ error: 'Failed to parse plan JSON', raw: rawText.slice(0, 500) }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: 'Failed to parse plan JSON', raw: rawText.slice(0, 500) }, { status: 500 })
    }
  }

  // Save dev plan
  const { data: devPlan, error: planError } = await user.supabase
    .from('dev_plans')
    .insert({
      project_id: projectId,
      title: planData.title,
      overview: planData.overview,
      status: 'draft',
      total_sessions_estimated: Math.max(...(planData.tasks ?? []).map((t: any) => t.session_window ?? 1)),
    })
    .select()
    .single()

  if (planError) return NextResponse.json({ error: planError.message }, { status: 500 })

  const titleToId = new Map<string, string>()
  const insertedTasks = []

  for (let i = 0; i < planData.tasks.length; i++) {
    const t = planData.tasks[i]
    const dependsOnIds = (t.depends_on_titles ?? [])
      .map((title: string) => titleToId.get(title))
      .filter(Boolean)

    const { data: task } = await user.supabase
      .from('dev_plan_tasks')
      .insert({
        dev_plan_id: devPlan.id,
        title: t.title,
        description: t.description,
        acceptance_criteria: t.acceptance_criteria ?? [],
        depends_on: dependsOnIds,
        assigned_agent: t.assigned_agent ?? 'AGENT_A',
        estimated_tokens_k: t.estimated_tokens_k ?? 20,
        session_window: t.session_window ?? 1,
        position: i + 1,
        status: 'pending',
      })
      .select()
      .single()

    if (task) {
      titleToId.set(t.title, task.id)
      insertedTasks.push(task)
    }
  }

  // Update project health to on-track now that there's a plan
  await user.supabase
    .from('projects')
    .update({ health: 'on-track', updated_at: new Date().toISOString() })
    .eq('id', projectId)

  return NextResponse.json({ devPlan, tasks: insertedTasks, totalWindows: devPlan.total_sessions_estimated })
}
