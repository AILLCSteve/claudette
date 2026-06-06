import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseMarkerFile } from '@/lib/pm/marker-parser'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content } = await req.json()
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const parsed = parseMarkerFile(content)
  if (!parsed) return NextResponse.json({ error: 'Invalid .claudepm.md — missing frontmatter' }, { status: 400 })

  const { frontmatter } = parsed
  if (!frontmatter.name) return NextResponse.json({ error: 'name is required in frontmatter' }, { status: 400 })

  // If pm_project_id is set, update the existing project
  if (frontmatter.pm_project_id) {
    const { data, error } = await supabase
      .from('projects')
      .update({
        name: frontmatter.name,
        description: frontmatter.description ?? '',
        stack: frontmatter.stack ? frontmatter.stack.split(',').map(s => s.trim()).filter(Boolean) : [],
        health: frontmatter.health ?? 'idle',
        agent_assigned: frontmatter.agent ?? '',
        sprint_goal: frontmatter.sprint_goal ?? '',
        local_path: frontmatter.local_path ?? '',
        github_repo: frontmatter.github_repo ?? '',
        marker_synced_at: new Date().toISOString(),
      })
      .eq('id', frontmatter.pm_project_id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ project: data, action: 'updated' })
  }

  // Otherwise create a new project
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: frontmatter.name,
      description: frontmatter.description ?? '',
      stack: frontmatter.stack ? frontmatter.stack.split(',').map(s => s.trim()).filter(Boolean) : [],
      health: frontmatter.health ?? 'idle',
      agent_assigned: frontmatter.agent ?? '',
      sprint_goal: frontmatter.sprint_goal ?? '',
      local_path: frontmatter.local_path ?? '',
      github_repo: frontmatter.github_repo ?? '',
      marker_synced_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ project: data, action: 'created' }, { status: 201 })
}
