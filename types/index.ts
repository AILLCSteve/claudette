export type Health = 'on-track' | 'blocked' | 'needs-attention' | 'idle'
export type TaskStatus = 'backlog' | 'ready' | 'in-progress' | 'blocked' | 'done'
export type BugStatus = 'open' | 'in-progress' | 'resolved'
export type ObstacleStatus = 'open' | 'assumed' | 'cleared'
export type Urgency = 'low' | 'medium' | 'high'
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type Severity = 'low' | 'medium' | 'high' | 'critical'
export type DevPlanStatus = 'draft' | 'active' | 'completed' | 'archived'
export type DevPlanTaskStatus = 'pending' | 'in-progress' | 'blocked' | 'done' | 'skipped'

export interface Project {
  id: string
  user_id: string
  name: string
  description: string
  health: Health
  stack: string[]
  repo_url: string
  github_repo: string
  sprint_goal: string
  sprint_end: string | null
  token_budget_k: number
  agent_assigned: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  project_id: string
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  assigned_agent: string
  estimated_tokens_k: number
  session_window: number
  created_at: string
  updated_at: string
}

export interface Bug {
  id: string
  project_id: string
  title: string
  description: string
  status: BugStatus
  severity: Severity
  created_at: string
  updated_at: string
}

export interface Obstacle {
  id: string
  project_id: string
  description: string
  options: string[]
  recommendation: string
  workaround: string
  status: ObstacleStatus
  needs_human: boolean
  urgency: Urgency
  created_at: string
  updated_at: string
}

export interface SessionLog {
  id: string
  project_id: string
  agent_id: string
  tasks_completed: string[]
  tasks_partial: string[]
  bugs_logged: string[]
  obstacles_logged: string[]
  tokens_used_k: number
  notes: string
  session_date: string
  created_at: string
}

export interface Decision {
  id: string
  project_id: string
  title: string
  rationale: string
  created_at: string
}

export interface Agent {
  id: string
  user_id: string
  agent_key: string
  name: string
  domain: string
  account_email: string
  color: string
  session_budget_k: number
  created_at: string
}

export interface SessionQueue {
  id: string
  user_id: string
  agent_id: string
  project_id: string | null
  tasks: string[]
  notes: string
  updated_at: string
}

export interface DevPlan {
  id: string
  project_id: string
  title: string
  overview: string
  status: DevPlanStatus
  total_sessions_estimated: number
  created_at: string
  updated_at: string
}

export interface DevPlanTask {
  id: string
  dev_plan_id: string
  title: string
  description: string
  acceptance_criteria: string[]
  depends_on: string[]
  assigned_agent: string
  estimated_tokens_k: number
  session_window: number
  status: DevPlanTaskStatus
  position: number
  created_at: string
  updated_at: string
}

export interface TokenBudgetState {
  sessionBudgetK: number
  tokensUsedK: number
  tokensRemainingK: number
  warningThresholdK: number
  shutdownThresholdK: number
  isWarning: boolean
  isCritical: boolean
  percentUsed: number
}
