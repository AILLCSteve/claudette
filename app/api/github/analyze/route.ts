import { getOctokitForUser } from '@/lib/github/client'
import { getAnthropicClient } from '@/lib/anthropic/client'
import { sanitizeForPrompt } from '@/lib/anthropic/sanitize'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { owner, repo, projectId } = await request.json()

  const octokit = await getOctokitForUser()
  if (!octokit) return NextResponse.json({ error: 'GitHub token not available' }, { status: 401 })

  const [readmeRes, treeRes] = await Promise.allSettled([
    octokit.repos.getReadme({ owner, repo }),
    octokit.git.getTree({ owner, repo, tree_sha: 'HEAD', recursive: '0' }),
  ])

  const readme = readmeRes.status === 'fulfilled'
    ? Buffer.from(readmeRes.value.data.content, 'base64').toString('utf8').slice(0, 3000)
    : 'No README found.'

  const fileTree = treeRes.status === 'fulfilled'
    ? treeRes.value.data.tree.map(f => f.path).join('\n').slice(0, 2000)
    : 'Could not read file tree.'

  let packageJson = ''
  try {
    const pkgRes = await octokit.repos.getContent({ owner, repo, path: 'package.json' })
    if ('content' in pkgRes.data) {
      packageJson = Buffer.from(pkgRes.data.content as string, 'base64').toString('utf8').slice(0, 1000)
    }
  } catch {}

  const prompt = `Analyze this GitHub repository and provide a structured assessment for AI-agent-driven development.

Repository: ${sanitizeForPrompt(`${owner}/${repo}`)}

README:
${sanitizeForPrompt(readme)}

File Tree:
${sanitizeForPrompt(fileTree)}

${packageJson ? `package.json:\n${sanitizeForPrompt(packageJson)}` : ''}

Provide:
1. **Tech Stack** — what technologies are in use
2. **Architecture Summary** — how the code is organized
3. **Current State** — what appears to be built vs. missing
4. **Top 5 Development Priorities** — what should be built next (with rationale)
5. **Estimated Token Budget** — rough estimate of tokens per major feature area
6. **Risks & Blockers** — technical debt, missing tests, security gaps, etc.

Be direct and specific. Name actual files and functions where relevant.`

  const anthropic = getAnthropicClient()
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  })

  const analysis = response.content[0].type === 'text' ? response.content[0].text : ''

  if (projectId) {
    await supabase.from('projects').update({
      github_repo: `${owner}/${repo}`,
      repo_url: `https://github.com/${owner}/${repo}`,
    }).eq('id', projectId)
  }

  return NextResponse.json({ analysis, owner, repo })
}
