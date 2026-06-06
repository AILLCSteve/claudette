import { Octokit } from '@octokit/rest'
import { createClient } from '@/lib/supabase/server'

export async function getOctokitForUser(): Promise<Octokit | null> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const githubToken = session?.provider_token
  if (!githubToken) return null

  return new Octokit({ auth: githubToken })
}

export interface RepoSummary {
  id: number
  name: string
  full_name: string
  description: string | null
  language: string | null
  stargazers_count: number
  updated_at: string | null
  html_url: string
  private: boolean
  topics: string[]
}
