'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff, AlertTriangle, Terminal, RefreshCw } from 'lucide-react'

interface Token { id: string; name: string; last_used_at: string | null; created_at: string }
interface NewToken extends Token { token: string }

function timeAgo(date: string | null) {
  if (!date) return 'Never'
  const d = new Date(date)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function SettingsPage() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [tokenName, setTokenName] = useState('')
  const [newToken, setNewToken] = useState<NewToken | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [appUrl, setAppUrl] = useState('')
  const [githubConnecting, setGithubConnecting] = useState(false)
  const [githubStatus, setGithubStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown')

  useEffect(() => {
    setAppUrl(window.location.origin)
    fetch('/api/tokens')
      .then(r => r.json())
      .then(data => setTokens(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
    fetch('/api/github/repos')
      .then(r => setGithubStatus(r.status === 401 ? 'disconnected' : 'connected'))
      .catch(() => setGithubStatus('disconnected'))
  }, [])

  const connectGithub = async () => {
    setGithubConnecting(true)
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
        scopes: 'repo read:org',
      },
    })
  }

  const createToken = async () => {
    if (!tokenName.trim()) return
    setCreating(true)
    const res = await fetch('/api/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: tokenName.trim() }),
    })
    const data = await res.json()
    setNewToken(data)
    setTokens(prev => [{ id: data.id, name: data.name, last_used_at: null, created_at: data.created_at }, ...prev])
    setTokenName('')
    setCreating(false)
    setRevealed(false)
  }

  const revokeToken = async (id: string) => {
    await fetch(`/api/tokens/${id}`, { method: 'DELETE' })
    setTokens(prev => prev.filter(t => t.id !== id))
    if (newToken?.id === id) setNewToken(null)
  }

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const agentInstructions = appUrl && newToken ? `# Claudette PM Integration

## API Config
CLAUDETTE_URL=${appUrl}
CLAUDETTE_TOKEN=${newToken.token}

## Session Start
Read your current tasks and open obstacles before beginning work:
  GET ${appUrl}/api/tasks?project_id=YOUR_PROJECT_ID&status=ready
  GET ${appUrl}/api/obstacles?project_id=YOUR_PROJECT_ID&status=open&needs_human=false

## During Work
Update task status as you progress:
  PATCH ${appUrl}/api/tasks/TASK_ID
  Body: { "status": "in-progress" }   # or "done", "blocked"

Log bugs you encounter:
  POST ${appUrl}/api/bugs
  Body: { "project_id": "...", "title": "...", "description": "...", "severity": "medium", "status": "open" }

## Escalate Blockers
When you need human input, POST to obstacles with needs_human: true.
This surfaces immediately in the PM's Decision Inbox:
  POST ${appUrl}/api/obstacles
  Body: {
    "project_id": "...",
    "description": "What is blocking you",
    "options": ["Option A", "Option B"],
    "recommendation": "Your recommended path",
    "workaround": "Any temporary workaround",
    "needs_human": true,
    "urgency": "high",
    "status": "open"
  }

## Session End (REQUIRED)
Log every session so the PM can see what was accomplished:
  POST ${appUrl}/api/sessions
  Body: {
    "project_id": "...",
    "agent_id": "...",
    "tasks_completed": ["task title 1", "task title 2"],
    "tasks_partial": ["task in progress"],
    "bugs_logged": ["bug title"],
    "obstacles_logged": ["blocker description"],
    "tokens_used_k": 45,
    "notes": "Brief summary of what was done and what's next",
    "session_date": "${new Date().toISOString().split('T')[0]}"
  }

## Auth Header (required on all requests)
Authorization: Bearer ${newToken.token}` : ''

  return (
    <div className="flex flex-col h-full">
      <Header title="Settings" description="API tokens & integrations" />
      <div className="flex-1 overflow-auto p-6 space-y-8 max-w-2xl">

        {/* API Tokens section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Key className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-medium">API Tokens</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Tokens let Claude Code agents authenticate against this dashboard without a browser session.
            Tokens are shown <strong className="text-foreground">once</strong> at creation — copy it immediately.
          </p>

          {/* Create token */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={tokenName}
              onChange={e => setTokenName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createToken()}
              placeholder="Token name (e.g. AGENT_A, laptop)"
              className="flex-1 h-8 px-3 rounded-md bg-secondary/50 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
            />
            <Button size="sm" className="h-8 gap-1.5" onClick={createToken} disabled={creating || !tokenName.trim()}>
              <Plus className="h-3.5 w-3.5" />
              Generate
            </Button>
          </div>

          {/* New token reveal */}
          {newToken && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4 mb-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-emerald-400" />
                <p className="text-xs font-medium text-emerald-400">Copy this token now — it won&apos;t be shown again</p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-secondary/60 rounded px-3 py-2 text-foreground break-all">
                  {revealed ? newToken.token : '•'.repeat(20) + newToken.token.slice(-8)}
                </code>
                <button onClick={() => setRevealed(r => !r)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                  {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button onClick={() => copy(newToken.token, 'token')} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                  {copied === 'token' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Token list */}
          <div className="bg-card border border-border/60 rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-4 text-xs text-muted-foreground">Loading…</div>
            ) : tokens.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">No tokens yet</div>
            ) : (
              <div className="divide-y divide-border/40">
                {tokens.map(t => (
                  <div key={t.id} className="px-4 py-3 flex items-center gap-3">
                    <Key className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(t.created_at).toLocaleDateString()} · Last used {timeAgo(t.last_used_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => revokeToken(t.id)}
                      className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                      title="Revoke token"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick start guide */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-medium">Agent Integration</h2>
          </div>

          <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
            <div className="bg-card border border-border/60 rounded-lg p-4 space-y-2">
              <p className="text-foreground font-medium text-[11px] uppercase tracking-wide">Setup flow</p>
              <ol className="space-y-1.5 list-decimal list-inside">
                <li>Generate a token above and copy it</li>
                <li>Run <code className="bg-secondary px-1 rounded font-mono">/pm-init</code> in your project directory — it will prompt for the token and this app&apos;s URL</li>
                <li>Import the project here via <strong className="text-foreground">New Project → Import from GitHub</strong> or paste the <code className="bg-secondary px-1 rounded font-mono">.claudepm.md</code></li>
                <li>Claude Code reads <code className="bg-secondary px-1 rounded font-mono">.claudepm.md</code> at session start and uses the token to report back here automatically</li>
              </ol>
            </div>

            <div className="bg-card border border-border/60 rounded-lg p-4 space-y-2">
              <p className="text-foreground font-medium text-[11px] uppercase tracking-wide">What agents report back</p>
              <ul className="space-y-1">
                <li>· Task status updates (backlog → in-progress → done)</li>
                <li>· Bugs discovered during development</li>
                <li>· Blockers that need your decision (surfaces in Inbox)</li>
                <li>· Session summaries (what was done, tokens used)</li>
                <li>· Project health updates</li>
              </ul>
            </div>

            {newToken && agentInstructions && (
              <div className="bg-card border border-border/60 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
                  <p className="text-foreground font-medium text-[11px] uppercase tracking-wide">Agent API Reference</p>
                  <button onClick={() => copy(agentInstructions, 'instructions')}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                    {copied === 'instructions' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span className="text-[11px]">Copy</span>
                  </button>
                </div>
                <pre className="p-4 text-[11px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {agentInstructions}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* GitHub */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <h2 className="text-sm font-medium">GitHub</h2>
          </div>
          <div className="bg-card border border-border/60 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {githubStatus === 'connected' ? 'Connected' : githubStatus === 'disconnected' ? 'Not connected' : 'Checking…'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {githubStatus === 'connected'
                  ? 'GitHub is connected — repo import and push to GitHub are available.'
                  : 'Connect GitHub to import repos and push marker files directly.'}
              </p>
            </div>
            <Button
              size="sm"
              variant={githubStatus === 'connected' ? 'outline' : 'default'}
              className="gap-1.5 shrink-0 ml-4"
              onClick={connectGithub}
              disabled={githubConnecting}
            >
              {githubConnecting
                ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                : githubStatus === 'connected'
                  ? 'Reconnect'
                  : 'Connect GitHub'}
            </Button>
          </div>
        </div>

        {/* App URL */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-medium">App URL</h2>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-card border border-border/60 rounded px-3 py-2 text-foreground">
              {appUrl || '…'}
            </code>
            <button onClick={() => copy(appUrl, 'url')} className="text-muted-foreground hover:text-foreground transition-colors">
              {copied === 'url' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Use this as <code className="bg-secondary px-1 rounded font-mono">claudette_url</code> in your <code className="bg-secondary px-1 rounded font-mono">.claudepm.md</code> files.
            On Render, this will be your <code className="bg-secondary px-1 rounded font-mono">*.onrender.com</code> URL.
          </p>
        </div>
      </div>
    </div>
  )
}
