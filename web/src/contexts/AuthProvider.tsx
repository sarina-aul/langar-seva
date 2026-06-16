import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase'
import { AuthContext, type AuthContextValue } from './AuthContext'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabase()
    let mounted = true

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!mounted) return
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      loading,
      signIn: async (email, password) => {
        const { data, error } = await getSupabase().auth.signInWithPassword({ email, password })
        if (error) {
          return { error: 'Email or password is incorrect.', user: null }
        }
        // Sync immediately so ProtectedRoute sees the session before navigate()
        setSession(data.session)
        setUser(data.user)
        return { error: null, user: data.user }
      },
      signOut: async () => {
        await getSupabase().auth.signOut()
        setSession(null)
        setUser(null)
      },
    }),
    [session, user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
