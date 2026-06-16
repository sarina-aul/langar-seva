import { Link } from 'react-router-dom'
import { ReadyNotificationBanner } from '../components/ReadyNotificationBanner'
import { StaffLayout } from '../components/StaffLayout'
import { useAuth } from '../hooks/useAuth'
import { useBatchReadyNotification } from '../hooks/useBatchReadyNotification'
import { usePendingRecipientCount } from '../hooks/usePendingRecipientCount'
import { getStaffRole, isCoordinator } from '../lib/roles'
import './StaffHome.css'

export function StaffHome() {
  const { user } = useAuth()
  const role = getStaffRole(user)
  const coordinator = isCoordinator(user)
  const { notification, markRead } = useBatchReadyNotification(user)
  const pendingCount = usePendingRecipientCount(user)

  const roleLabel =
    role === 'coordinator' ? 'Coordinator' : role === 'kitchen_admin' ? 'Kitchen admin' : 'Staff'

  return (
    <StaffLayout
      title="Staff dashboard"
      subtitle={`Signed in as ${user?.email ?? 'staff'} · ${roleLabel}`}
    >
      {coordinator && notification && (
        <ReadyNotificationBanner
          notification={notification}
          onDismiss={() => void markRead(notification.id)}
          onGoToKitchen={() => void markRead(notification.id)}
        />
      )}

      <div className="staff-home__placeholder surface-card">
        <h3 className="staff-home__placeholder-title">
          {coordinator ? 'Coordinator dashboard' : "Tonight's kitchen batch"}
        </h3>
        <p className="staff-home__placeholder-text">
          {coordinator
            ? "Review pending requests and you'll be alerted when tonight's batch is ready for delivery."
            : 'Track prep, cooking, packing, and dispatch for tonight\'s langar.'}
        </p>
        {coordinator && (
          <Link to="/staff/recipients" className="btn-primary btn-primary--inline staff-home__cta">
            Review recipients
            {pendingCount !== null && pendingCount > 0 ? ` (${pendingCount} pending)` : ''}
          </Link>
        )}
        {!coordinator && (
          <Link to="/staff/kitchen" className="btn-primary btn-primary--inline staff-home__cta">
            Go to kitchen dashboard
          </Link>
        )}
      </div>
    </StaffLayout>
  )
}
