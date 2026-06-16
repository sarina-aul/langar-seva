import { Link } from 'react-router-dom'
import type { StaffNotificationRow } from '../types/database'
import './ReadyNotificationBanner.css'

interface ReadyNotificationBannerProps {
  notification: StaffNotificationRow
  onDismiss: () => void
  onGoToKitchen: () => void
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ReadyNotificationBanner({
  notification,
  onDismiss,
  onGoToKitchen,
}: ReadyNotificationBannerProps) {
  return (
    <div className="ready-banner" role="alert">
      <div className="ready-banner__content">
        <p className="ready-banner__eyebrow">Batch ready</p>
        <h3 className="ready-banner__title">{notification.title}</h3>
        {notification.body && (
          <p className="ready-banner__body">{notification.body}</p>
        )}
        <p className="ready-banner__time">Received at {formatTime(notification.created_at)}</p>
      </div>
      <div className="ready-banner__actions">
        <Link
          to="/staff/kitchen"
          className="btn-primary btn-primary--inline ready-banner__cta"
          onClick={() => onGoToKitchen()}
        >
          Go to kitchen
        </Link>
        <button
          type="button"
          className="btn-secondary ready-banner__dismiss"
          onClick={() => onDismiss()}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
