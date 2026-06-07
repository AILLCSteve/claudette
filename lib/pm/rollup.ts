import type { SupabaseClient } from '@supabase/supabase-js'

type Child = { status: string; assigned_agents?: string[] | null }

/**
 * Derive a parent's status from its children using a full rule set.
 * Returns null if there are no children (don't overwrite manual status).
 *
 * Rule priority (highest → lowest):
 *  1. All done/cancelled                    → done
 *  2. Any blocked                           → blocked      (must surface immediately)
 *  3. Any needs-attention / awaiting-decision / needs-input → needs-attention
 *  4. All paused (+ optionally done/cancelled) → paused
 *  5. All in-review / testing (+ done/cancelled) → in-review
 *  6. Any in-progress / underway            → in-progress
 *  7. Mix of done + not-started             → in-progress  (work has begun overall)
 *  8. All not-started / backlog, WITH assigned agents → ready (planned + assigned, not begun)
 *  9. All not-started / backlog, no assignees → not-started
 * 10. Fallback                              → in-progress
 */
export function computeRollupStatus(children: Child[]): string | null {
  if (children.length === 0) return null

  const statuses = children.map(c => c.status)
  const hasAssignees = children.some(c => (c.assigned_agents ?? []).length > 0)

  const allTerminal = statuses.every(s => s === 'done' || s === 'cancelled')
  const allUnstarted = statuses.every(s => s === 'not-started' || s === 'backlog')
  const anyDone     = statuses.some(s => s === 'done')
  const anyBlocked  = statuses.some(s => s === 'blocked')
  const anyAttention = statuses.some(s =>
    s === 'needs-attention' || s === 'awaiting-decision' || s === 'needs-input'
  )
  const anyActive = statuses.some(s => s === 'in-progress' || s === 'underway')
  const allPaused = statuses.every(
    s => s === 'paused' || s === 'done' || s === 'cancelled' || s === 'not-started'
  ) && statuses.some(s => s === 'paused')
  const allReview = statuses.every(
    s => s === 'in-review' || s === 'testing' || s === 'done' || s === 'cancelled'
  ) && statuses.some(s => s === 'in-review' || s === 'testing')

  // 1. All terminal
  if (allTerminal) return 'done'

  // 2. Blocked is the loudest signal — always surface it
  if (anyBlocked) return 'blocked'

  // 3. Human attention required
  if (anyAttention) return 'needs-attention'

  // 4. All paused (work has started but is on hold)
  if (allPaused) return 'paused'

  // 5. All in review / testing phase
  if (allReview) return 'in-review'

  // 6. Active work underway
  if (anyActive) return 'in-progress'

  // 7. Some done, some not yet started — work is clearly underway overall
  if (anyDone && !allTerminal) return 'in-progress'

  // 8. Planned, assigned, not started → ready to go
  if (allUnstarted && hasAssignees) return 'ready'

  // 9. Nothing started, nothing assigned → genuinely not yet started
  if (allUnstarted) return 'not-started'

  // 10. Fallback
  return 'in-progress'
}

/**
 * After a single item's status changes, walk up the ancestor chain recomputing
 * each parent's status from its children. Stops at root (parent_id = null).
 */
export async function rollupAncestors(
  supabase: SupabaseClient,
  itemId: string,
  projectId: string,
): Promise<void> {
  const { data: changed } = await supabase
    .from('pm_items')
    .select('parent_id')
    .eq('id', itemId)
    .single()

  let currentParentId: string | null = changed?.parent_id ?? null

  while (currentParentId) {
    const { data: children } = await supabase
      .from('pm_items')
      .select('status, assigned_agents')
      .eq('project_id', projectId)
      .eq('parent_id', currentParentId)

    if (!children) break

    const rolled = computeRollupStatus(children)
    if (!rolled) break

    const { data: parent } = await supabase
      .from('pm_items')
      .select('parent_id, status')
      .eq('id', currentParentId)
      .single()

    // Only write if status actually changes (avoid unnecessary DB writes)
    if (parent && parent.status !== rolled) {
      await supabase
        .from('pm_items')
        .update({ status: rolled, updated_at: new Date().toISOString() })
        .eq('id', currentParentId)
    }

    currentParentId = parent?.parent_id ?? null
  }
}

/**
 * Recompute statuses for ALL parents in a project, bottom-up.
 * Order: subtasks feed tasks → tasks feed features → features feed tracks.
 * Used after bulk syncs so the whole tree is consistent.
 */
export async function rollupAll(supabase: SupabaseClient, projectId: string): Promise<void> {
  const { data: items } = await supabase
    .from('pm_items')
    .select('id, parent_id, status, level, assigned_agents')
    .eq('project_id', projectId)

  if (!items) return

  // Process bottom-up: tasks → features → tracks
  const parentLevels: Array<'task' | 'feature' | 'track'> = ['task', 'feature', 'track']

  for (const level of parentLevels) {
    const parents = items.filter(i => i.level === level)
    for (const parent of parents) {
      const children = items.filter(i => i.parent_id === parent.id)
      const rolled = computeRollupStatus(children)
      if (!rolled || rolled === parent.status) continue

      await supabase
        .from('pm_items')
        .update({ status: rolled, updated_at: new Date().toISOString() })
        .eq('id', parent.id)

      // Update in-memory so higher levels see the fresh value this pass
      parent.status = rolled
    }
  }
}
