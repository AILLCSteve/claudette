# /pm-plan — Autonomous Project Planning System

You are running the Claudette autonomous planning engine. Generate a complete, exhaustive development plan with ZERO user input. Work autonomously through every phase below in order. Do not stop to ask questions — gather all context from the codebase, .claudepm.md, and web research.

---

## PHASE 1 — Context Gathering

**Do all of these before thinking about the plan:**

1. Read `.claudepm.md` — extract: `name`, `description`, `stack`, `claudette_url`, `claudette_token`, `pm_project_id`, `sprint_goal`
2. List all files in the current directory (recursively, grouped by type)
3. Read entry points: `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` / `composer.json` — whichever exists
4. Read `README.md` if present
5. Read any existing `CLAUDE.md` or `.claude/` configs
6. Scan `src/` or `app/` or `lib/` — read the 5-10 most important files (entry points, main modules, core types)
7. Check Claudette for existing context (if `pm_project_id` is set and non-empty):
   ```
   GET {claudette_url}/api/projects/{pm_project_id}
   GET {claudette_url}/api/tasks?project_id={pm_project_id}
   GET {claudette_url}/api/obstacles?project_id={pm_project_id}&status=open
   Authorization: Bearer {claudette_token}
   ```

Build an internal mental model of: what exists, what's missing, what's broken, what the sprint goal is.

---

## PHASE 2 — Stack Detection & Skill Loading

Based on the detected stack, load relevant skills via the Skill tool BEFORE planning:

| Detected Stack / Pattern | Load This Skill |
|---|---|
| React, Next.js, Vue, Svelte, any UI | `frontend-design` |
| Any project (always) | `superpowers:brainstorming` (autonomous mode — no user questions) |
| Any project (always) | `superpowers:writing-plans` |
| Existing test files, Jest, pytest, etc. | `superpowers:test-driven-development` |
| Auth, payments, PII, financial data | `audit:audit` |
| Complex multi-file refactor | `superpowers:dispatching-parallel-agents` |
| Greenfield new project | `superpowers:using-git-worktrees` |

Load ALL that apply. After loading, announce: "Loaded skills: [list]"

---

## PHASE 3 — Autonomous Research Loop (5 Rounds, No User Input)

Work through all 5 rounds internally. Write your thinking as you go — this IS the brainstorm.

### Round 1 — Feature Decomposition
Answer these questions by reading the code and .claudepm.md:
- What is the sprint goal? Break it into every discrete feature.
- What already exists vs. what needs to be built from scratch?
- What are the data models involved? What APIs need to exist?
- What UI screens/components are needed?
- List every feature, sub-feature, and edge case you can identify.

### Round 2 — Architecture Decisions
For every feature identified in Round 1, decide:
- Exact file structure (where does each piece live?)
- Data flow (how does data move from DB → API → UI?)
- State management approach
- Error handling strategy
- What could go wrong and how to prevent it?
Do NOT leave these decisions vague — make them explicit.

### Round 3 — Web Research (use WebSearch tool)
Search for best practices, known issues, and optimal patterns for the specific stack. Search for:
- `"{primary framework} best practices {year}"`
- `"{primary framework} common mistakes"`
- `"{specific library} testing patterns"`
- `"{stack} security checklist"`
- Any specific APIs or integrations involved
Synthesize findings: what approaches should be used, what should be avoided?

### Round 4 — Self-Critique
Challenge every assumption from Rounds 1-3:
- Is the architecture the right one, or is there a simpler approach?
- What are the riskiest tasks? What's most likely to go wrong?
- Are the test strategies realistic?
- Is the scope achievable in the available token budget?
- What dependencies or blockers exist that could derail the plan?
- Are there tasks that should be parallelized (different agents)?
Revise your architecture and feature list based on this critique.

### Round 5 — Final Synthesis
Produce the definitive list of everything to build, in dependency order:
- Exact file paths, function names, API routes, DB schema changes
- Test cases for each feature (specific inputs/outputs)
- Acceptance criteria that can be verified by running code, not by opinion
- Estimated token cost per task (honest estimates based on complexity)
- Session window grouping (150K tokens per 5-hour window)
- Agent assignments (AGENT_A = backend/infra/DB, AGENT_B = frontend/UI/tests)

