import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  DELIVERY_STOP_STATUS_LABELS,
  DRIVER_STOP_STATUSES,
  formatEtaWindow,
} from '../lib/deliveryTracking'
import { formatRecipientAddress } from '../lib/recipientLabels'
import { getSupabase } from '../lib/supabase'
import type { DeliveryStopStatus, DispatchRouteStatus } from '../types/database'
import './DriverRoutePage.css'

interface PublicStop {
  id: string
  stop_order: number
  meals: number
  delivery_status: DeliveryStopStatus
  eta_start: string | null
  eta_end: string | null
  client_visible_note: string | null
  recipient_name: string
  recipient_address: string
  recipient_unit_buzz: string
  recipient_phone: string | null
}

interface PublicRoute {
  route_id: string
  route_name: string
  status: DispatchRouteStatus
  sevadar_name: string | null
  stops: PublicStop[]
}

export function PublicDriverRoutePage() {
  const { token } = useParams<{ token: string }>()
  const [route, setRoute] = useState<PublicRoute | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientNotes, setClientNotes] = useState<Record<string, string>>({})

  const completedStops = useMemo(
    () =>
      route?.stops.filter((stop) =>
        ['delivered', 'skipped', 'unable_to_contact'].includes(stop.delivery_status),
      ).length ?? 0,
    [route?.stops],
  )

  const loadRoute = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)

    const { data, error: routeError } = await getSupabase().rpc('get_driver_route_for_token', {
      p_route_token: token,
    })

    if (routeError || !data) {
      setRoute(null)
      setError('This route link is invalid, expired, or revoked.')
      setLoading(false)
      return
    }

    const parsed = data as PublicRoute
    setRoute(parsed)
    setClientNotes(
      (parsed.stops ?? []).reduce<Record<string, string>>((notes, stop) => {
        notes[stop.id] = stop.client_visible_note ?? ''
        return notes
      }, {}),
    )
    setLoading(false)
  }, [token])

  useEffect(() => {
    queueMicrotask(() => {
      void loadRoute()
    })
  }, [loadRoute])

  async function markPickedUp() {
    if (!token) return
    setSaving(true)
    setError(null)

    const { data, error: pickupError } = await getSupabase().rpc('mark_driver_route_picked_up', {
      p_route_token: token,
    })

    setSaving(false)
    if (pickupError || !data) {
      setError('Could not mark this route picked up.')
      return
    }
    await loadRoute()
  }

  async function updateStop(stop: PublicStop, deliveryStatus: DeliveryStopStatus) {
    if (!token) return
    setSaving(true)
    setError(null)

    const { data, error: updateError } = await getSupabase().rpc('update_driver_route_stop', {
      p_route_token: token,
      p_stop_id: stop.id,
      p_delivery_status: deliveryStatus,
      p_client_visible_note: clientNotes[stop.id]?.trim() || null,
    })

    setSaving(false)
    if (updateError || !data) {
      setError('Could not update this stop.')
      return
    }
    await loadRoute()
  }

  return (
    <div className="driver-route-public">
      <header className="driver-route-public__header">
        <p className="driver-route-public__eyebrow">Langar Seva · Sevadar route</p>
        <h1>{route?.route_name ?? 'Your route'}</h1>
      </header>

      {loading && (
        <div className="driver-route-state" role="status">
          Loading route…
        </div>
      )}

      {!loading && error && (
        <div className="driver-route-alert" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && !route && (
        <div className="driver-route-state driver-route-state--empty" role="alert">
          <h2>Route unavailable</h2>
          <p>This link is invalid, expired, or has been revoked. Ask your coordinator for a new route link.</p>
        </div>
      )}

      {!loading && route && (
        <>
          <section className="driver-route-summary">
            <div>
              <p className="driver-route-summary__eyebrow">{route.status.replace('_', ' ')}</p>
              <h2>{route.route_name}</h2>
              <p>
                {route.sevadar_name ?? 'Sevadar'} · {completedStops}/{route.stops.length} stops complete
              </p>
            </div>
            {route.status === 'assigned' && (
              <button
                type="button"
                className="driver-route-button driver-route-button--primary"
                disabled={saving}
                onClick={() => void markPickedUp()}
              >
                Mark picked up
              </button>
            )}
          </section>

          <ol className="driver-route-stops">
            {route.stops.map((stop) => (
              <li key={stop.id} className="driver-route-stop">
                <div className="driver-route-stop__number">{stop.stop_order}</div>
                <div className="driver-route-stop__body">
                  <p className="driver-route-stop__status">
                    {DELIVERY_STOP_STATUS_LABELS[stop.delivery_status]}
                  </p>
                  <h3>{stop.recipient_name}</h3>
                  <p>{formatRecipientAddress({ address: stop.recipient_address, unit_buzz: stop.recipient_unit_buzz })}</p>
                  <p>
                    {stop.meals} meals · {formatEtaWindow(stop.eta_start, stop.eta_end)}
                  </p>
                  {stop.recipient_phone && <p>Call/text: {stop.recipient_phone}</p>}
                  <label className="driver-route-note">
                    <span>Client-safe note</span>
                    <input
                      value={clientNotes[stop.id] ?? ''}
                      onChange={(event) =>
                        setClientNotes((current) => ({
                          ...current,
                          [stop.id]: event.target.value,
                        }))
                      }
                      placeholder="Example: Running 10 minutes late"
                    />
                  </label>
                  <div className="driver-route-stop__actions">
                    {DRIVER_STOP_STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className="driver-route-button"
                        disabled={saving || stop.delivery_status === status}
                        onClick={() => void updateStop(stop, status)}
                      >
                        {DELIVERY_STOP_STATUS_LABELS[status]}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}
