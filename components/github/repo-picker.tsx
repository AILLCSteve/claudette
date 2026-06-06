'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { GitBranch, Search } from 'lucide-react'

interface RepoSummary {
  id: number
  name: string
  full_name: string
  description: string | null
  language: string | null
  updated_at: string | null
  private: boolean
}

interface RepoPickerProps {
  onSelect: (repo: RepoSummary) => void
}

export function RepoPicker({ onSelect }: RepoPickerProps) {
  const [repos, setRepos] = useState<RepoSummary[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/github/repos')
      .then(r => r.json())
      .then(data => { setRepos(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = repos.filter(r =>
    r.name.toLowerCase().includes(filter.toLowerCase()) ||
    (r.description ?? '').toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search repositories..."
          className="pl-8"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading repositories...</p>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {filtered.map(repo => (
            <button
              key={repo.id}
              onClick={() => onSelect(repo)}
              className="w-full text-left flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium">{repo.name}</span>
                {repo.private && <Badge variant="secondary" className="text-xs">private</Badge>}
              </div>
              {repo.language && (
                <span className="text-xs text-muted-foreground">{repo.language}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
