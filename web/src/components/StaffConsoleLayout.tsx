import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SevaLogo } from './SevaLogo'
import { StaffNav } from './StaffNav'
import { useAuth } from '../hooks/useAuth'
import './StaffConsoleLayout.css'

interface StaffConsoleLayoutProps {
  title: string
  subtitle?: string
  backTo?: string
  backLabel?: string
  stepLabel?: string
  children: ReactNode
}

export function StaffConsoleLayout({
  title,
  subtitle,
  backTo,
  backLabel = 'Dashboard',
  stepLabel,
  children,
}: StaffConsoleLayoutProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="staff-console">
      <header className="staff-console__hero">
        <div className="staff-console__hero-inner">
          {backTo && (
            <Link to={backTo} className="staff-console__back">
              <span className="staff-console__back-icon" aria-hidden="true">
                ←
              </span>
              <span>{backLabel}</span>
            </Link>
          )}

          <div className="staff-console__hero-row">
            <div>
              <SevaLogo size="md" variant="paper" />
              {stepLabel && <p className="staff-console__step">{stepLabel}</p>}
              <h1 className="staff-console__title">{title}</h1>
              {subtitle && <p className="staff-console__subtitle">{subtitle}</p>}
            </div>
            <div className="staff-console__user">
              <p className="staff-console__user-label">Signed in as</p>
              <p className="staff-console__user-name">{user?.email ?? 'Staff'}</p>
              <button type="button" className="staff-console__sign-out" onClick={() => void handleSignOut()}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="staff-console__body">
        <StaffNav />
        <main className="staff-console__main">{children}</main>
      </div>
    </div>
  )
}
