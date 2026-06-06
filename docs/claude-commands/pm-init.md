You are initializing a Claudette PM project marker file for the current working directory.

## What to do

1. **Read the project structure** — list files in the current directory to understand what kind of project this is (package.json, pyproject.toml, Cargo.toml, go.mod, etc.)

2. **Detect the stack** — identify the languages, frameworks, and key libraries used. Keep it as a comma-separated list of short tokens (e.g. `typescript,react,nextjs,supabase`).

3. **Read any existing README** or top-level documentation to understand the project's purpose.

4. **Check if `.claudepm.md` already exists** in the current directory. If it does, read it and update the fields rather than overwriting.

5. **Ask the user for two things** (if not already in `.claudepm.md`):
   - Their Claudette app URL (e.g. `http://localhost:3000` or `https://myapp.onrender.com`)
   - Their Claudette API token (generated at Settings → API Tokens in the dashboard)

6. **Write `.claudepm.md`** to the current directory:

```
---
claudepm: "1.0"
name: "<project name>"
description: "<one sentence>"
stack: "<comma-separated tech stack>"
health: "idle"
agent: ""
sprint_goal: ""
local_path: "<absolute path of current directory>"
pm_project_id: ""
github_repo: ""
claudette_url: "<url from user>"
claudette_token: "<token from user>"
---

# <Project Name> — Project Context

## Claudette PM Integration

This project reports to a Claudette PM dashboard. At the start of EVERY session:
1. Read this file to orient yourself
2. Check open obstacles: GET {claudette_url}/api/obstacles?project_id={pm_project_id}&status=open&needs_human=false
3. Check your task queue: GET {claudette_url}/api/tasks?project_id={pm_project_id}&status=ready

Auth header on all requests: Authorization: Bearer {claudette_token}

## During Work

Update task status as you progress:
  PATCH {claudette_url}/api/tasks/{task_id}
  Body: { "status": "in-progress" }  →  "done"  →  "blocked"

Log bugs when found:
  POST {claudette_url}/api/bugs
  Body: { "project_id": "{pm_project_id}", "title": "...", "description": "...", "severity": "medium", "status": "open" }

## Escalate Blockers → PM Decision Inbox

When you need human input, post with needs_human: true — appears immediately in the dashboard Inbox:
  POST {claudette_url}/api/obstacles
  Body: {
    "project_id": "{pm_project_id}",
    "description": "What is blocking you",
    "options": ["Option A", "Option B"],
    "recommendation": "Your recommended path",
    "workaround": "Any temporary workaround",
    "needs_human": true,
    "urgency": "high",
    "status": "open"
  }

## End Every Session (REQUIRED)

  POST {claudette_url}/api/sessions
  Body: {
    "project_id": "{pm_project_id}",
    "agent_id": "<agent id>",
    "tasks_completed": ["task titles finished"],
    "tasks_partial": ["tasks started"],
    "bugs_logged": ["bugs reported"],
    "obstacles_logged": ["blockers escalated"],
    "tokens_used_k": 45,
    "notes": "What was done and what is next",
    "session_date": "<YYYY-MM-DD>"
  }

## Notes

_Add project-specific context here._
```

7. **Report back** what you wrote and tell the user to:
   - Open Claudette in their browser and create/import this project
   - Copy the project ID from the URL (`/projects/{id}`) into `pm_project_id` in `.claudepm.md`
   - Add `.claudepm.md` to `.gitignore` if the token should stay private

## Notes

- Use the actual absolute path for `local_path`
- Leave `pm_project_id` empty — user fills it after creating the project in the dashboard
- Remind the user the token is sensitive if the repo is public
