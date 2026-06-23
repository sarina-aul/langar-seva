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

interface BatchViewProps {
  batch: BatchRow
  onBatchUpdated: (batch: BatchRow) => void
}

function BatchView({ batch, onBatchUpdated }: BatchViewProps) {
  const next = nextStage(batch.status)
  const [advancing, setAdvancing] = useState(false)
  const [advanceError, setAdvanceError] = useState<string | null>(null)

  const warnPackedShort =
    batch.status === 'packing' &&
    next === 'ready' &&
    batch.meal_count_packed < batch.meal_count_planned

  async function handleAdvance() {
    if (!next) return
    setAdvanceError(null)
    setAdvancing(true)
    const { data, error } = await getSupabase()
      .from('batches')
      .update({ status: next })
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
            {batch.notes?.trim() || 'Tonight\'s langar'}
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

          {batch.status !== 'packing' && batch.status !== 'pickup' && batch.status !== 'dispatched' && (
            <p className="kitchen-stage-card__meta">
              {batch.meal_count_packed} of {batch.meal_count_planned} packed
            </p>
          )}

          {warnPackedShort && (
            <p className="kitchen-alert kitchen-alert--warn" role="alert">
              {batch.meal_count_packed}/{batch.meal_count_planned} packed — advance anyway?
            </p>
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
                disabled={advancing}
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
          <p className="kitchen-panel__footer-label">Stage</p>
          <p className="kitchen-panel__footer-value kitchen-panel__footer-value--sm">
            {BATCH_STAGE_LABELS[batch.status]}
          </p>
        </div>
      </footer>

      <StageHistory batch={batch} />
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
