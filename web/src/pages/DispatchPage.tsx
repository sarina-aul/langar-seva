import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { StaffConsoleLayout } from '../components/StaffConsoleLayout'
import {
  DELIVERY_STOP_STATUS_LABELS,
  estimateStopEta,
  formatEtaWindow,
} from '../lib/deliveryTracking'
import { DELIVERY_WINDOW_LABELS, formatRecipientAddress } from '../lib/recipientLabels'
import { isValidPostalCode, normalizePostalCode, POSTAL_CODE_HINT } from '../lib/postalCode'
import { getSupabase } from '../lib/supabase'
import type {
  BatchRow,
  DeliveryNotificationRow,
  DeliveryNotificationStatus,
  DeliveryStopStatus,
  DeliveryTrackingLinkRow,
  DriverRouteLinkRow,
  DispatchRouteRow,
  DispatchRouteRecipientRow,
  DispatchRouteStatus,
  RecipientRow,
  SevadarRow,
} from '../types/database'
import './DispatchPage.css'

interface RouteRecipient {
  id: string
  stop_order: number
  meals: number
  delivery_status: DeliveryStopStatus
  eta_start: string | null
  eta_end: string | null
  status_updated_at: string
  client_visible_note: string | null
  delivered_at: string | null
  trackingLink: DeliveryTrackingLinkRow | null
  lastNotification: DeliveryNotificationRow | null
  recipient: RecipientRow | null
}

interface DispatchRouteWithDetails extends DispatchRouteRow {
  sevadar: SevadarRow | null
  recipients: RouteRecipient[]
  driverLink: DriverRouteLinkRow | null
  lastDriverNotification: DeliveryNotificationRow | null
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

function canTextRecipient(recipient: RecipientRow | null): boolean {
  return Boolean(recipient?.phone && (recipient.contact_pref === 'text' || recipient.contact_pref === 'either'))
}

function magicLinkStatus(
  link: Pick<DeliveryTrackingLinkRow | DriverRouteLinkRow, 'revoked_at' | 'expires_at' | 'sent_at'> | null,
  emptyLabel: string,
): string {
  if (!link) return emptyLabel
  if (link.revoked_at) return 'Revoked'
  if (new Date(link.expires_at).getTime() <= Date.now()) return 'Expired'
  if (link.sent_at) return 'Sent'
  return 'Created'
}

function canTextSevadar(sevadar: SevadarRow | null): boolean {
  return Boolean(sevadar?.phone?.trim())
}

function latestNotification(
  rows: DeliveryNotificationRow[] | DeliveryNotificationRow | null | undefined,
): DeliveryNotificationRow | null {
  if (!rows) return null
  const list = Array.isArray(rows) ? rows : [rows]
  if (list.length === 0) return null
  return [...list].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0]
}

function notificationLabel(status: DeliveryNotificationStatus | undefined): string | null {
  switch (status) {
    case 'failed':
      return 'SMS failed'
    case 'skipped':
      return 'SMS skipped'
    case 'logged':
      return 'SMS logged (dev)'
    case 'sent':
      return 'SMS sent'
    case 'queued':
      return 'SMS queued'
    default:
      return null
  }
}

function recipientReadinessIssues(recipient: RecipientRow): string[] {
  const issues: string[] = []
  if (!recipient.postal_code?.trim()) issues.push('missing postal code')
  if (!recipient.phone?.trim()) issues.push('missing phone')
  if (recipient.contact_pref === 'phone') issues.push('phone-only (no SMS)')
  return issues
}

