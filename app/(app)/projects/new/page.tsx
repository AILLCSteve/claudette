'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Loader2, FolderOpen, GitBranch, Search,
  Lock, Star, Globe, Check, Plus
} from 'lucide-react'

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Repo {
  id: number
  name: string
  full_name: string
  description: string | null
  language: string | null
  stargazers_count: number
  updated_at: string | null
  private: boolean
  topics: string[]
}

const STACK_SUGGESTIONS = [
  'TypeScript', 'JavaScript', 'Python', 'Go', 'Rust',
  'React', 'Next.js', 'Vue', 'Svelte',
  'Node.js', 'FastAPI', 'Django',
  'Supabase', 'PostgreSQL', 'MongoDB',
  'Tailwind CSS', 'Docker',
]

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5',
  Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516', Java: '#b07219',
  'C#': '#178600', 'C++': '#f34b7d', Swift: '#F05138', Kotlin: '#A97BFF',
  CSS: '#563d7c', HTML: '#e34c26', Shell: '#89e051',
}

function timeAgo(date: string | null) {
  if (!date) return ''
  const d = new Date(date)
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export default function NewProjectPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'github' | 'manual'>('github')
  const [connectingGithub, setConnectingGithub] = useState(false)

  // GitHub state
  const [repos, setRepos] = useState<Repo[]>([])
  const [reposLoading, setReposLoading] = useState(true)
  const [githubError, setGithubError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Repo | null>(null)

  // Form state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', description: '', stack_input: '', local_path: '', sprint_goal: '',
  })

  useEffect(() => {
    fetch('/api/github/repos')
      .then(r => {
        if (r.status === 401) throw new Error('no_token')
        return r.json()
      })
      .then(setRepos)
      .catch(e => {
        if (e.message === 'no_token') setGithubError('no_token')
        else setGithubError('Failed to load repositories')
      })
      .finally(() => setReposLoading(false))
  }, [])

  const connectGithub = async () => {
    setConnectingGithub(true)
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/projects/new`,
        scopes: 'repo read:org',
      },
    })
  }

  const selectRepo = (repo: Repo) => {
    setSelected(repo)
    const stack: string[] = []
    if (repo.language) stack.push(repo.language)
    repo.topics.slice(0, 4).forEach(t => {
      const match = STACK_SUGGESTIONS.find(s => s.toLowerCase() === t.toLowerCase())
      if (match && !stack.includes(match)) stack.push(match)
    })
    setForm({
      name: repo.name,
      description: repo.description ?? '',
      stack_input: stack.join(', '),
      local_path: '',
      sprint_goal: '',
    })
  }

  const addStackTag = (tag: string) => {
    const tags = form.stack_input.split(',').map(t => t.trim()).filter(Boolean)
    if (!tags.includes(tag)) setForm(f => ({ ...f, stack_input: [...tags, tag].join(', ') }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)
    setError(null)
    const stack = form.stack_input.split(',').map(t => t.trim()).filter(Boolean)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          stack,
          local_path: form.local_path.trim(),
          github_repo: selected?.full_name ?? '',
          sprint_goal: form.sprint_goal.trim(),
          health: 'idle',
          token_budget_k: 200,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create project')
      router.push(`/projects/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }

  const filtered = repos.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      <Header title="New Project" />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to portfolio
          </Link>

          {/* Tab switcher */}
          <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 mb-6 w-fit">
            {(['github', 'manual'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-4 py-1.5 rounded-md text-xs font-medium transition-all',
                  tab === t
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t === 'github' ? (
                  <span className="flex items-center gap-1.5"><GithubIcon className="h-3.5 w-3.5" />Import from GitHub</span>
                ) : (
                  <span className="flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" />Create manually</span>
                )}
              </button>
            ))}
          </div>

          {/* ── GITHUB TAB ── */}
          {tab === 'github' && (
            <div className="space-y-4">
              {githubError === 'no_token' ? (
                <div className="border border-dashed border-border/60 rounded-lg p-10 flex flex-col items-center gap-3 text-center">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <GithubIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Connect your GitHub account</p>
                    <p className="text-xs text-muted-foreground mt-1">Sign in with GitHub to import your repositories</p>
                  </div>
                  <Button size="sm" className="mt-1" onClick={connectGithub} disabled={connectingGithub}>
                    {connectingGithub ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Connecting…</> : 'Connect GitHub'}
                  </Button>
                </div>
              ) : (
                <>
                  {/* Repo picker */}
                  <div className="bg-card border border-border/60 rounded-lg overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-border/60">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                        <input
                          type="text"
                          placeholder="Search repositories…"
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          className="w-full pl-8 pr-3 h-8 bg-secondary/50 rounded-md text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                        />
                      </div>
                    </div>

                    <div className="divide-y divide-border/40 max-h-80 overflow-y-auto">
                      {reposLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
                            <div className="h-3 bg-secondary rounded w-1/3" />
                            <div className="h-3 bg-secondary rounded w-1/2 ml-auto" />
                          </div>
                        ))
                      ) : githubError ? (
                        <div className="px-4 py-6 text-center text-xs text-muted-foreground">{githubError}</div>
                      ) : filtered.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-muted-foreground">No repositories found</div>
                      ) : filtered.map(repo => {
                        const isSelected = selected?.id === repo.id
                        return (
                          <button
                            key={repo.id}
                            onClick={() => selectRepo(repo)}
                            className={cn(
                              'w-full px-4 py-3 flex items-start gap-3 text-left transition-colors',
                              isSelected
                                ? 'bg-primary/8'
                                : 'hover:bg-white/[0.03]'
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground truncate">{repo.name}</span>
                                {repo.private ? (
                                  <Lock className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                ) : (
                                  <Globe className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                )}
                              </div>
                              {repo.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">{repo.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-1.5">
                                {repo.language && (
                                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <span
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: LANG_COLORS[repo.language] ?? '#888' }}
                                    />
                                    {repo.language}
                                  </span>
                                )}
                                {repo.stargazers_count > 0 && (
                                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Star className="h-3 w-3" />
                                    {repo.stargazers_count}
                                  </span>
                                )}
                                <span className="text-[11px] text-muted-foreground/60">{timeAgo(repo.updated_at)}</span>
                              </div>
                            </div>
                            {isSelected && <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Form shown after selection */}
                  {selected && (
                    <form onSubmit={handleSubmit} className="bg-card border border-border/60 rounded-lg p-5 space-y-4">
                      <div className="flex items-center gap-2 pb-1">
                        <GitBranch className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs text-primary font-medium">{selected.full_name}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground/80">Project Name</label>
                          <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full h-8 px-3 rounded-md bg-secondary/50 border border-border/60 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground/80">Sprint Goal</label>
                          <input
                            type="text"
                            value={form.sprint_goal}
                            onChange={e => setForm(f => ({ ...f, sprint_goal: e.target.value }))}
                            placeholder="Ship MVP by Friday"
                            className="w-full h-8 px-3 rounded-md bg-secondary/50 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground/80">Description</label>
                        <textarea
                          value={form.description}
                          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                          rows={2}
                          className="w-full px-3 py-2 rounded-md bg-secondary/50 border border-border/60 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors resize-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground/80">Stack</label>
                        <input
                          type="text"
                          value={form.stack_input}
                          onChange={e => setForm(f => ({ ...f, stack_input: e.target.value }))}
                          placeholder="TypeScript, React…"
                          className="w-full h-8 px-3 rounded-md bg-secondary/50 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                        />
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {STACK_SUGGESTIONS.map(tag => (
                            <button key={tag} type="button" onClick={() => addStackTag(tag)}
                              className="text-[11px] font-mono px-2 py-0.5 rounded bg-secondary border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors">
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
                          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground/60" />Local Path
                        </label>
                        <input
                          type="text"
                          value={form.local_path}
                          onChange={e => setForm(f => ({ ...f, local_path: e.target.value }))}
                          placeholder="/Users/you/projects/my-project"
                          className="w-full h-8 px-3 rounded-md bg-secondary/50 border border-border/60 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                        />
                      </div>

                      {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                          <p className="text-xs text-red-400">{error}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <Button type="submit" size="sm" disabled={loading || !form.name.trim()} className="h-8">
                          {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Creating…</> : 'Import Project'}
                        </Button>
                        <button type="button" onClick={() => setSelected(null)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── MANUAL TAB ── */}
          {tab === 'manual' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/80">
                  Project Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="My Awesome Project"
                  autoFocus
                  className="w-full h-9 px-3 rounded-md bg-secondary/50 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/80">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What does this project do?"
                  rows={3}
                  className="w-full px-3 py-2 rounded-md bg-secondary/50 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/80">Tech Stack</label>
                <input
                  type="text"
                  value={form.stack_input}
                  onChange={e => setForm(f => ({ ...f, stack_input: e.target.value }))}
                  placeholder="TypeScript, React, Supabase…"
                  className="w-full h-9 px-3 rounded-md bg-secondary/50 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {STACK_SUGGESTIONS.map(tag => (
                    <button key={tag} type="button" onClick={() => addStackTag(tag)}
                      className="text-[11px] font-mono px-2 py-0.5 rounded bg-secondary border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors">
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border/60 pt-4 space-y-4">
                <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wide">Optional</p>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
                    <FolderOpen className="h-3.5 w-3.5 text-muted-foreground/60" />Local Path
                  </label>
                  <input
                    type="text"
                    value={form.local_path}
                    onChange={e => setForm(f => ({ ...f, local_path: e.target.value }))}
                    placeholder="/Users/you/projects/my-project"
                    className="w-full h-9 px-3 rounded-md bg-secondary/50 border border-border/60 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                  />
                  <p className="text-[11px] text-muted-foreground/50">
                    Run <code className="bg-secondary px-1 rounded font-mono">/pm-init</code> in your terminal to auto-detect.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5 text-muted-foreground/60" />GitHub Repo
                  </label>
                  <input
                    type="text"
                    placeholder="owner/repo"
                    className="w-full h-9 px-3 rounded-md bg-secondary/50 border border-border/60 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground/80">Sprint Goal</label>
                  <input
                    type="text"
                    value={form.sprint_goal}
                    onChange={e => setForm(f => ({ ...f, sprint_goal: e.target.value }))}
                    placeholder="Ship the MVP by Friday"
                    className="w-full h-9 px-3 rounded-md bg-secondary/50 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" size="sm" disabled={loading || !form.name.trim()} className="h-8">
                  {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Creating…</> : 'Create Project'}
                </Button>
                <Link href="/"><Button type="button" size="sm" variant="ghost" className="h-8 text-muted-foreground">Cancel</Button></Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
