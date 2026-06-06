# /pm-update — Sync Marker File with Live Claudette State

You are updating the `.claudepm.md` marker file for the current project with fresh data from the Claudette PM dashboard.

---

## What to do

### Step 1 — Read Current Marker File

Read `.claudepm.md` in the current directory. Extract:
- `claudette_url` — the Claudette dashboard URL
- `claudette_token` — the API token
- `pm_project_id` — the project ID

If any of these are missing or empty, stop and tell the user to run `/pm-init` first.

### Step 2 — Fetch Live Project State

Make all three requests in parallel:

```
GET {claudette_url}/api/projects/{pm_project_id}
Authorization: Bearer {claudette_token}

GET {claudette_url}/api/tasks?project_id={pm_project_id}
Authorization: Bearer {claudette_token}

GET {claudette_url}/api/obstacles?project_id={pm_project_id}&status=open
Authorization: Bearer {claudette_token}

GET {claudette_url}/api/sessions?project_id={pm_project_id}&limit=3
Authorization: Bearer {claudette_token}
```

### Step 3 — Rewrite .claudepm.md

Write a new `.claudepm.md` with the following structure (this is the v2.0 format):

```
---
claudepm: "2.0"
name: "{project.name}"
description: "{project.description}"
stack: "{project.stack joined by comma}"
health: "{project.health}"
agent: "{project.agent_assigned}"
sprint_goal: "{project.sprint_goal}"
local_path: "{current absolute path — run pwd/Get-Location}"
pm_project_id: "{pm_project_id}"
github_repo: "{project.github_repo}"
claudette_url: "{claudette_url}"
claudette_token: "{claudette_token}"
token_budget_k: {project.token_budget_k}
tokens_used_k: {project.tokens_used_k}
updated_at: "{current ISO timestamp}"
---

# {project.name} — Project Context
> Claudette PM: {claudette_url}/projects/{pm_project_id}
> Sprint Goal: {project.sprint_goal}

---

## Claudette API Playbook

**Base:** `{claudette_url}`
**Auth header (every request):** `Authorization: Bearer {claudette_token}`

### 1. Session Start — Read BEFORE doing any work
```
GET {claudette_url}/api/tasks?project_id={pm_project_id}&status=ready
GET {claudette_url}/api/obstacles?project_id={pm_project_id}&status=open&needs_human=false
Authorization: Bearer {claudette_token}
```

### 2. During Work — Update as you go
```
# Claim a task
PATCH {claudette_url}/api/tasks/{task_id}
Body: { "status": "in-progress" }

# Complete a task
PATCH {claudette_url}/api/tasks/{task_id}
Body: { "status": "done" }

# Log a bug
POST {claudette_url}/api/bugs
Body: { "project_id": "{pm_project_id}", "title": "...", "description": "...", "severity": "medium", "status": "open" }
```

### 3. Escalate Blockers → PM Inbox (appears immediately)
```
POST {claudette_url}/api/obstacles
Body: {
  "project_id": "{pm_project_id}",
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
POST {claudette_url}/api/sessions
Body: {
  "project_id": "{pm_project_id}",
  "agent_id": "AGENT_A",
  "tasks_completed": ["Exact title of completed task"],
  "tasks_partial": ["Title of task started but unfinished"],
  "bugs_logged": ["Bug title if any"],
  "obstacles_logged": ["Blocker description if any"],
  "tokens_used_k": 45,
  "notes": "What was accomplished. What is next. Any decisions made.",
  "session_date": "{today YYYY-MM-DD}"
}
```

---

## Current Sprint

_health: {project.health} | {project.tokens_used_k}K / {project.token_budget_k}K tokens_

[For each status group: in-progress, ready, blocked, backlog, done — only include non-empty groups]

### ⚡ In Progress ({count})
[For each in-progress task:]
- `{task.id first 8 chars}` 🟠 [{task.priority}] {task.title} → **{task.assigned_agent}**

### ▶ Ready to Work ({count})
[For each ready task:]
- `{task.id first 8 chars}` {priority icon} [{task.priority}] {task.title} → **{task.assigned_agent}**

### 🔒 Blocked ({count})
[For each blocked task:]
- `{task.id first 8 chars}` 🔴 [{task.priority}] {task.title}

### ○ Backlog ({count})
[For each backlog task:]
- `{task.id first 8 chars}` ⚪ [{task.priority}] {task.title}

[Omit Done section unless user asks for it — it's noise]

---

## ⚠️ Open Blockers — Needs Human Decision
[Only if any obstacles have needs_human: true]
- **[{urgency.toUpperCase()}]** {obstacle.description}
  - Rec: {obstacle.recommendation}

---

## Recent Sessions
[For each of the 3 most recent session logs:]
### {agent_id} — {session_date} · {tokens_used_k}K tokens
{tasks_completed joined by ", "}
{notes}

---

## Notes

_Add project-specific context here that helps the agent understand this codebase._
[Preserve any existing content from the ## Notes section of the old .claudepm.md]
```

**Priority icons:**
- critical → 🔴
- high → 🟠
- medium → 🟡
- low → ⚪

### Step 4 — Report What Changed

Show a summary:
```
✅ .claudepm.md updated

  Health:    {old} → {new}
  Tasks:     {ready} ready, {in-progress} in progress, {blocked} blocked, {done} done
  Obstacles: {count needing human} need your decision
  Budget:    {tokens_used_k}K / {token_budget_k}K used
  Updated:   {timestamp}
```

Then ask: **"Push updated marker to GitHub? (yes/no)"**
- If yes: push via `gh` CLI or `git add .claudepm.md && git commit -m "chore: update claudepm marker" && git push`
- If no: done

---

## Hard Rules

- NEVER lose the user's existing `## Notes` content — always preserve it verbatim
- NEVER expose the `claudette_token` in any output shown to the user — it's in the file but don't print it
- If any Claudette API call fails with 401: tell the user their token may be expired and they need to generate a new one in Settings → API Tokens
- If `pm_project_id` is empty: stop, tell the user to link this project in Claudette first
- If the session logs endpoint 404s (not all deployments have it): skip the Recent Sessions section, don't fail
