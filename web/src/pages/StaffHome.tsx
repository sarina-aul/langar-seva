import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { getStaffRole } from '../lib/roles'
import './StaffHome.css'

export function StaffHome() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const role = getStaffRole(user)

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const roleLabel =
    role === 'coordinator' ? 'Coordinator' : role === 'kitchen_admin' ? 'Kitchen admin' : 'Staff'

  return (
    <Layout>
      <div className="staff-home">
        <header className="staff-home__header">
          <div>
            <h2 className="staff-home__heading">Staff dashboard</h2>
            <p className="staff-home__meta">
              Signed in as <strong>{user?.email}</strong> · {roleLabel}
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={() => void handleSignOut()}>
            Sign out
          </button>
        </header>

        <nav className="staff-nav" aria-label="Staff sections">
          <span className="staff-nav__item staff-nav__item--disabled">Recipients (soon)</span>
          <span className="staff-nav__item staff-nav__item--disabled">Kitchen (soon)</span>
        </nav>

        <div className="staff-home__placeholder">
          <h3 className="staff-home__placeholder-title">Kitchen dashboard coming soon</h3>
          <p className="staff-home__placeholder-text">
            Tonight&apos;s langar batch workflow — prep through dispatch — will live here.
          </p>
        </div>
      </div>
    </Layout>
  )
}
