import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Layout } from './Layout'
import { StaffNav } from './StaffNav'
import { useAuth } from '../hooks/useAuth'
import './StaffLayout.css'

interface StaffLayoutProps {
  title: string
  subtitle?: string
  backTo?: string
  backLabel?: string
  children: ReactNode
}

export function StaffLayout({
  title,
  subtitle,
  backTo,
  backLabel = '← Dashboard',
  children,
}: StaffLayoutProps) {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <Layout>
      <div className="staff-shell">
        <header className="staff-shell__header">
          <div className="staff-shell__intro">
            {backTo && (
              <Link to={backTo} className="staff-shell__back">
                {backLabel}
              </Link>
            )}
            <h2 className="staff-shell__title">{title}</h2>
            {subtitle && <p className="staff-shell__subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="btn-secondary" onClick={() => void handleSignOut()}>
            Sign out
          </button>
        </header>

        <StaffNav />

        <div className="staff-shell__content">{children}</div>
      </div>
    </Layout>
  )
}
