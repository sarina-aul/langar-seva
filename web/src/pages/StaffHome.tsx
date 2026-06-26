import { Link } from 'react-router-dom'
import { ReadyNotificationBanner } from '../components/ReadyNotificationBanner'
import { StaffConsoleLayout } from '../components/StaffConsoleLayout'
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

  const consoles = coordinator
    ? [
        {
          step: '01',
          stepLabel: 'Dispatch',
          title: 'Recipient Review',
          body: "Review pending requests, approve households, and keep tonight's delivery list ready.",
          path: '/staff/recipients',
          cta: `Review recipients${pendingCount !== null && pendingCount > 0 ? ` (${pendingCount} pending)` : ''}`,
        },
        {
          step: '02',
          stepLabel: 'Prepare',
          title: 'Kitchen Operations',
          body: 'Track prep, cooking, packing, and readiness for pickup.',
          path: '/staff/kitchen',
          cta: 'Open kitchen',
        },
        {
          step: '03',
          stepLabel: 'Dispatch',
          title: 'Route Bundles',
          body: 'Assign approved recipients to sevadars and open the pickup window.',
          path: '/staff/dispatch',
          cta: 'Start dispatch',
        },
      ]
    : [
        {
          step: '02',
          stepLabel: 'Prepare',
          title: "Tonight's kitchen batch",
          body: "Track prep, cooking, packing, and dispatch for tonight's langar.",
          path: '/staff/kitchen',
          cta: 'Open kitchen',
        },
      ]

  return (
    <StaffConsoleLayout
      title="Staff Dashboard"
      subtitle={`${roleLabel} portal · ${new Date().toLocaleDateString([], {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })}`}
      stepLabel="Langar operations"
    >
      {coordinator && notification && (
        <ReadyNotificationBanner
          notification={notification}
          onDismiss={() => void markRead(notification.id)}
          onGoToKitchen={() => void markRead(notification.id)}
        />
      )}

      <section className="staff-home__overview" aria-label="Operations overview">
        <div className="staff-home__stat">
          <p className="staff-home__stat-label">Role</p>
          <p className="staff-home__stat-value">{roleLabel}</p>
        </div>
        <div className="staff-home__stat">
          <p className="staff-home__stat-label">Pending requests</p>
          <p className="staff-home__stat-value">
            {coordinator ? (pendingCount ?? '—') : '—'}
          </p>
        </div>
        <div className="staff-home__stat">
          <p className="staff-home__stat-label">Next stage</p>
          <p className="staff-home__stat-value staff-home__stat-value--small">
            {coordinator ? 'Dispatch' : 'Prepare'}
          </p>
        </div>
      </section>

      <section className="staff-home__workflow" aria-labelledby="workflow-heading">
        <div className="staff-home__section-header">
          <h2 id="workflow-heading" className="staff-home__section-title">
            Workflow
          </h2>
          <p className="staff-home__section-kicker">Plan → Prepare → Dispatch</p>
        </div>
        <p className="staff-home__section-copy">
          Each console handles a stage of the langar seva cycle.
        </p>

        <div className="staff-home__cards">
          {consoles.map((console) => (
            <Link key={console.path} to={console.path} className="staff-home__card">
              <div className="staff-home__card-strip">
                <span>Step {console.step}</span>
                <span>{console.stepLabel}</span>
              </div>
              <div className="staff-home__card-body">
                <div className="staff-home__card-icon" aria-hidden="true">
                  {console.step}
                </div>
                <h3 className="staff-home__card-title">{console.title}</h3>
                <p className="staff-home__card-copy">{console.body}</p>
                <span className="staff-home__card-cta">{console.cta} →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </StaffConsoleLayout>
  )
}
