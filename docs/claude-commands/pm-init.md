# /pm-init — Initialize Claudette PM Marker File

You are initializing a Claudette PM project marker file for the current working directory.

---

## What to do

### Step 1 — Read the project structure

List files in the current directory to understand the project type:
- Check for `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `composer.json`
- Check for `README.md`, `CLAUDE.md`, `.env.example`
- Scan `src/`, `app/`, `lib/` for entry points

### Step 2 — Detect the stack

Identify languages, frameworks, and key libraries. Keep it as a comma-separated list of short lowercase tokens (e.g. `typescript,react,nextjs,supabase,anthropic`).

### Step 3 — Check for existing .claudepm.md

If `.claudepm.md` already exists, read it. Preserve any existing `pm_project_id`, `claudette_url`, `claudette_token`, and `## Notes` content. This is an update, not an overwrite.

### Step 4 — Ask the user (only if not already in .claudepm.md)

Ask for:
1. Their Claudette URL (e.g. `http://localhost:3000` or `https://myapp.onrender.com`)
2. Their Claudette API token (generated at Settings → API Tokens)

If already present in the existing file, skip asking.

### Step 5 — Write .claudepm.md

Write the marker file to the current directory:

```
---
claudepm: "2.0"
name: "<project name from package.json / directory>"
description: "<one clear sentence describing what this project does>"
stack: "<comma-separated tech stack>"
health: "idle"
agent: ""
sprint_goal: ""
local_path: "<absolute path — use pwd or Get-Location>"
pm_project_id: "<existing id if updating, else empty>"
github_repo: ""
claudette_url: "<url from user>"
claudette_token: "<token from user>"
token_budget_k: 200
tokens_used_k: 0
updated_at: "<current ISO timestamp>"
---

# <Project Name> — Project Context
> Claudette PM: <claudette_url>/projects/<pm_project_id or YOUR_PROJECT_ID>

---

## Claudette API Playbook

**Base:** `<claudette_url>`
**Auth header (every request):** `Authorization: Bearer <claudette_token>`

### 1. Session Start — Read BEFORE doing any work
```
GET <claudette_url>/api/tasks?project_id=<pm_project_id>&status=ready
GET <claudette_url>/api/obstacles?project_id=<pm_project_id>&status=open&needs_human=false
Authorization: Bearer <claudette_token>
```

### 2. During Work — Update as you go
```
# Claim a task
PATCH <claudette_url>/api/tasks/{task_id}
Body: { "status": "in-progress" }

# Complete a task
PATCH <claudette_url>/api/tasks/{task_id}
Body: { "status": "done" }

# Log a bug
POST <claudette_url>/api/bugs
Body: { "project_id": "<pm_project_id>", "title": "...", "description": "...", "severity": "medium", "status": "open" }
```

### 3. Escalate Blockers → PM Inbox (appears immediately)
```
POST <claudette_url>/api/obstacles
Body: {
  "project_id": "<pm_project_id>",
  "description": "What is blocking you — be specific",
  "options": ["Option A — describe trade-offs", "Option B — describe trade-offs"],
  "recommendation": "Your recommended path and why",
  "workaround": "Any temporary workaround you can use right now",
  "needs_human": true,
  "urgency": "high",
  "status": "open"
}
```

### 4. Session End — REQUIRED every session
```
POST <claudette_url>/api/sessions
Body: {
  "project_id": "<pm_project_id>",
  "agent_id": "AGENT_A",
  "tasks_completed": ["Exact title of completed task"],
  "tasks_partial": ["Title of task started but unfinished"],
  "bugs_logged": ["Bug title if any"],
  "obstacles_logged": ["Blocker description if any"],
  "tokens_used_k": 45,
  "notes": "What was accomplished. What is next. Any decisions made.",
  "session_date": "<today YYYY-MM-DD>"
}
```

---

## Notes

_Add project-specific context here that helps the agent understand this codebase._
```

### Step 6 — Report back

Tell the user:
1. What you wrote (name, stack, path)
2. If `pm_project_id` is empty: "Open Claudette, create this project, then copy the project ID from the URL (`/projects/{id}`) into `pm_project_id` in `.claudepm.md`"
3. Add `.claudepm.md` to `.gitignore` if the repo is public (token is embedded)

Then ask ONE question:

> **"Want to generate a full development plan right now? I'll run /pm-plan — it autonomously researches your stack, brainstorms features, does web research, and produces a detailed session-windowed implementation plan with task assignments in Claudette. Start? (yes/no)"**

- If **yes**: invoke `/pm-plan` immediately
- If **no**: done — remind them they can run `/pm-plan` anytime

---

## Hard Rules

- Use the actual absolute path for `local_path` — run `pwd` (bash) or `Get-Location` (PowerShell)
- Stack tokens must be lowercase, no spaces (e.g. `nextjs` not `Next.js`)
- If the directory name is generic (`src`, `app`), use the parent directory name
- NEVER leave `claudette_url` or `claudette_token` empty if the user provides them
- Remind the user that the token is sensitive if the repo is public — add `.claudepm.md` to `.gitignore`
- The `/pm-plan` fast-track offer is a single yes/no — don't ask follow-up questions before invoking it
