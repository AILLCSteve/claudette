import { getOctokitForUser } from '@/lib/github/client'
import { createClient } from '@/lib/supabase/server'
import { generateMarkerFile } from '@/lib/pm/marker-parser'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId } = await request.json()

  const { data: project } = await supabase
    .from('projects')
    .select('*, tasks(*), obstacles(*), session_logs(*)')
    .eq('id', projectId)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (!project.github_repo) return NextResponse.json({ error: 'No GitHub repo configured for this project' }, { status: 400 })

  const octokit = await getOctokitForUser()
  if (!octokit) return NextResponse.json({ error: 'GitHub not connected. Re-authenticate with GitHub.' }, { status: 401 })

  const [owner, repo] = project.github_repo.split('/')
  if (!owner || !repo) return NextResponse.json({ error: 'Invalid github_repo format (expected owner/repo)' }, { status: 400 })

  // Get the repo's default branch so we can link to the correct blob URL
  let defaultBranch = 'main'
  try {
    const { data: repoData } = await octokit.repos.get({ owner, repo })
    defaultBranch = repoData.default_branch ?? 'main'
  } catch {
    // non-fatal — fall back to 'main'
  }

  // Get the user's first API token to embed in the marker file
  const { data: tokens } = await supabase
    .from('api_tokens')
    .select('token')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  const claudetteToken = tokens?.[0]?.token ?? ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? request.headers.get('origin')
    ?? ''

  const content = generateMarkerFile({
    ...project,
    claudette_url: appUrl,
    claudette_token: claudetteToken,
    tasks: project.tasks ?? [],
    obstacles: project.obstacles ?? [],
    session_logs: project.session_logs ?? [],
  })

  const encoded = Buffer.from(content).toString('base64')

  // Check if file already exists so we can update (requires SHA)
  let existingSha: string | undefined
  try {
    const { data: existing } = await octokit.repos.getContent({ owner, repo, path: '.claudepm.md' })
    if ('sha' in existing) existingSha = existing.sha
  } catch {
    // File doesn't exist yet — that's fine
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: '.claudepm.md',
    message: existingSha
      ? 'chore: update Claudette PM marker'
      : 'chore: add Claudette PM marker file',
    content: encoded,
    ...(existingSha ? { sha: existingSha } : {}),
  })

  return NextResponse.json({
    success: true,
    url: `https://github.com/${owner}/${repo}/blob/${defaultBranch}/.claudepm.md`,
    action: existingSha ? 'updated' : 'created',
  })
}
