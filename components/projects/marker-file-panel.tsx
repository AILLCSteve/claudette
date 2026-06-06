'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Copy, Check, Upload, RefreshCw, GitBranch, ExternalLink } from 'lucide-react'
import { generateMarkerFile, type RichProject } from '@/lib/pm/marker-parser'

interface Props {
  project: RichProject
}

export function MarkerFilePanel({ project }: Props) {
  const [copied, setCopied] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importContent, setImportContent] = useState('')
  const [importResult, setImportResult] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [pushResult, setPushResult] = useState<{ url?: string; action?: string; error?: string; needsGithubAuth?: boolean } | null>(null)
  const [githubConnecting, setGithubConnecting] = useState(false)
  const [appUrl, setAppUrl] = useState('')
  const [claudetteToken, setClaudetteToken] = useState('')

  useEffect(() => {
    setAppUrl(window.location.origin)
    // Check if any tokens exist — we show a placeholder in the display
    // (actual token is embedded server-side when pushing to GitHub)
    fetch('/api/tokens')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setClaudetteToken('cldt_your_token_here')
      })
      .catch(() => {})
  }, [])

  const richProject: RichProject = {
    ...project,
    claudette_url: appUrl || undefined,
    claudette_token: claudetteToken || undefined,
  }

  const markerContent = generateMarkerFile(richProject)

  const copy = async () => {
    await navigator.clipboard.writeText(markerContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const pushToGithub = async () => {
    setPushing(true)
    setPushResult(null)
    try {
      const res = await fetch('/api/github/push-marker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        const needsGithubAuth = res.status === 401 && data.error?.toLowerCase().includes('github')
        setPushResult({ error: data.error, needsGithubAuth })
      } else {
        setPushResult({ url: data.url, action: data.action })
      }
    } catch {
      setPushResult({ error: 'Network error' })
    } finally {
      setPushing(false)
    }
  }

  const reconnectGithub = async () => {
    setGithubConnecting(true)
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${window.location.pathname}`,
        scopes: 'repo read:org',
      },
    })
  }

  const handleImport = async () => {
    if (!importContent.trim()) return
    setImporting(true)
    setImportResult('')
    try {
      const res = await fetch('/api/projects/import-marker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: importContent }),
      })
      const data = await res.json()
      if (!res.ok) setImportResult(`Error: ${data.error}`)
      else {
        setImportResult(`Project ${data.action}: ${data.project.name}`)
        setImportContent('')
      }
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Project Marker File</h3>
        <p className="text-xs text-muted-foreground">
          This file gives Claude Code full context about this project and how to report back to Claudette.
          Push it to your repo or run <code className="bg-secondary px-1 rounded font-mono">/pm-init</code> locally.
          Update it anytime with <code className="bg-secondary px-1 rounded font-mono">/pm-update</code>.
        </p>
      </div>

      <div className="relative">
        <Button
          size="sm"
          variant="ghost"
          className="absolute top-2 right-2 h-6 w-6 p-0 z-10"
          onClick={copy}
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        </Button>
        <Textarea
          value={markerContent}
          readOnly
          className="font-mono text-xs h-96 resize-none pr-10 bg-secondary/50 border-border/60"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="gap-1.5 text-xs border-border/60" onClick={copy}>
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>

        {project.github_repo && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-border/60"
            onClick={pushToGithub}
            disabled={pushing}
          >
            {pushing
              ? <RefreshCw className="h-3 w-3 animate-spin" />
              : <GitBranch className="h-3 w-3" />}
            {pushing ? 'Pushing…' : 'Push to GitHub'}
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs border-border/60"
          onClick={() => setShowImport(v => !v)}
        >
          <Upload className="h-3 w-3" />
          Import
        </Button>
      </div>

      {/* Push result */}
      {pushResult && (
        <div className={`rounded-md px-3 py-2 text-xs flex items-center gap-2 ${
          pushResult.error
            ? 'bg-red-500/10 border border-red-500/20 text-red-400'
            : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
        }`}>
          {pushResult.error ? (
            <>
              <span className="flex-1">{pushResult.error}</span>
              {pushResult.needsGithubAuth && (
                <button
                  onClick={reconnectGithub}
                  disabled={githubConnecting}
                  className="ml-auto shrink-0 flex items-center gap-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded px-2 py-1 text-red-300 hover:text-red-200 transition-colors"
                >
                  {githubConnecting ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                  Reconnect GitHub
                </button>
              )}
            </>
          ) : (
            <>
              <Check className="h-3 w-3 shrink-0" />
              <span>File {pushResult.action} in repo</span>
              {pushResult.url && (
                <a href={pushResult.url} target="_blank" rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 hover:text-emerald-300">
                  View <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </>
          )}
        </div>
      )}

      {!project.github_repo && (
        <p className="text-xs text-muted-foreground/60">
          Add a GitHub repo to this project to enable one-click push.
        </p>
      )}

      {/* Import panel */}
      {showImport && (
        <div className="space-y-2 border border-border/60 rounded-lg p-3 bg-secondary/20">
          <p className="text-xs text-muted-foreground">
            Paste a <code className="bg-secondary px-1 rounded font-mono">.claudepm.md</code> file to create or update a project.
          </p>
          <Textarea
            value={importContent}
            onChange={e => setImportContent(e.target.value)}
            placeholder="Paste .claudepm.md content here..."
            className="font-mono text-xs h-40 resize-none bg-secondary/50 border-border/60"
          />
          {importResult && (
            <p className={`text-xs ${importResult.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
              {importResult}
            </p>
          )}
          <Button size="sm" onClick={handleImport} disabled={importing || !importContent.trim()} className="gap-1.5 text-xs h-7">
            {importing && <RefreshCw className="h-3 w-3 animate-spin" />}
            Import
          </Button>
        </div>
      )}
    </div>
  )
}
