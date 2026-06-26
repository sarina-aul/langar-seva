import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { StaffConsoleLayout } from '../components/StaffConsoleLayout'
import { DELIVERY_WINDOW_LABELS, formatRecipientAddress } from '../lib/recipientLabels'
import { getSupabase } from '../lib/supabase'
import type {
  BatchRow,
  DispatchRouteRow,
  DispatchRouteStatus,
  RecipientRow,
  SevadarRow,
} from '../types/database'
import './DispatchPage.css'

interface RouteRecipient {
  id: string
  stop_order: number
  meals: number
  recipient: RecipientRow | null
}

interface DispatchRouteWithDetails extends DispatchRouteRow {
  sevadar: SevadarRow | null
  recipients: RouteRecipient[]
}

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA')
}

function formatWindow(batch: BatchRow | null): string {
  if (!batch?.pickup_window_start || !batch.pickup_window_end) return 'Pickup window not set'
  return `${batch.pickup_window_start.slice(0, 5)}–${batch.pickup_window_end.slice(0, 5)}`
}

function statusLabel(status: DispatchRouteStatus): string {
  switch (status) {
    case 'planned':
      return 'Planned'
    case 'assigned':
      return 'Assigned'
    case 'picked_up':
      return 'Picked up'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
  }
}

export function DispatchPage() {
  const [batch, setBatch] = useState<BatchRow | null>(null)
  const [approvedRecipients, setApprovedRecipients] = useState<RecipientRow[]>([])
  const [routes, setRoutes] = useState<DispatchRouteWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [routeName, setRouteName] = useState('Route 1')
  const [sevadarName, setSevadarName] = useState('')
  const [sevadarPhone, setSevadarPhone] = useState('')
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])

  const assignedRecipientIds = useMemo(
    () => new Set(routes.flatMap((route) => route.recipients.map((entry) => entry.recipient?.id).filter(Boolean))),
    [routes],
  )

  const availableRecipients = approvedRecipients.filter((recipient) => !assignedRecipientIds.has(recipient.id))
  const selectedMeals = availableRecipients
    .filter((recipient) => selectedRecipients.includes(recipient.id))
    .reduce((sum, recipient) => sum + recipient.meals, 0)
  const routeMeals = routes.reduce(
    (sum, route) => sum + route.recipients.reduce((routeSum, entry) => routeSum + entry.meals, 0),
    0,
  )

  const loadRoutes = useCallback(async (batchId: string) => {
    const { data, error: routesError } = await getSupabase()
      .from('dispatch_routes')
      .select(
        `
          *,
          sevadars (*),
          dispatch_route_recipients (
            id,
            stop_order,
            meals,
            recipients (*)
          )
        `,
      )
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true })

    if (routesError) {
      setError('Could not load route bundles.')
      return
    }

    const normalized = ((data as unknown[]) ?? []).map((route) => {
      const row = route as DispatchRouteRow & {
        sevadars?: SevadarRow | null
        dispatch_route_recipients?: Array<{
          id: string
          stop_order: number
          meals: number
          recipients?: RecipientRow | null
        }>
      }
      return {
        ...row,
        sevadar: row.sevadars ?? null,
        recipients: (row.dispatch_route_recipients ?? [])
          .map((entry) => ({
            id: entry.id,
            stop_order: entry.stop_order,
            meals: entry.meals,
            recipient: entry.recipients ?? null,
          }))
          .sort((a, b) => a.stop_order - b.stop_order),
      }
    })

    setRoutes(normalized)
  }, [])

  const loadDispatchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [{ data: batchData, error: batchError }, { data: recipientsData, error: recipientsError }] =
      await Promise.all([
        getSupabase().from('batches').select('*').eq('batch_date', todayIso()).maybeSingle(),
        getSupabase().from('recipients').select('*').eq('status', 'approved').order('created_at', { ascending: true }),
      ])

    if (batchError || recipientsError) {
      setError('Could not load dispatch data. Please refresh.')
      setLoading(false)
      return
    }

    const currentBatch = batchData as BatchRow | null
    setBatch(currentBatch)
    setApprovedRecipients((recipientsData as RecipientRow[] | null) ?? [])

    if (currentBatch) {
      await loadRoutes(currentBatch.id)
    } else {
      setRoutes([])
    }

    setLoading(false)
  }, [loadRoutes])

  useEffect(() => {
    queueMicrotask(() => {
      void loadDispatchData()
    })
  }, [loadDispatchData])

  async function handleCreateRoute(event: FormEvent) {
    event.preventDefault()
    if (!batch) return
    if (selectedRecipients.length === 0) {
      setError('Select at least one approved recipient for this route.')
      return
    }
    if (!sevadarName.trim()) {
      setError('Enter the sevadar name for this route.')
      return
    }

    setSaving(true)
    setError(null)

    const { data: sevadar, error: sevadarError } = await getSupabase()
      .from('sevadars')
      .insert({
        name: sevadarName.trim(),
        phone: sevadarPhone.trim() || null,
      })
      .select()
      .single()

    if (sevadarError) {
      setSaving(false)
      setError('Could not save sevadar.')
      return
    }

    const { data: route, error: routeError } = await getSupabase()
      .from('dispatch_routes')
      .insert({
        batch_id: batch.id,
        sevadar_id: (sevadar as SevadarRow).id,
        route_name: routeName.trim() || `Route ${routes.length + 1}`,
        status: 'assigned',
      })
      .select()
      .single()

    if (routeError) {
      setSaving(false)
      setError('Could not create route bundle.')
      return
    }

    const selected = availableRecipients.filter((recipient) => selectedRecipients.includes(recipient.id))
    const { error: recipientsError } = await getSupabase().from('dispatch_route_recipients').insert(
      selected.map((recipient, index) => ({
        route_id: (route as DispatchRouteRow).id,
        recipient_id: recipient.id,
        stop_order: index + 1,
        meals: recipient.meals,
      })),
    )

    if (recipientsError) {
      setSaving(false)
      setError('Could not attach recipients to route.')
      return
    }

    await getSupabase()
      .from('recipients')
      .update({ status: 'active' })
      .in('id', selected.map((recipient) => recipient.id))

    await Promise.all([loadRoutes(batch.id), loadDispatchData()])
    setRouteName(`Route ${routes.length + 2}`)
    setSevadarName('')
    setSevadarPhone('')
    setSelectedRecipients([])
    setSaving(false)
  }

  async function updateBatchStatus(status: 'pickup' | 'dispatched') {
    if (!batch) return
    setSaving(true)
    const { data, error: updateError } = await getSupabase()
      .from('batches')
      .update({ status })
      .eq('id', batch.id)
      .select()
      .single()
    setSaving(false)
    if (updateError) {
      setError('Could not update batch status.')
      return
    }
    setBatch(data as BatchRow)
  }

  async function updateRouteStatus(routeId: string, status: DispatchRouteStatus) {
    if (!batch) return
    setSaving(true)
    const { error: updateError } = await getSupabase()
      .from('dispatch_routes')
      .update({ status })
      .eq('id', routeId)
    setSaving(false)
    if (updateError) {
      setError('Could not update route status.')
      return
    }
    await loadRoutes(batch.id)
  }

  return (
    <StaffConsoleLayout
      title="Dispatch Console"
      subtitle="Build route bundles from approved recipients and release meals to sevadars."
      backTo="/staff"
      stepLabel="Step 03 · Dispatch"
    >
      {loading && (
        <div className="dispatch-state" role="status">
          Loading dispatch…
        </div>
      )}

      {!loading && error && (
        <div className="dispatch-alert dispatch-alert--error" role="alert">
          {error}
        </div>
      )}

      {!loading && !batch && (
        <div className="dispatch-state">
          No batch exists for today. Create today&apos;s kitchen batch first.
        </div>
      )}

      {!loading && batch && (
        <>
          <section className="dispatch-overview" aria-label="Dispatch overview">
            <div className="dispatch-overview__item">
              <p className="dispatch-overview__label">Batch stage</p>
              <p className="dispatch-overview__value">{batch.status}</p>
            </div>
            <div className="dispatch-overview__item">
              <p className="dispatch-overview__label">Packed meals</p>
              <p className="dispatch-overview__value">
                {batch.meal_count_packed}/{batch.meal_count_planned}
              </p>
            </div>
            <div className="dispatch-overview__item">
              <p className="dispatch-overview__label">Routed meals</p>
              <p className="dispatch-overview__value">{routeMeals}</p>
            </div>
            <div className="dispatch-overview__item">
              <p className="dispatch-overview__label">Pickup</p>
              <p className="dispatch-overview__value dispatch-overview__value--small">{formatWindow(batch)}</p>
            </div>
          </section>

          <section className="dispatch-panel">
            <div className="dispatch-panel__header">
              <div>
                <p className="dispatch-panel__eyebrow">Route builder</p>
                <h2 className="dispatch-panel__title">{batch.menu}</h2>
                <p className="dispatch-panel__copy">
                  Pickup from {batch.service_location_name}
                  {batch.service_location_address ? ` · ${batch.service_location_address}` : ''}
                </p>
              </div>
              <div className="dispatch-panel__actions">
                {batch.status === 'ready' && (
                  <button
                    type="button"
                    className="dispatch-button dispatch-button--primary"
                    disabled={saving}
                    onClick={() => void updateBatchStatus('pickup')}
                  >
                    Open pickup window
                  </button>
                )}
                {batch.status === 'pickup' && (
                  <button
                    type="button"
                    className="dispatch-button dispatch-button--primary"
                    disabled={saving}
                    onClick={() => void updateBatchStatus('dispatched')}
                  >
                    Mark batch dispatched
                  </button>
                )}
              </div>
            </div>

            <form className="dispatch-form" onSubmit={handleCreateRoute}>
              <div className="dispatch-form__grid">
                <label className="dispatch-field">
                  <span>Route name</span>
                  <input value={routeName} onChange={(e) => setRouteName(e.target.value)} />
                </label>
                <label className="dispatch-field">
                  <span>Sevadar name</span>
                  <input value={sevadarName} onChange={(e) => setSevadarName(e.target.value)} />
                </label>
                <label className="dispatch-field">
                  <span>Sevadar phone</span>
                  <input value={sevadarPhone} onChange={(e) => setSevadarPhone(e.target.value)} />
                </label>
              </div>

              <div className="dispatch-recipient-picker">
                <div className="dispatch-recipient-picker__header">
                  <p>Approved recipients</p>
                  <span>{selectedMeals} meals selected</span>
                </div>
                {availableRecipients.length === 0 ? (
                  <p className="dispatch-recipient-picker__empty">No approved recipients are waiting for route assignment.</p>
                ) : (
                  <div className="dispatch-recipient-picker__list">
                    {availableRecipients.map((recipient) => (
                      <label key={recipient.id} className="dispatch-recipient-option">
                        <input
                          type="checkbox"
                          checked={selectedRecipients.includes(recipient.id)}
                          onChange={(event) => {
                            setSelectedRecipients((current) =>
                              event.target.checked
                                ? [...current, recipient.id]
                                : current.filter((id) => id !== recipient.id),
                            )
                          }}
                        />
                        <span>
                          <strong>{recipient.name}</strong>
                          <small>
                            {recipient.meals} meals · {DELIVERY_WINDOW_LABELS[recipient.delivery_window]} ·{' '}
                            {formatRecipientAddress(recipient)}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" className="dispatch-button dispatch-button--primary" disabled={saving || !batch}>
                {saving ? 'Saving…' : 'Create route bundle'}
              </button>
            </form>
          </section>

          <section className="dispatch-routes" aria-labelledby="dispatch-routes-heading">
            <div className="dispatch-routes__header">
              <h2 id="dispatch-routes-heading">Route bundles</h2>
              <span>{routes.length} routes</span>
            </div>
            {routes.length === 0 ? (
              <p className="dispatch-routes__empty">No route bundles yet.</p>
            ) : (
              <div className="dispatch-routes__list">
                {routes.map((route) => (
                  <article key={route.id} className="dispatch-route-card">
                    <div className="dispatch-route-card__header">
                      <div>
                        <p className="dispatch-route-card__eyebrow">{statusLabel(route.status)}</p>
                        <h3>{route.route_name}</h3>
                        <p>{route.sevadar?.name ?? 'Unassigned sevadar'}{route.sevadar?.phone ? ` · ${route.sevadar.phone}` : ''}</p>
                      </div>
                      <span>{route.recipients.reduce((sum, entry) => sum + entry.meals, 0)} meals</span>
                    </div>
                    <ol className="dispatch-route-card__stops">
                      {route.recipients.map((entry) => (
                        <li key={entry.id}>
                          <span>{entry.stop_order}</span>
                          <div>
                            <strong>{entry.recipient?.name ?? 'Recipient'}</strong>
                            <small>{entry.recipient ? formatRecipientAddress(entry.recipient) : ''}</small>
                          </div>
                        </li>
                      ))}
                    </ol>
                    <div className="dispatch-route-card__actions">
                      {route.status === 'assigned' && (
                        <button
                          type="button"
                          className="dispatch-button"
                          disabled={saving}
                          onClick={() => void updateRouteStatus(route.id, 'picked_up')}
                        >
                          Mark picked up
                        </button>
                      )}
                      {route.status === 'picked_up' && (
                        <button
                          type="button"
                          className="dispatch-button"
                          disabled={saving}
                          onClick={() => void updateRouteStatus(route.id, 'completed')}
                        >
                          Mark completed
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </StaffConsoleLayout>
  )
}
