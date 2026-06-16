import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getStaffRole } from '../lib/roles'
import type { StaffRole } from '../types/auth'
import '../components/IntakeForm.css'
import './ProtectedRoute.css'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: StaffRole
}

function AuthLoading() {
  return (
    <div className="auth-loading" role="status" aria-live="polite">
      <p className="auth-loading__text">Loading…</p>
    </div>
  )
}

function NoAccess({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="auth-gate">
      <div className="auth-gate__card">
        <h2 className="auth-gate__heading">No access</h2>
        <p className="auth-gate__text">
          This account does not have staff permissions. Contact your administrator if you
          believe this is a mistake.
        </p>
        <button type="button" className="btn-primary auth-gate__button" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  )
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { session, user, loading, signOut } = useAuth()
  const location = useLocation()

  if (loading) {
    return <AuthLoading />
  }

  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  const role = getStaffRole(user)
  if (!role) {
    return <NoAccess onSignOut={() => void signOut()} />
  }

  if (requiredRole && role !== requiredRole) {
    return <NoAccess onSignOut={() => void signOut()} />
  }

  return children
}
