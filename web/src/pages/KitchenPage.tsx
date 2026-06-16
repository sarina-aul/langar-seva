import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isCoordinator } from '../lib/roles'
import { getSupabase } from '../lib/supabase'
import {
  BATCH_STAGE_LABELS,
  BATCH_STAGES,
  type BatchInsert,
  type BatchRow,
  type BatchStatus,
} from '../types/database'
import './KitchenPage.css'

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
}

function nextStage(status: BatchStatus): BatchStatus | null {
  const idx = BATCH_STAGES.indexOf(status)
  return idx < BATCH_STAGES.length - 1 ? BATCH_STAGES[idx + 1] : null
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

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
    <div className="kitchen-card">
      <h3 className="kitchen-card__title">Create tonight&apos;s batch</h3>
      <p className="kitchen-card__subtitle">No batch has been created for today yet.</p>

      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="form-error-banner" role="alert">
            {error}
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="planned">
            Planned meals
          </label>
          <input
            id="planned"
            className="field__input"
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

        <div className="field">
          <label className="field__label" htmlFor="batch-notes">
            Notes <span className="optional-tag">— optional</span>
          </label>
          <textarea
            id="batch-notes"
            className="field__textarea"
            rows={2}
            placeholder="Tonight's menu or any special notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create batch'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface StageProgressProps {
  status: BatchStatus
}

function StageProgress({ status }: StageProgressProps) {
  const currentIdx = BATCH_STAGES.indexOf(status)
  return (
    <ol className="stage-progress" aria-label="Batch stages">
      {BATCH_STAGES.map((stage, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <li
            key={stage}
            className={`stage-progress__step${done ? ' stage-progress__step--done' : ''}${active ? ' stage-progress__step--active' : ''}`}
            aria-current={active ? 'step' : undefined}
          >
            <span className="stage-progress__dot" aria-hidden="true">
              {done ? '✓' : i + 1}
            </span>
            <span className="stage-progress__label">{BATCH_STAGE_LABELS[stage]}</span>
          </li>
        )
      })}
    </ol>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface MealCountEditorProps {
  batch: BatchRow
  onUpdated: (batch: BatchRow) => void
}

function MealCountEditor({ batch, onUpdated }: MealCountEditorProps) {
  // Derive display value from batch directly; only allow local editing while focused
  const [localValue, setLocalValue] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const disabled = batch.status === 'dispatched'

  const value = localValue ?? String(batch.meal_count_packed)

  async function handleBlur() {
    const next = parseInt(localValue ?? '', 10)
    setLocalValue(null) // always revert local edit on blur
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

  return (
    <div className="meal-count">
      <p className="meal-count__label">Meals packed</p>
      <div className="meal-count__row">
        <input
          ref={inputRef}
          className="meal-count__input"
          type="number"
          inputMode="numeric"
          min={0}
          max={9999}
          value={value}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => void handleBlur()}
          disabled={disabled || saving}
          aria-label="Meals packed"
        />
        <span className="meal-count__of">/ {batch.meal_count_planned} planned</span>
        {saving && <span className="meal-count__saving">Saving…</span>}
      </div>
      {error && (
        <p className="meal-count__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface StageHistoryProps {
  batch: BatchRow
}

const STAGE_TS_KEYS: { stage: BatchStatus; key: keyof BatchRow; label: string }[] = [
  { stage: 'cooking',    key: 'cooking_at',    label: 'Cooking started' },
  { stage: 'packing',    key: 'packing_at',    label: 'Packing started' },
  { stage: 'ready',      key: 'ready_at',      label: 'Marked ready' },
  { stage: 'pickup',     key: 'pickup_at',     label: 'Pickup started' },
  { stage: 'dispatched', key: 'dispatched_at', label: 'Dispatched' },
]

function StageHistory({ batch }: StageHistoryProps) {
  const completed = STAGE_TS_KEYS.filter((s) => batch[s.key] !== null)
  if (completed.length === 0) return null

  return (
    <div className="stage-history">
      <h4 className="stage-history__title">Stage timeline</h4>
      <ul className="stage-history__list">
        <li className="stage-history__item">
          <span className="stage-history__name">Prep started</span>
          <span className="stage-history__time">{formatTime(batch.created_at)}</span>
        </li>
        {completed.map(({ key, label }) => (
          <li key={key} className="stage-history__item">
            <span className="stage-history__name">{label}</span>
            <span className="stage-history__time">{formatTime(batch[key] as string)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

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

  return (
    <div className="kitchen-batch">
      <div className="kitchen-card kitchen-card--stage">
        <div className="stage-header">
          <div>
            <p className="stage-header__label">Current stage</p>
            <h3 className="stage-header__stage">{BATCH_STAGE_LABELS[batch.status]}</h3>
          </div>
          {batch.status === 'dispatched' ? (
            <div className="stage-complete-badge">Batch complete</div>
          ) : (
            <div className="stage-actions">
              {warnPackedShort && (
                <p className="stage-warn" role="alert">
                  {batch.meal_count_packed}/{batch.meal_count_planned} packed — advance anyway?
                </p>
              )}
              {next && (
                <button
                  type="button"
                  className="btn-primary stage-advance-btn"
                  onClick={() => void handleAdvance()}
                  disabled={advancing}
                >
                  {advancing
                    ? 'Advancing…'
                    : `Advance to ${BATCH_STAGE_LABELS[next]}`}
                </button>
              )}
            </div>
          )}
        </div>

        {advanceError && (
          <div className="form-error-banner" role="alert">
            {advanceError}
          </div>
        )}

        <StageProgress status={batch.status} />
      </div>

      <MealCountEditor batch={batch} onUpdated={onBatchUpdated} />

      {batch.notes && (
        <div className="kitchen-card kitchen-notes">
          <p className="kitchen-notes__label">Notes</p>
          <p className="kitchen-notes__text">{batch.notes}</p>
        </div>
      )}

      <StageHistory batch={batch} />
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function KitchenPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
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
    return () => { mounted = false }
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="kitchen-layout">
      <header className="kitchen-header">
        <div className="kitchen-header__left">
          <Link to="/staff" className="kitchen-header__back">← Dashboard</Link>
          <h2 className="kitchen-header__title">Kitchen</h2>
          <p className="kitchen-header__date">
            {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => void handleSignOut()}>
          Sign out
        </button>
      </header>

      <main className="kitchen-main">
        {loading && (
          <div className="kitchen-loading" role="status">
            <p>Loading tonight&apos;s batch…</p>
          </div>
        )}

        {!loading && fetchError && (
          <div className="form-error-banner" role="alert">
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
          <div className="kitchen-card kitchen-empty">
            <p className="kitchen-empty__text">No batch has been created for tonight yet.</p>
            <p className="kitchen-empty__sub">
              A coordinator will create it before service begins.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
