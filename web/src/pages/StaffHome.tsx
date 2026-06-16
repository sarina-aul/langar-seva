import { Link, useNavigate } from 'react-router-dom'
import { ReadyNotificationBanner } from '../components/ReadyNotificationBanner'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useBatchReadyNotification } from '../hooks/useBatchReadyNotification'
import { getStaffRole, isCoordinator } from '../lib/roles'
import './StaffHome.css'

export function StaffHome() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const role = getStaffRole(user)
  const coordinator = isCoordinator(user)
  const { notification, markRead } = useBatchReadyNotification(user)

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

        {coordinator && notification && (
          <ReadyNotificationBanner
            notification={notification}
            onDismiss={() => void markRead(notification.id)}
            onGoToKitchen={() => void markRead(notification.id)}
          />
        )}

        <nav className="staff-nav" aria-label="Staff sections">
          <span className="staff-nav__item staff-nav__item--disabled">Recipients (soon)</span>
          <Link to="/staff/kitchen" className="staff-nav__item staff-nav__item--link">
            Kitchen
          </Link>
        </nav>

        <div className="staff-home__placeholder">
          <h3 className="staff-home__placeholder-title">Tonight&apos;s kitchen batch</h3>
          <p className="staff-home__placeholder-text">
            {coordinator
              ? "You'll be alerted here when tonight's batch is ready for delivery."
              : 'Track prep, cooking, packing, and dispatch for tonight\'s langar.'}
          </p>
          <Link to="/staff/kitchen" className="btn-primary staff-home__kitchen-link">
            Go to kitchen dashboard
          </Link>
        </div>
      </div>
    </Layout>
  )
}
