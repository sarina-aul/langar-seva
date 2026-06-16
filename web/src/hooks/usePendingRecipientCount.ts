import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { isCoordinator } from '../lib/roles'
import { getSupabase } from '../lib/supabase'

export function usePendingRecipientCount(user: User | null | undefined): number | null {
  const [count, setCount] = useState<number | null>(null)
  const coordinator = isCoordinator(user)

  const fetchCount = useCallback(async () => {
    if (!user || !coordinator) {
      setCount(null)
      return
    }

    const { count: pending, error } = await getSupabase()
      .from('recipients')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    if (!error) {
      setCount(pending ?? 0)
    }
  }, [user, coordinator])

  useEffect(() => {
    void fetchCount()

    if (!user || !coordinator) return

    const channel = getSupabase()
      .channel(`recipients_pending_count:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'recipients' },
        (payload) => {
          const row = payload.new as { status?: string }
          if (row.status === 'pending') {
            setCount((c) => (c === null ? 1 : c + 1))
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'recipients' },
        (payload) => {
          const oldRow = payload.old as { status?: string }
          const newRow = payload.new as { status?: string }
          if (oldRow.status === 'pending' && newRow.status !== 'pending') {
            setCount((c) => (c === null ? 0 : Math.max(0, c - 1)))
          } else if (oldRow.status !== 'pending' && newRow.status === 'pending') {
            setCount((c) => (c === null ? 1 : c + 1))
          }
        },
      )
      .subscribe()

    return () => {
      void getSupabase().removeChannel(channel)
    }
  }, [user, coordinator, fetchCount])

  return count
}