---

## PHASE 4 — Implementation Plan (Superpowers Format)

Write the implementation plan to:
```
docs/superpowers/plans/YYYY-MM-DD-{feature-name}.md
```

Follow `superpowers:writing-plans` format EXACTLY. Every task must have:
- Exact file paths to create/modify
- Complete code snippets (not pseudocode — actual working code)
- Exact test commands with expected output
- A commit step

TDD structure for every feature:
```
- [ ] Write failing test (show exact test code)
- [ ] Run test — verify it fails with expected error
- [ ] Implement minimal code to pass
- [ ] Run test — verify it passes
- [ ] Run full suite — no regressions
- [ ] Commit
```

Add session window markers:
```
## Session Window 1 (~150K tokens)
[tasks that fit in window 1]

### CHECKPOINT 1
- [ ] Run full test suite: `{test command}`
- [ ] Run lint: `{lint command}`
- [ ] Run build: `{build command}`
- [ ] Update task statuses in Claudette
- [ ] Log session to Claudette
- [ ] Assess: is the approach working? Any blockers to escalate?
- [ ] Commit checkpoint

## Session Window 2 (~150K tokens)
[tasks that fit in window 2]
...
```

---

## PHASE 5 — Claudette PM Task Creation

If `pm_project_id` is set in `.claudepm.md`, create all tasks in the dashboard now.

For EACH task in the implementation plan, POST:
```
POST {claudette_url}/api/tasks
Authorization: Bearer {claudette_token}
Content-Type: application/json

{
  "project_id": "{pm_project_id}",
  "title": "Task title",
  "description": "Full description matching the plan",
  "status": "backlog",
  "priority": "high|medium|low|critical",
  "assigned_agent": "AGENT_A|AGENT_B",
  "estimated_tokens_k": 30,
  "session_window": 1
}
```

For CHECKPOINT tasks, use `priority: "critical"` and prefix the title with `🔍 CHECKPOINT {N}:`.

After creating all tasks, update the project health:
```
PATCH {claudette_url}/api/projects/{pm_project_id}
Authorization: Bearer {claudette_token}

{ "health": "on-track", "sprint_goal": "{refined sprint goal from planning}" }
```

Then log the planning session itself:
```
POST {claudette_url}/api/sessions
Authorization: Bearer {claudette_token}

{
  "project_id": "{pm_project_id}",
  "tasks_completed": ["Generated development plan"],
  "tasks_partial": [],
  "bugs_logged": [],
  "obstacles_logged": [],
  "tokens_used_k": {estimate},
  "notes": "Autonomous planning complete. {N} tasks created across {W} session windows. Plan saved to docs/superpowers/plans/.",
  "session_date": "{today YYYY-MM-DD}"
}
```

---

## PHASE 6 — Execution Kickoff

Announce the plan summary:
```
✅ Plan complete
   Tasks created: {N}
   Session windows: {W}
   Estimated total tokens: {T}K
   Plan file: docs/superpowers/plans/{filename}
   Claudette: {claudette_url}/projects/{pm_project_id}
```

Then ask ONE question:
> "Ready to start execution? I'll use subagent-driven development to work through Window 1 now, or you can start a fresh session later with the plan already in Claudette. Start now? (yes/no)"

If yes: invoke `superpowers:subagent-driven-development` with the plan file.
If no: confirm the plan is saved and ready whenever they are.

---

## Hard Rules

- NEVER ask the user about features, stack, or architecture — gather from code and research
- NEVER produce vague task descriptions — every task must be executable with no additional context
- NEVER skip the web research phase — it catches mistakes before they're built
- NEVER skip checkpoints — they're the mechanism for catching drift early
- If `pm_project_id` is empty in `.claudepm.md`, create all the local plan files but skip the Claudette API calls, and remind the user to link the project
- If any API call to Claudette fails, continue with the local plan — don't block on it
- Task descriptions must include: file paths, function names, data shapes, and test expectations
- Estimated tokens must be honest — better to overestimate than leave agents stranded mid-task
