import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePendingRecipientCount } from '../hooks/usePendingRecipientCount'
import { isCoordinator } from '../lib/roles'
import './StaffNav.css'

export function StaffNav() {
  const { user } = useAuth()
  const location = useLocation()
  const coordinator = isCoordinator(user)
  const pendingCount = usePendingRecipientCount(user)

  return (
    <nav className="staff-nav" aria-label="Staff sections">
      {coordinator ? (
        <Link
          to="/staff/recipients"
          className={`staff-nav__item staff-nav__item--link${location.pathname === '/staff/recipients' ? ' staff-nav__item--active' : ''}`}
        >
          Recipients
          {pendingCount !== null && pendingCount > 0 && (
            <span className="staff-nav__badge">{pendingCount}</span>
          )}
        </Link>
      ) : (
        <span className="staff-nav__item staff-nav__item--disabled">Recipients</span>
      )}
      {coordinator && (
        <Link
          to="/staff/dispatch"
          className={`staff-nav__item staff-nav__item--link${location.pathname === '/staff/dispatch' ? ' staff-nav__item--active' : ''}`}
        >
          Dispatch
        </Link>
      )}
      <Link
        to="/staff/kitchen"
        className={`staff-nav__item staff-nav__item--link${location.pathname === '/staff/kitchen' ? ' staff-nav__item--active' : ''}`}
      >
        Kitchen
      </Link>
      {location.pathname === '/staff' && (
        <span className="staff-nav__item staff-nav__item--active staff-nav__item--current">
          Dashboard
        </span>
      )}
    </nav>
  )
}
