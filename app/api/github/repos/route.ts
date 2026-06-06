import { getOctokitForUser } from '@/lib/github/client'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const octokit = await getOctokitForUser()
  if (!octokit) return NextResponse.json({ error: 'GitHub token not available. Re-authenticate with GitHub.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '1')

  const { data: repos } = await octokit.repos.listForAuthenticatedUser({
    sort: 'updated',
    per_page: 30,
    page,
  })

  const summaries = repos.map(r => ({
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    description: r.description,
    language: r.language,
    stargazers_count: r.stargazers_count,
    updated_at: r.updated_at,
    html_url: r.html_url,
    private: r.private,
    topics: r.topics ?? [],
  }))

  return NextResponse.json(summaries)
}
