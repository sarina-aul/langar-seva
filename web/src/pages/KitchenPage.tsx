import { type FormEvent, useEffect, useState } from 'react'
import { StaffConsoleLayout } from '../components/StaffConsoleLayout'
import { useAuth } from '../hooks/useAuth'
import { isCoordinator } from '../lib/roles'
import { getSupabase } from '../lib/supabase'
import {
  BATCH_STAGE_DESCRIPTIONS,
  BATCH_STAGE_LABELS,
  BATCH_STAGE_NEXT_ACTION,
  BATCH_STAGES,
  type BatchAuditEventRow,
  type BatchInsert,
  type BatchRow,
  type BatchStatus,
} from '../types/database'
import './KitchenPage.css'

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA')
}

function nextStage(status: BatchStatus): BatchStatus | null {
  const idx = BATCH_STAGES.indexOf(status)
  return idx < BATCH_STAGES.length - 1 ? BATCH_STAGES[idx + 1] : null
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function stageTimestamp(batch: BatchRow, stage: BatchStatus): string | null {
  switch (stage) {
    case 'prep':
      return batch.created_at
    case 'cooking':
      return batch.cooking_at
    case 'packing':
      return batch.packing_at
    case 'ready':
      return batch.ready_at
    case 'pickup':
      return batch.pickup_at
    case 'dispatched':
      return batch.dispatched_at
    default:
      return null
  }
}

interface CreateBatchFormProps {
  onCreated: (batch: BatchRow) => void
}

function CreateBatchForm({ onCreated }: CreateBatchFormProps) {
  const { user } = useAuth()
  const [planned, setPlanned] = useState('')
  const [menu, setMenu] = useState('Dal, roti, sabzi, rice')
  const [pickupStart, setPickupStart] = useState('17:00')
  const [pickupEnd, setPickupEnd] = useState('19:00')
  const [locationName, setLocationName] = useState('Gurdwara kitchen')
  const [locationAddress, setLocationAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const count = parseInt(planned, 10)
    if (!planned || isNaN(count) || count < 1) {
      setError('Planned meal count must be at least 1.')
      return
    }
    setSubmitting(true)
    const payload: BatchInsert = {
      batch_date: todayIso(),
      meal_count_planned: count,
      menu: menu.trim() || 'Langar meal',
      pickup_window_start: pickupStart || null,
      pickup_window_end: pickupEnd || null,
      service_location_name: locationName.trim() || 'Gurdwara kitchen',
      service_location_address: locationAddress.trim() || null,
      notes: notes.trim() || null,
    }
    const { data, error: dbError } = await getSupabase()
      .from('batches')
      .insert({ ...payload, created_by: user?.id })
      .select()
      .single()
    setSubmitting(false)
    if (dbError) {
      if (dbError.message.includes('unique') || dbError.code === '23505') {
        setError('A batch already exists for today. Refresh to load it.')
      } else {
        setError('Could not create batch. Please try again.')
      }
      return
    }
    onCreated(data as BatchRow)
  }

  return (
    <section className="kitchen-panel kitchen-panel--create">
      <header className="kitchen-panel__header">
        <p className="kitchen-panel__eyebrow">New batch</p>
        <h2 className="kitchen-panel__title">Create tonight&apos;s batch</h2>
        <p className="kitchen-panel__copy">No batch has been created for today yet.</p>
      </header>

      <form className="kitchen-create-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="kitchen-alert kitchen-alert--error" role="alert">
            {error}
          </div>
        )}

        <div className="kitchen-field">
          <label className="kitchen-field__label" htmlFor="planned">
            Planned meals
          </label>
          <input
            id="planned"
            className="kitchen-field__input"
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            required
            value={planned}
            onChange={(e) => setPlanned(e.target.value)}
            disabled={submitting}
            placeholder="e.g. 180"
          />
        </div>

        <div className="kitchen-field">
          <label className="kitchen-field__label" htmlFor="batch-menu">
            Menu
          </label>
          <input
            id="batch-menu"
            className="kitchen-field__input"
            type="text"
            required
            value={menu}
            onChange={(e) => setMenu(e.target.value)}
            disabled={submitting}
            placeholder="e.g. Dal, roti, sabzi, rice"
          />
        </div>

        <div className="kitchen-field-grid">
          <div className="kitchen-field">
            <label className="kitchen-field__label" htmlFor="pickup-start">
              Pickup starts
            </label>
            <input
              id="pickup-start"
              className="kitchen-field__input"
              type="time"
              value={pickupStart}
              onChange={(e) => setPickupStart(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="kitchen-field">
            <label className="kitchen-field__label" htmlFor="pickup-end">
              Pickup ends
            </label>
            <input
              id="pickup-end"
              className="kitchen-field__input"
              type="time"
              value={pickupEnd}
              onChange={(e) => setPickupEnd(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        <div className="kitchen-field">
          <label className="kitchen-field__label" htmlFor="location-name">
            Service location
          </label>
          <input
            id="location-name"
            className="kitchen-field__input"
            type="text"
            required
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            disabled={submitting}
            placeholder="e.g. Ontario Khalsa Darbar"
          />
        </div>

        <div className="kitchen-field">
          <label className="kitchen-field__label" htmlFor="location-address">
            Pickup address <span className="kitchen-field__optional">optional</span>
          </label>
          <input
            id="location-address"
            className="kitchen-field__input"
            type="text"
            value={locationAddress}
            onChange={(e) => setLocationAddress(e.target.value)}
            disabled={submitting}
            placeholder="Address sevadars should come to"
          />
        </div>

        <div className="kitchen-field">
          <label className="kitchen-field__label" htmlFor="batch-notes">
            Notes <span className="kitchen-field__optional">optional</span>
          </label>
          <textarea
            id="batch-notes"
            className="kitchen-field__input kitchen-field__textarea"
            rows={2}
            placeholder="Tonight's menu or any special notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
          />
        </div>

        <button type="submit" className="kitchen-btn kitchen-btn--primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create batch'}
        </button>
      </form>
    </section>
  )
}

interface StageStepperProps {
  status: BatchStatus
}

function StageStepper({ status }: StageStepperProps) {
  const currentIdx = BATCH_STAGES.indexOf(status)

  return (
    <ol className="kitchen-stepper" aria-label="Batch stages">
      {BATCH_STAGES.map((stage, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <li key={stage} className="kitchen-stepper__item">
            <div className="kitchen-stepper__node-wrap">
              <span
                className={`kitchen-stepper__node${done ? ' kitchen-stepper__node--done' : ''}${active ? ' kitchen-stepper__node--active' : ''}`}
                aria-current={active ? 'step' : undefined}
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className={`kitchen-stepper__label${active ? ' kitchen-stepper__label--active' : ''}${done ? ' kitchen-stepper__label--done' : ''}`}
              >
                {BATCH_STAGE_LABELS[stage]}
              </span>
            </div>
            {i < BATCH_STAGES.length - 1 && (
              <span
                className={`kitchen-stepper__line${i < currentIdx ? ' kitchen-stepper__line--done' : ''}`}
                aria-hidden="true"
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

interface MealCountEditorProps {
  batch: BatchRow
  onUpdated: (batch: BatchRow) => void
}

function MealCountEditor({ batch, onUpdated }: MealCountEditorProps) {
  const [localValue, setLocalValue] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const disabled = batch.status === 'dispatched'

  const packed = localValue !== null ? parseInt(localValue, 10) || 0 : batch.meal_count_packed
  const progress = batch.meal_count_planned
    ? Math.min(100, Math.round((packed / batch.meal_count_planned) * 100))
    : 0

  async function handleBlur() {
    const next = parseInt(localValue ?? '', 10)
    setLocalValue(null)
    if (isNaN(next) || next < 0) return
    if (next === batch.meal_count_packed) return
    setSaving(true)
    setError(null)
    const { data, error: dbError } = await getSupabase()
      .from('batches')
      .update({ meal_count_packed: next })
      .eq('id', batch.id)
      .select()
      .single()
    setSaving(false)
    if (dbError) {
      setError('Could not save packed count.')
      return
    }
    onUpdated(data as BatchRow)
  }

  function bumpPacked(amount: number) {
    const next = Math.min(batch.meal_count_planned, Math.max(0, packed + amount))
    setLocalValue(String(next))
    void (async () => {
      setSaving(true)
      setError(null)
      const { data, error: dbError } = await getSupabase()
        .from('batches')
        .update({ meal_count_packed: next })
        .eq('id', batch.id)
        .select()
        .single()
      setSaving(false)
      setLocalValue(null)
      if (dbError) {
        setError('Could not save packed count.')
        return
      }
      onUpdated(data as BatchRow)
    })()
  }

  return (
    <div className="kitchen-meals">
      <div className="kitchen-meals__header">
        <span className="kitchen-meals__label">Meals packed</span>
        <span className="kitchen-meals__count">
          {packed}
          <span className="kitchen-meals__total">/ {batch.meal_count_planned}</span>
        </span>
      </div>
      <div className="kitchen-meals__bar" aria-hidden="true">
        <span className="kitchen-meals__bar-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="kitchen-meals__row">
        <input
          className="kitchen-meals__input"
          type="number"
          inputMode="numeric"
          min={0}
          max={9999}
          value={localValue ?? String(batch.meal_count_packed)}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => void handleBlur()}
          disabled={disabled || saving}
          aria-label="Meals packed"
        />
        {batch.status === 'packing' && !disabled && (
          <div className="kitchen-meals__quick">
            <button type="button" className="kitchen-meals__quick-btn" onClick={() => bumpPacked(20)}>
              +20 packed
            </button>
            <button
              type="button"
              className="kitchen-meals__quick-btn"
              onClick={() => bumpPacked(batch.meal_count_planned - packed)}
            >
              All packed
            </button>
          </div>
        )}
        {saving && <span className="kitchen-meals__saving">Saving…</span>}
      </div>
      {error && (
        <p className="kitchen-meals__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

interface StageHistoryProps {
  batch: BatchRow
}

function StageHistory({ batch }: StageHistoryProps) {
  const entries = BATCH_STAGES.map((stage) => ({
    stage,
    label: BATCH_STAGE_LABELS[stage],
    time: formatTime(stageTimestamp(batch, stage)),
  })).filter((entry) => entry.time)

  if (entries.length === 0) return null

  return (
    <section className="kitchen-timeline">
      <h3 className="kitchen-timeline__title">Stage timeline</h3>
      <ul className="kitchen-timeline__list">
        {entries.map((entry) => (
          <li key={entry.stage} className="kitchen-timeline__item">
            <span className="kitchen-timeline__name">{entry.label}</span>
            <span className="kitchen-timeline__time">{entry.time}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function formatAuditEvent(event: BatchAuditEventRow): string {
  switch (event.event_type) {
    case 'stage_changed':
      return `Stage changed from ${event.from_value} to ${event.to_value}`
    case 'packed_count_changed':
      return `Packed count changed from ${event.from_value} to ${event.to_value}`
    case 'short_count_reason_set':
      return 'Short-count reason recorded'
    case 'batch_plan_changed':
      return 'Batch plan updated'
    case 'route_created':
      return `Route created: ${event.to_value}`
    case 'route_status_changed':
      return `Route ${event.note ?? ''} moved from ${event.from_value} to ${event.to_value}`.trim()
  }
}

function BatchAuditTrail({ batchId }: { batchId: string }) {
  const [events, setEvents] = useState<BatchAuditEventRow[]>([])

  useEffect(() => {
    let mounted = true

    async function loadEvents() {
      const { data } = await getSupabase()
        .from('batch_audit_events')
        .select('*')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: false })
        .limit(8)

      if (mounted) {
        setEvents((data as BatchAuditEventRow[] | null) ?? [])
      }
    }

    void loadEvents()

    const channelId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`
    const channel = getSupabase()
      .channel(`batch_audit_events:${batchId}:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'batch_audit_events',
          filter: `batch_id=eq.${batchId}`,
        },
        (payload) => {
          const row = payload.new as BatchAuditEventRow
          setEvents((prev) => [row, ...prev].slice(0, 8))
        },
      )
      .subscribe()

    return () => {
      mounted = false
      void getSupabase().removeChannel(channel)
    }
  }, [batchId])

  if (events.length === 0) return null

  return (
    <section className="kitchen-timeline kitchen-timeline--audit">
      <h3 className="kitchen-timeline__title">Audit trail</h3>
      <ul className="kitchen-timeline__list">
        {events.map((event) => (
          <li key={event.id} className="kitchen-timeline__item">
            <span className="kitchen-timeline__name">{formatAuditEvent(event)}</span>
            <span className="kitchen-timeline__time">{formatTime(event.created_at)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface BatchViewProps {
  batch: BatchRow
  onBatchUpdated: (batch: BatchRow) => void
}

interface PrepReadinessProps {
  batch: BatchRow
  onBatchUpdated: (batch: BatchRow) => void
}

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function PrepReadiness({ batch, onBatchUpdated }: PrepReadinessProps) {
  const { user } = useAuth()
  const [saving, setSaving] = useState<'ingredients' | 'stations' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function setConfirmation(kind: 'ingredients' | 'stations', checked: boolean) {
    setSaving(kind)
    setError(null)

    const timestamp = checked ? new Date().toISOString() : null
    const update =
      kind === 'ingredients'
        ? {
            ingredients_confirmed_at: timestamp,
            prep_confirmed_by: checked ? user?.id : batch.prep_confirmed_by,
          }
        : {
            stations_confirmed_at: timestamp,
            prep_confirmed_by: checked ? user?.id : batch.prep_confirmed_by,
          }

    const { data, error: dbError } = await getSupabase()
      .from('batches')
      .update(update)
      .eq('id', batch.id)
      .select()
      .single()

    setSaving(null)

    if (dbError) {
      setError('Could not update prep confirmation. Please try again.')
      return
    }

    onBatchUpdated(data as BatchRow)
  }

  const prepReady = Boolean(batch.ingredients_confirmed_at && batch.stations_confirmed_at)

  return (
    <section className="kitchen-prep" aria-labelledby="prep-readiness-heading">
      <div className="kitchen-prep__header">
        <div>
          <p className="kitchen-prep__eyebrow">Prep readiness</p>
          <h4 id="prep-readiness-heading" className="kitchen-prep__title">
            Confirm kitchen setup before cooking
          </h4>
        </div>
        <span className={`kitchen-prep__status${prepReady ? ' kitchen-prep__status--ready' : ''}`}>
          {prepReady ? 'Ready' : 'Needs confirmation'}
        </span>
      </div>

      <dl className="kitchen-prep__details">
        <div>
          <dt>Planned count</dt>
          <dd>{batch.meal_count_planned} meals</dd>
        </div>
        <div>
          <dt>Menu</dt>
          <dd>{batch.menu}</dd>
        </div>
        <div>
          <dt>Service date</dt>
          <dd>{formatDate(batch.batch_date)}</dd>
        </div>
        <div>
          <dt>Service location</dt>
          <dd>{batch.service_location_name}</dd>
        </div>
      </dl>

      {batch.notes && (
        <div className="kitchen-prep__notes">
          <p>Menu notes</p>
          <span>{batch.notes}</span>
        </div>
      )}

      <div className="kitchen-prep__checks">
        <label className="kitchen-prep-check">
          <input
            type="checkbox"
            checked={Boolean(batch.ingredients_confirmed_at)}
            disabled={saving !== null}
            onChange={(event) => void setConfirmation('ingredients', event.target.checked)}
          />
          <span>
            <strong>Ingredients confirmed</strong>
            <small>
              {batch.ingredients_confirmed_at
                ? `Confirmed ${formatTime(batch.ingredients_confirmed_at)}`
                : 'Ingredients, containers, and labels are ready.'}
            </small>
          </span>
        </label>

        <label className="kitchen-prep-check">
          <input
            type="checkbox"
            checked={Boolean(batch.stations_confirmed_at)}
            disabled={saving !== null}
            onChange={(event) => void setConfirmation('stations', event.target.checked)}
          />
          <span>
            <strong>Stations confirmed</strong>
            <small>
              {batch.stations_confirmed_at
                ? `Confirmed ${formatTime(batch.stations_confirmed_at)}`
                : 'Prep tables, cooking area, and packing flow are set.'}
            </small>
          </span>
        </label>
      </div>

      <div className="kitchen-prep__future">
        <p>Coming next</p>
        <span>Ingredient checklist and volunteer/staffing needs will live here.</span>
      </div>

      {error && (
        <div className="kitchen-alert kitchen-alert--error" role="alert">
          {error}
        </div>
      )}
    </section>
  )
}

function formatElapsed(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) {
    return `${minutes} min`
  }

  return `${hours} hr ${minutes} min`
}

function CookingProgress({ batch }: { batch: BatchRow }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  const cookingStartedAt = batch.cooking_at ?? batch.updated_at
  const elapsed = formatElapsed(now - new Date(cookingStartedAt).getTime())

  return (
    <section className="kitchen-cooking" aria-labelledby="cooking-progress-heading">
      <div className="kitchen-cooking__header">
        <div>
          <p className="kitchen-cooking__eyebrow">Active meal prep</p>
          <h4 id="cooking-progress-heading" className="kitchen-cooking__title">
            Cooking started
          </h4>
        </div>
        <div className="kitchen-cooking__timer" aria-label={`Cooking elapsed time ${elapsed}`}>
          <span>{elapsed}</span>
          <small>elapsed</small>
        </div>
      </div>

      <dl className="kitchen-cooking__details">
        <div>
          <dt>Current stage</dt>
          <dd>{BATCH_STAGE_LABELS[batch.status]}</dd>
        </div>
        <div>
          <dt>Stage description</dt>
          <dd>{BATCH_STAGE_DESCRIPTIONS[batch.status]}</dd>
        </div>
        <div>
          <dt>Menu</dt>
          <dd>{batch.menu}</dd>
        </div>
        <div>
          <dt>Planned count</dt>
          <dd>{batch.meal_count_planned} meals</dd>
        </div>
      </dl>

    </section>
  )
}

function BatchView({ batch, onBatchUpdated }: BatchViewProps) {
  const prepReady = batch.status !== 'prep' || Boolean(batch.ingredients_confirmed_at && batch.stations_confirmed_at)
  const next = nextStage(batch.status)
  const [advancing, setAdvancing] = useState(false)
  const [advanceError, setAdvanceError] = useState<string | null>(null)
  const [shortCountReason, setShortCountReason] = useState(batch.short_count_reason ?? '')

  const warnPackedShort =
    batch.status === 'packing' &&
    next === 'ready' &&
    batch.meal_count_packed < batch.meal_count_planned

  async function handleAdvance() {
    if (!next) return
    if (batch.status === 'prep' && !prepReady) {
      setAdvanceError('Confirm ingredients and stations before starting cooking.')
      return
    }
    if (warnPackedShort && !shortCountReason.trim()) {
      setAdvanceError('Please record why the batch is short before marking it ready.')
      return
    }
    setAdvanceError(null)
    setAdvancing(true)
    const update: Partial<BatchInsert> = { status: next }
    if (warnPackedShort) {
      update.short_count_reason = shortCountReason.trim()
    }
    const { data, error } = await getSupabase()
      .from('batches')
      .update(update)
      .eq('id', batch.id)
      .select()
      .single()
    setAdvancing(false)
    if (error) {
      setAdvanceError('Could not advance stage. Please try again.')
      return
    }
    onBatchUpdated(data as BatchRow)
  }

  const nextAction = next ? BATCH_STAGE_NEXT_ACTION[batch.status] : null

  return (
    <section className="kitchen-panel kitchen-panel--batch">
      <header className="kitchen-panel__header kitchen-panel__header--batch">
        <div>
          <p className="kitchen-panel__eyebrow">Today&apos;s meal batch</p>
          <h2 className="kitchen-panel__title kitchen-panel__title--batch">
            {batch.menu}
          </h2>
          <p className="kitchen-panel__copy">
            {batch.meal_count_planned} meals for tonight&apos;s seva
          </p>
        </div>
        <div className="kitchen-panel__stat">
          <p className="kitchen-panel__stat-label">Planned</p>
          <p className="kitchen-panel__stat-value">{batch.meal_count_planned}</p>
        </div>
      </header>

      <StageStepper status={batch.status} />

      <div className="kitchen-stage-card">
        <div className="kitchen-stage-card__icon" aria-hidden="true">
          {batch.status === 'dispatched' ? '✓' : '◆'}
        </div>
        <div className="kitchen-stage-card__body">
          <p className="kitchen-stage-card__eyebrow">Current stage</p>
          <h3 className="kitchen-stage-card__title">{BATCH_STAGE_LABELS[batch.status]}</h3>
          <p className="kitchen-stage-card__copy">{BATCH_STAGE_DESCRIPTIONS[batch.status]}</p>

          {(batch.status === 'packing' || batch.status === 'pickup') && (
            <MealCountEditor batch={batch} onUpdated={onBatchUpdated} />
          )}

          {batch.status === 'prep' && (
            <PrepReadiness batch={batch} onBatchUpdated={onBatchUpdated} />
          )}

          {batch.status === 'cooking' && <CookingProgress batch={batch} />}

          {batch.status !== 'packing' && batch.status !== 'pickup' && batch.status !== 'dispatched' && (
            <p className="kitchen-stage-card__meta">
              {batch.meal_count_packed} of {batch.meal_count_planned} packed
            </p>
          )}

          {warnPackedShort && (
            <div className="kitchen-alert kitchen-alert--warn" role="alert">
              <p>{batch.meal_count_packed}/{batch.meal_count_planned} packed — record why before advancing.</p>
              <label className="kitchen-short-reason">
                <span>Short-count reason</span>
                <textarea
                  value={shortCountReason}
                  onChange={(e) => setShortCountReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. 5 requests held for tomorrow due to ingredient shortage"
                />
              </label>
            </div>
          )}

          {advanceError && (
            <div className="kitchen-alert kitchen-alert--error" role="alert">
              {advanceError}
            </div>
          )}

          {batch.status === 'dispatched' ? (
            <div className="kitchen-complete">
              <span aria-hidden="true">✓</span>
              Tonight&apos;s seva complete
            </div>
          ) : (
            nextAction &&
            next && (
              <button
                type="button"
                className="kitchen-btn kitchen-btn--primary kitchen-btn--advance"
                onClick={() => void handleAdvance()}
                disabled={advancing || !prepReady}
              >
                {advancing ? 'Advancing…' : `${nextAction} →`}
              </button>
            )
          )}

          {(batch.status === 'ready' || batch.status === 'pickup' || batch.status === 'dispatched') && (
            <p className="kitchen-stage-card__notify">
              <span aria-hidden="true">✓</span> Coordinator notified • Sevadars alerted
            </p>
          )}
        </div>
      </div>

      {batch.status !== 'packing' && batch.status !== 'pickup' && (
        <MealCountEditor batch={batch} onUpdated={onBatchUpdated} />
      )}

      <footer className="kitchen-panel__footer">
        <div className="kitchen-panel__footer-stat">
          <p className="kitchen-panel__footer-label">Total packages</p>
          <p className="kitchen-panel__footer-value">{batch.meal_count_planned}</p>
        </div>
        <div className="kitchen-panel__footer-stat">
          <p className="kitchen-panel__footer-label">Packed</p>
          <p className="kitchen-panel__footer-value">{batch.meal_count_packed}</p>
        </div>
        <div className="kitchen-panel__footer-stat">
          <p className="kitchen-panel__footer-label">Pickup window</p>
          <p className="kitchen-panel__footer-value kitchen-panel__footer-value--sm">
            {batch.pickup_window_start && batch.pickup_window_end
              ? `${batch.pickup_window_start.slice(0, 5)}–${batch.pickup_window_end.slice(0, 5)}`
              : 'Not set'}
          </p>
        </div>
      </footer>

      <section className="kitchen-pickup-details">
        <div>
          <p className="kitchen-pickup-details__label">Pickup location</p>
          <p className="kitchen-pickup-details__value">{batch.service_location_name}</p>
          {batch.service_location_address && (
            <p className="kitchen-pickup-details__sub">{batch.service_location_address}</p>
          )}
        </div>
        {batch.short_count_reason && (
          <div>
            <p className="kitchen-pickup-details__label">Short-count reason</p>
            <p className="kitchen-pickup-details__sub">{batch.short_count_reason}</p>
          </div>
        )}
      </section>

      <StageHistory batch={batch} />
      <BatchAuditTrail batchId={batch.id} />
    </section>
  )
}

export function KitchenPage() {
  const { user } = useAuth()
  const coordinator = isCoordinator(user)

  const [batch, setBatch] = useState<BatchRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function loadBatch() {
      setLoading(true)
      setFetchError(null)
      const { data, error } = await getSupabase()
        .from('batches')
        .select('*')
        .eq('batch_date', todayIso())
        .maybeSingle()

      if (!mounted) return
      if (error) {
        setFetchError('Could not load tonight\'s batch. Please refresh.')
      } else {
        setBatch(data as BatchRow | null)
      }
      setLoading(false)
    }
    void loadBatch()
    return () => {
      mounted = false
    }
  }, [])

  const dateLabel = new Date().toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <StaffConsoleLayout
      title="Kitchen Operations"
      subtitle={dateLabel}
      backTo="/staff"
      backLabel="Dashboard"
      stepLabel="Step 02 · Prepare"
    >
      {loading && (
        <div className="kitchen-state kitchen-state--loading" role="status">
          <p>Loading tonight&apos;s batch…</p>
        </div>
      )}

      {!loading && fetchError && (
        <div className="kitchen-alert kitchen-alert--error" role="alert">
          {fetchError}
        </div>
      )}

      {!loading && !fetchError && batch && (
        <BatchView batch={batch} onBatchUpdated={setBatch} />
      )}

      {!loading && !fetchError && !batch && coordinator && (
        <CreateBatchForm onCreated={setBatch} />
      )}

      {!loading && !fetchError && !batch && !coordinator && (
        <section className="kitchen-state kitchen-state--empty">
          <p className="kitchen-state__title">No batch for tonight yet</p>
          <p className="kitchen-state__copy">A coordinator will create it before service begins.</p>
        </section>
      )}
    </StaffConsoleLayout>
  )
}