export function DispatchPage() {
  const [batch, setBatch] = useState<BatchRow | null>(null)
  const [approvedRecipients, setApprovedRecipients] = useState<RecipientRow[]>([])
  const [routes, setRoutes] = useState<DispatchRouteWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [routeName, setRouteName] = useState('Route 1')
  const [sevadarName, setSevadarName] = useState('')
  const [sevadarPhone, setSevadarPhone] = useState('')
  const [sevadarHomePostal, setSevadarHomePostal] = useState('')
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
  const readinessWarnings = availableRecipients.flatMap((recipient) => {
    const issues = recipientReadinessIssues(recipient)
    return issues.length > 0 ? [`${recipient.name}: ${issues.join(', ')}`] : []
  })

  const loadRoutes = useCallback(async (batchId: string) => {
    const { data, error: routesError } = await getSupabase()
      .from('dispatch_routes')
      .select(
        `
          *,
          sevadars (*),
          driver_route_links (*),
          delivery_notifications (*),
          dispatch_route_recipients (
            id,
            stop_order,
            meals,
            delivery_status,
            eta_start,
            eta_end,
            status_updated_at,
            client_visible_note,
            delivered_at,
            delivery_tracking_links (*),
            delivery_notifications (*),
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
        driver_route_links?: DriverRouteLinkRow[] | DriverRouteLinkRow | null
        delivery_notifications?: DeliveryNotificationRow[] | DeliveryNotificationRow | null
        dispatch_route_recipients?: Array<{
          id: string
          stop_order: number
          meals: number
          delivery_status: DeliveryStopStatus
          eta_start: string | null
          eta_end: string | null
          status_updated_at: string
          client_visible_note: string | null
          delivered_at: string | null
          delivery_tracking_links?: DeliveryTrackingLinkRow[] | DeliveryTrackingLinkRow | null
          delivery_notifications?: DeliveryNotificationRow[] | DeliveryNotificationRow | null
          recipients?: RecipientRow | null
        }>
      }
      return {
        ...row,
        sevadar: row.sevadars ?? null,
        driverLink: Array.isArray(row.driver_route_links)
          ? row.driver_route_links[0] ?? null
          : row.driver_route_links ?? null,
        lastDriverNotification: latestNotification(row.delivery_notifications),
        recipients: (row.dispatch_route_recipients ?? [])
          .map((entry) => ({
            id: entry.id,
            stop_order: entry.stop_order,
            meals: entry.meals,
            delivery_status: entry.delivery_status,
            eta_start: entry.eta_start,
            eta_end: entry.eta_end,
            status_updated_at: entry.status_updated_at,
            client_visible_note: entry.client_visible_note,
            delivered_at: entry.delivered_at,
            trackingLink: Array.isArray(entry.delivery_tracking_links)
              ? entry.delivery_tracking_links[0] ?? null
              : entry.delivery_tracking_links ?? null,
            lastNotification: latestNotification(entry.delivery_notifications),
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
    if (!sevadarHomePostal.trim()) {
      setError('Enter the sevadar home postal code for route planning.')
      return
    }
    if (!isValidPostalCode(sevadarHomePostal)) {
      setError(`Enter a valid Canadian postal code for the sevadar home (${POSTAL_CODE_HINT}).`)
      return
    }

    setSaving(true)
    setError(null)

    const { data: sevadar, error: sevadarError } = await getSupabase()
      .from('sevadars')
      .insert({
        name: sevadarName.trim(),
        phone: sevadarPhone.trim() || null,
        home_postal_code: normalizePostalCode(sevadarHomePostal),
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
        ...estimateStopEta(new Date(), index + 1),
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

    await loadDispatchData()
    setRouteName(`Route ${routes.length + 2}`)
    setSevadarName('')
    setSevadarPhone('')
    setSevadarHomePostal('')
    setSelectedRecipients([])
    setSaving(false)
  }

  async function handleSendTrackingLink(entry: RouteRecipient) {
    if (!batch) return
    if (!canTextRecipient(entry.recipient)) {
      setError('This recipient needs a phone number and text/either contact preference before SMS tracking can be sent.')
      return
    }

    setSaving(true)
    setError(null)
    setStatusMessage(null)

    const origin = window.location.origin
    const { data: functionData, error: functionError } = await getSupabase().functions.invoke(
      'send-delivery-tracking-sms',
      {
        body: {
          routeRecipientId: entry.id,
          origin,
        },
      },
    )

    const result =
      functionData && typeof functionData === 'object'
        ? (functionData as { error?: string; trackingUrl?: string; mode?: string; ok?: boolean })
        : null

    if (result?.ok || result?.mode === 'sent' || result?.mode === 'logged') {
      await loadRoutes(batch.id)
      setStatusMessage(
        result.mode === 'logged'
          ? `Tracking link logged for development: ${result.trackingUrl ?? 'created'}`
          : 'Tracking SMS sent for this recipient.',
      )
      setSaving(false)
      return
    }

    if (result?.error || functionError) {
      await loadRoutes(batch.id)
      // Edge Function missing locally — fall back to clipboard without marking a false success.
      if (!result && functionError) {
        const { data, error: rpcError } = await getSupabase().rpc('create_delivery_tracking_link', {
          p_route_recipient_id: entry.id,
        })

        if (rpcError || !data?.[0]?.tracking_token) {
          setSaving(false)
          setError(functionError.message || 'Could not create the tracking link.')
          return
        }

        const trackingUrl = `${origin}/track/${data[0].tracking_token}`
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(trackingUrl)
        }

        await loadRoutes(batch.id)
        setStatusMessage(`Edge Function unavailable — tracking link copied for development: ${trackingUrl}`)
        setSaving(false)
        return
      }

      setSaving(false)
      setError(result?.error ?? functionError?.message ?? 'Tracking SMS failed. Retry from this stop.')
      return
    }

    setSaving(false)
    setError('Tracking SMS failed. Retry from this stop.')
  }

  async function handleSendDriverRouteLink(route: DispatchRouteWithDetails) {
    if (!batch) return
    if (!canTextSevadar(route.sevadar)) {
      setError('Enter a sevadar phone number on this route before sending the driver link.')
      return
    }

    setSaving(true)
    setError(null)
    setStatusMessage(null)

    const origin = window.location.origin
    const { data: functionData, error: functionError } = await getSupabase().functions.invoke(
      'send-driver-route-sms',
      {
        body: {
          routeId: route.id,
          origin,
        },
      },
    )

    const result =
      functionData && typeof functionData === 'object'
        ? (functionData as { error?: string; routeUrl?: string; mode?: string; ok?: boolean })
        : null

    if (result?.ok || result?.mode === 'sent' || result?.mode === 'logged') {
      await loadRoutes(batch.id)
      setStatusMessage(
        result.mode === 'logged'
          ? `Driver route link logged for development: ${result.routeUrl ?? 'created'}`
          : 'Driver route SMS sent for this sevadar.',
      )
      setSaving(false)
      return
    }

    if (result?.error || functionError) {
      await loadRoutes(batch.id)
      if (!result && functionError) {
        const { data, error: rpcError } = await getSupabase().rpc('create_driver_route_link', {
          p_route_id: route.id,
        })

        if (rpcError || !data?.[0]?.route_token) {
          setSaving(false)
          setError(functionError.message || 'Could not create the driver route link.')
          return
        }

        const routeUrl = `${origin}/driver/route/${data[0].route_token}`
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(routeUrl)
        }

        await loadRoutes(batch.id)
        setStatusMessage(`Edge Function unavailable — driver route link copied for development: ${routeUrl}`)
        setSaving(false)
        return
      }

      setSaving(false)
      setError(result?.error ?? functionError?.message ?? 'Driver route SMS failed. Retry from this route.')
      return
    }

    setSaving(false)
    setError('Driver route SMS failed. Retry from this route.')
  }

  async function handleRevokeDriverRouteLink(route: DispatchRouteWithDetails) {
    if (!batch) return
    setSaving(true)
    setError(null)

    const { error: revokeError } = await getSupabase().rpc('revoke_driver_route_link', {
      p_route_id: route.id,
    })

    setSaving(false)
    if (revokeError) {
      setError('Could not revoke the driver route link.')
      return
    }
    await loadRoutes(batch.id)
    setStatusMessage('Driver route link revoked.')
  }

  async function handleRevokeTrackingLink(entry: RouteRecipient) {
    if (!batch) return
    setSaving(true)
    setError(null)

    const { error: revokeError } = await getSupabase().rpc('revoke_delivery_tracking_link', {
      p_route_recipient_id: entry.id,
    })

    setSaving(false)
    if (revokeError) {
      setError('Could not revoke the tracking link.')
      return
    }
    await loadRoutes(batch.id)
    setStatusMessage('Client tracking link revoked.')
  }

  async function handleUpdateStop(entry: RouteRecipient, updates: Partial<DispatchRouteRecipientRow>) {
    if (!batch) return
    setSaving(true)
    setError(null)

    const { error: updateError } = await getSupabase()
      .from('dispatch_route_recipients')
      .update(updates)
      .eq('id', entry.id)

    setSaving(false)
    if (updateError) {
      setError('Could not update delivery status.')
      return
    }
    await loadRoutes(batch.id)
  }

  async function handleMarkDelayed(entry: RouteRecipient) {
    const eta = estimateStopEta(new Date(), entry.stop_order)
    await handleUpdateStop(entry, {
      delivery_status: 'delayed',
      eta_start: eta.eta_start,
      eta_end: eta.eta_end,
    })
  }

  async function handleBumpEta(entry: RouteRecipient) {
    const base = entry.eta_end ? new Date(entry.eta_end) : new Date()
    base.setMinutes(base.getMinutes() + 15)
    const eta = estimateStopEta(base, 1)
    await handleUpdateStop(entry, {
      eta_start: eta.eta_start,
      eta_end: eta.eta_end,
    })
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

      {!loading && statusMessage && (
        <div className="dispatch-alert dispatch-alert--success" role="status">
          {statusMessage}
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
                <label className="dispatch-field">
                  <span>Sevadar home postal code</span>
                  <input
                    value={sevadarHomePostal}
                    placeholder={POSTAL_CODE_HINT}
                    onChange={(e) => setSevadarHomePostal(e.target.value.toUpperCase())}
                  />
                </label>
              </div>

              <div className="dispatch-recipient-picker">
                <div className="dispatch-recipient-picker__header">
                  <p>Approved recipients</p>
                  <span>{selectedMeals} meals selected</span>
                </div>
                {readinessWarnings.length > 0 && (
                  <div className="dispatch-alert dispatch-alert--warn" role="status">
                    <p>Routing readiness warnings:</p>
                    <ul>
                      {readinessWarnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {availableRecipients.length === 0 ? (
                  <p className="dispatch-recipient-picker__empty">No approved recipients are waiting for route assignment.</p>
                ) : (
                  <div className="dispatch-recipient-picker__list">
                    {availableRecipients.map((recipient) => {
                      const issues = recipientReadinessIssues(recipient)
                      return (
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
                            {recipient.meals} meals · {DELIVERY_WINDOW_LABELS[recipient.delivery_window]}
                            {recipient.postal_code ? ` · ${recipient.postal_code}` : ' · No postal code'} ·{' '}
                            {formatRecipientAddress(recipient)}
                            {issues.length > 0 ? ` · Needs: ${issues.join(', ')}` : ''}
                          </small>
                        </span>
                      </label>
                      )
                    })}
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
                        {route.sevadar?.home_postal_code && (
                          <p>Home area: {route.sevadar.home_postal_code}</p>
                        )}
                        <p className="dispatch-route-card__driver-link">
                          Driver link: {magicLinkStatus(route.driverLink, 'No driver link yet')}
                          {!canTextSevadar(route.sevadar) ? ' · SMS unavailable' : ''}
                          {route.lastDriverNotification
                            ? ` · ${notificationLabel(route.lastDriverNotification.status)}`
                            : ''}
                        </p>
                        {route.lastDriverNotification?.status === 'failed' && (
                          <p className="dispatch-sms-failure" role="alert">
                            Driver SMS failed
                            {route.lastDriverNotification.error
                              ? `: ${route.lastDriverNotification.error}`
                              : ''}
                            . Retry with “Resend driver link”.
                          </p>
                        )}
                      </div>
                      <span>{route.recipients.reduce((sum, entry) => sum + entry.meals, 0)} meals</span>
                    </div>
                    <ol className="dispatch-route-card__stops">
                      {route.recipients.map((entry) => {
                        const smsLabel = notificationLabel(entry.lastNotification?.status)
                        const smsFailed = entry.lastNotification?.status === 'failed'
                        return (
                        <li key={entry.id}>
                          <span>{entry.stop_order}</span>
                          <div>
                            <strong>{entry.recipient?.name ?? 'Recipient'}</strong>
                            <small>{entry.recipient ? formatRecipientAddress(entry.recipient) : ''}</small>
                            <small>
                              {DELIVERY_STOP_STATUS_LABELS[entry.delivery_status]} · {formatEtaWindow(entry.eta_start, entry.eta_end)}
                            </small>
                            <small>
                              Tracking: {magicLinkStatus(entry.trackingLink, 'No link yet')}
                              {!canTextRecipient(entry.recipient) ? ' · SMS unavailable' : ''}
                              {smsLabel ? ` · ${smsLabel}` : ''}
                            </small>
                            {smsFailed && (
                              <p className="dispatch-sms-failure" role="alert">
                                Tracking SMS failed
                                {entry.lastNotification?.error
                                  ? `: ${entry.lastNotification.error}`
                                  : ''}
                                . Use Retry SMS.
                              </p>
                            )}
                          </div>
                          <div className="dispatch-route-card__stop-actions">
                            <button
                              type="button"
                              className="dispatch-button"
                              disabled={saving || !canTextRecipient(entry.recipient)}
                              onClick={() => void handleSendTrackingLink(entry)}
                            >
                              {smsFailed
                                ? 'Retry SMS'
                                : entry.trackingLink?.sent_at
                                  ? 'Resend link'
                                  : 'Send link'}
                            </button>
                            {entry.trackingLink && !entry.trackingLink.revoked_at && (
                              <button
                                type="button"
                                className="dispatch-button"
                                disabled={saving}
                                onClick={() => void handleRevokeTrackingLink(entry)}
                              >
                                Revoke link
                              </button>
                            )}
                            {entry.delivery_status !== 'delivered' && (
                              <button
                                type="button"
                                className="dispatch-button"
                                disabled={saving}
                                onClick={() => void handleUpdateStop(entry, { delivery_status: 'delivered' })}
                              >
                                Delivered
                              </button>
                            )}
                            {entry.delivery_status !== 'delayed' && entry.delivery_status !== 'delivered' && (
                              <button
                                type="button"
                                className="dispatch-button"
                                disabled={saving}
                                onClick={() => void handleMarkDelayed(entry)}
                              >
                                Mark delayed
                              </button>
                            )}
                            <button
                              type="button"
                              className="dispatch-button"
                              disabled={saving}
                              onClick={() => void handleBumpEta(entry)}
                            >
                              +15 min ETA
                            </button>
                          </div>
                        </li>
                        )
                      })}
                    </ol>
                    <div className="dispatch-route-card__actions">
                      <button
                        type="button"
                        className="dispatch-button dispatch-button--primary"
                        disabled={saving || !canTextSevadar(route.sevadar)}
                        onClick={() => void handleSendDriverRouteLink(route)}
                      >
                        {route.driverLink?.sent_at ? 'Resend driver link' : 'Send driver link'}
                      </button>
                      {route.driverLink && !route.driverLink.revoked_at && (
                        <button
                          type="button"
                          className="dispatch-button"
                          disabled={saving}
                          onClick={() => void handleRevokeDriverRouteLink(route)}
                        >
                          Revoke driver link
                        </button>
                      )}
                      <Link className="dispatch-button" to={`/staff/driver/routes/${route.id}`}>
                        Open driver sheet
                      </Link>
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
