import { createClient } from '@/lib/supabase/server'
import { generateContextArtifact } from '@/lib/pm/artifact-exporter'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, agentId, sessionWindow } = await request.json()

  const [projectRes, agentRes] = await Promise.all([
    supabase
      .from('projects')
      .select('*, tasks(*), bugs(*), obstacles(*), session_logs(*), dev_plans(*, dev_plan_tasks(*))')
      .eq('id', projectId)
      .single(),
    supabase.from('agents').select('*').eq('id', agentId).single(),
  ])

  if (!projectRes.data) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (!agentRes.data) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const artifact = generateContextArtifact({
    project: projectRes.data,
    agent: agentRes.data,
    sessionWindow,
  })

  const filename = `context-artifact-${projectRes.data.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.md`

  return NextResponse.json({ artifact, filename })
}
