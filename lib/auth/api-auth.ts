import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface RequestUser {
  id: string
  email: string | null
  tokenName: string | null  // name of the API token used, null for session auth
  supabase: SupabaseClient
}

export async function getRequestUser(request: Request): Promise<RequestUser | null> {
  // Bearer token auth (Claude Code agents)
  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : null

  if (token) {
    const service = createServiceClient()
    const { data } = await service
      .from('api_tokens')
      .select('user_id, name')
      .eq('token', token)
      .single()

    if (data?.user_id) {
      // Update last_used_at in background (don't await — don't slow the request)
      service.from('api_tokens').update({ last_used_at: new Date().toISOString() }).eq('token', token)

      // Fetch email via admin API — service client has the necessary privileges
      const { data: { user: authUser } } = await service.auth.admin.getUserById(data.user_id)
      return {
        id: data.user_id,
        email: authUser?.email ?? null,
        tokenName: data.name ?? null,
        supabase: service,
      }
    }
    return null
  }

  // Session cookie auth (browser)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return { id: user.id, email: user.email ?? null, tokenName: null, supabase }

  return null
}

export function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}
