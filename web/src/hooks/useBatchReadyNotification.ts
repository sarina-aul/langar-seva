import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { isCoordinator } from '../lib/roles'
import { getSupabase } from '../lib/supabase'
import type { StaffNotificationRow } from '../types/database'

interface UseBatchReadyNotificationResult {
  notification: StaffNotificationRow | null
  loading: boolean
  markRead: (id: string) => Promise<void>
}

export function useBatchReadyNotification(
  user: User | null | undefined,
): UseBatchReadyNotificationResult {
  const [notification, setNotification] = useState<StaffNotificationRow | null>(null)
  const [loading, setLoading] = useState(true)

  const coordinator = isCoordinator(user)

  const fetchUnread = useCallback(async () => {
    if (!user || !coordinator) {
      setNotification(null)
      setLoading(false)
      return
    }

    const { data, error } = await getSupabase()
      .from('staff_notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('kind', 'batch_ready')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!error) {
      setNotification(data as StaffNotificationRow | null)
    }
    setLoading(false)
  }, [user, coordinator])

  const markRead = useCallback(
    async (id: string) => {
      if (!user || !coordinator) return

      const { error } = await getSupabase()
        .from('staff_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)

      if (!error) {
        setNotification(null)
      }
    },
    [user, coordinator],
  )

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true)
      void fetchUnread()
    })

    if (!user || !coordinator) {
      return
    }

    const channelId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`
    const channel = getSupabase()
      .channel(`staff_notifications:${user.id}:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'staff_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as StaffNotificationRow
          if (row.kind === 'batch_ready' && row.read_at === null) {
            setNotification(row)
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'staff_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as StaffNotificationRow
          if (row.read_at !== null) {
            setNotification((current) => (current?.id === row.id ? null : current))
          }
        },
      )
      .subscribe()

    return () => {
      void getSupabase().removeChannel(channel)
    }
  }, [user, coordinator, fetchUnread])

  return { notification, loading, markRead }
}
