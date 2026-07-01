import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { StaffConsoleLayout } from '../components/StaffConsoleLayout'
import {
  DELIVERY_STOP_STATUS_LABELS,
  DRIVER_STOP_STATUSES,
  estimateStopEta,
  formatEtaWindow,
} from '../lib/deliveryTracking'
import { formatRecipientAddress } from '../lib/recipientLabels'
import { getSupabase } from '../lib/supabase'
import type {
  BatchRow,
  DeliveryStopStatus,
  DispatchRouteRow,
  RecipientRow,
  SevadarRow,
} from '../types/database'
import './DriverRoutePage.css'

interface DriverRouteStop {
  id: string
  stop_order: number
  meals: number
  delivery_status: DeliveryStopStatus
  eta_start: string | null
  eta_end: string | null
  client_visible_note: string | null
  recipient: RecipientRow | null
}

interface DriverRouteDetails extends DispatchRouteRow {
  batch: BatchRow | null
  sevadar: SevadarRow | null
  stops: DriverRouteStop[]
}

export function DriverRoutePage() {
  const { routeId } = useParams<{ routeId: string }>()
  const [route, setRoute] = useState<DriverRouteDetails | null>(null)
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
    if (!routeId) return
    setLoading(true)
    setError(null)

    const { data, error: routeError } = await getSupabase()
      .from('dispatch_routes')
      .select(
        `
          *,
          batches (*),
          sevadars (*),
          dispatch_route_recipients (
            id,
            stop_order,
            meals,
            delivery_status,
            eta_start,
            eta_end,
            client_visible_note,
            recipients (*)
          )
        `,
      )
      .eq('id', routeId)
      .single()

    if (routeError) {
      setRoute(null)
      setError('Could not load this route.')
      setLoading(false)
      return
    }

    const row = data as DispatchRouteRow & {
      batches?: BatchRow | null
      sevadars?: SevadarRow | null
      dispatch_route_recipients?: Array<{
        id: string
        stop_order: number
        meals: number
        delivery_status: DeliveryStopStatus
        eta_start: string | null
        eta_end: string | null
        client_visible_note: string | null
        recipients?: RecipientRow | null
      }>
    }

    const stops = (row.dispatch_route_recipients ?? [])
      .map((stop) => ({
        id: stop.id,
        stop_order: stop.stop_order,
        meals: stop.meals,
        delivery_status: stop.delivery_status,
        eta_start: stop.eta_start,
        eta_end: stop.eta_end,
        client_visible_note: stop.client_visible_note,
        recipient: stop.recipients ?? null,
      }))
      .sort((a, b) => a.stop_order - b.stop_order)

    setRoute({
      ...row,
      batch: row.batches ?? null,
      sevadar: row.sevadars ?? null,
      stops,
    })
    setClientNotes(
      stops.reduce<Record<string, string>>((notes, stop) => {
        notes[stop.id] = stop.client_visible_note ?? ''
        return notes
      }, {}),
    )
    setLoading(false)
  }, [routeId])

  useEffect(() => {
    queueMicrotask(() => {
      void loadRoute()
    })
  }, [loadRoute])

  useEffect(() => {
    if (!routeId) return

    const channel = getSupabase()
      .channel(`driver-route-${routeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dispatch_route_recipients' },
        () => {
          void loadRoute()
        },
      )
      .subscribe()

    return () => {
      void getSupabase().removeChannel(channel)
    }
  }, [loadRoute, routeId])

  async function markPickedUp() {
    if (!route) return
    setSaving(true)
    setError(null)

    const pickupTime = new Date()
    const updates = route.stops
      .filter((stop) => stop.delivery_status === 'pending')
      .map((stop) =>
        getSupabase()
          .from('dispatch_route_recipients')
          .update({
            delivery_status: 'on_the_way',
            ...estimateStopEta(pickupTime, stop.stop_order),
          })
          .eq('id', stop.id),
      )

    const [{ error: routeError }] = await Promise.all([
      getSupabase().from('dispatch_routes').update({ status: 'picked_up' }).eq('id', route.id),
      ...updates,
    ])

    setSaving(false)
    if (routeError) {
      setError('Could not mark this route picked up.')
      return
    }
    await loadRoute()
  }

  async function updateStop(stop: DriverRouteStop, deliveryStatus: DeliveryStopStatus) {
    setSaving(true)
    setError(null)

    const { error: updateError } = await getSupabase()
      .from('dispatch_route_recipients')
      .update({
        delivery_status: deliveryStatus,
        client_visible_note: clientNotes[stop.id]?.trim() || null,
      })
      .eq('id', stop.id)

    setSaving(false)
    if (updateError) {
      setError('Could not update this stop.')
      return
    }
    await loadRoute()
  }

  return (
    <StaffConsoleLayout
      title="Driver Route"
      subtitle="Update pickup, stop progress, and client-safe delivery notes."
      backTo="/staff/dispatch"
      backLabel="Dispatch"
      stepLabel="Driver route sheet"
    >
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

      {!loading && route && (
        <>
          <section className="driver-route-summary">
            <div>
              <p className="driver-route-summary__eyebrow">{route.status.replace('_', ' ')}</p>
              <h2>{route.route_name}</h2>
              <p>
                {route.sevadar?.name ?? 'Unassigned sevadar'} · {completedStops}/{route.stops.length} stops complete
              </p>
            </div>
            {route.status === 'assigned' && (
              <button type="button" className="driver-route-button driver-route-button--primary" disabled={saving} onClick={() => void markPickedUp()}>
                Mark picked up
              </button>
            )}
          </section>

          <ol className="driver-route-stops">
            {route.stops.map((stop) => (
              <li key={stop.id} className="driver-route-stop">
                <div className="driver-route-stop__number">{stop.stop_order}</div>
                <div className="driver-route-stop__body">
                  <p className="driver-route-stop__status">{DELIVERY_STOP_STATUS_LABELS[stop.delivery_status]}</p>
                  <h3>{stop.recipient?.name ?? 'Recipient'}</h3>
                  <p>{stop.recipient ? formatRecipientAddress(stop.recipient) : 'Address unavailable'}</p>
                  <p>
                    {stop.meals} meals · {formatEtaWindow(stop.eta_start, stop.eta_end)}
                  </p>
                  {stop.recipient?.phone && <p>Call/text: {stop.recipient.phone}</p>}
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
    </StaffConsoleLayout>
  )
}
