import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RecipientLayout } from '../components/RecipientLayout'
import { CLIENT_DELIVERY_STATUS_COPY, formatEtaWindow } from '../lib/deliveryTracking'
import { getSupabase } from '../lib/supabase'
import type { DeliveryTrackingStatus } from '../types/database'
import './TrackingPage.css'

function formatLastUpdated(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function TrackingPage() {
  const { token } = useParams<{ token: string }>()
  const [tracking, setTracking] = useState<DeliveryTrackingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTracking = useCallback(async () => {
    if (!token) {
      setTracking(null)
      setLoading(false)
      setError('This tracking link is missing a token.')
      return
    }

    const { data, error: trackingError } = await getSupabase().rpc('get_delivery_tracking_status', {
      p_tracking_token: token,
    })

    if (trackingError) {
      setTracking(null)
      setError('We could not load this tracking link.')
      setLoading(false)
      return
    }

    setTracking((data as DeliveryTrackingStatus[] | null)?.[0] ?? null)
    setError(null)
    setLoading(false)
  }, [token])

  useEffect(() => {
    queueMicrotask(() => {
      void loadTracking()
    })

    const intervalId = window.setInterval(() => {
      void loadTracking()
    }, 20000)

    return () => window.clearInterval(intervalId)
  }, [loadTracking])

  return (
    <RecipientLayout>
      <main className="tracking-page">
        <p className="tracking-page__eyebrow">Delivery tracking</p>
        <h1 className="tracking-page__title">Your langar delivery</h1>

        {loading && (
          <div className="tracking-card" role="status">
            Loading delivery status…
          </div>
        )}

        {!loading && (error || !tracking) && (
          <div className="tracking-card tracking-card--empty" role="alert">
            <h2>Tracking unavailable</h2>
            <p>
              This link may be expired, revoked, or entered incorrectly. Please contact the coordinator
              if you still need an update.
            </p>
            <Link to="/" className="tracking-page__link">
              Return home
            </Link>
          </div>
        )}

        {!loading && tracking && (
          <section className="tracking-card" aria-label="Delivery status">
            <p className="tracking-card__status">{tracking.status_label}</p>
            <h2>{CLIENT_DELIVERY_STATUS_COPY[tracking.delivery_status]}</h2>
            <p className="tracking-card__eta">{formatEtaWindow(tracking.eta_start, tracking.eta_end)}</p>

            <div className="tracking-progress">
              <div className="tracking-progress__item tracking-progress__item--active">
                <span />
                <p>{tracking.route_progress_label ?? 'Status will update as the route progresses'}</p>
              </div>
              <div className="tracking-progress__item">
                <span />
                <p>Last updated at {formatLastUpdated(tracking.last_updated_at)}</p>
              </div>
            </div>

            {tracking.client_visible_note && (
              <div className="tracking-note">
                <p className="tracking-note__label">Coordinator note</p>
                <p>{tracking.client_visible_note}</p>
              </div>
            )}

            <p className="tracking-page__privacy">
              For privacy, this page does not show driver location, phone number, home area, or other
              delivery stops.
            </p>
          </section>
        )}
      </main>
    </RecipientLayout>
  )
}
