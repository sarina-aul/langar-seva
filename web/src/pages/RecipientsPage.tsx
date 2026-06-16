import { useCallback, useEffect, useState } from 'react'
import { StaffLayout } from '../components/StaffLayout'
import {
  CONTACT_PREF_LABELS,
  DELIVERY_WINDOW_LABELS,
  formatRecipientAddress,
  formatSubmittedDate,
  FREQUENCY_LABELS,
  LANGUAGE_LABELS,
  RECIPIENT_STATUS_LABELS,
} from '../lib/recipientLabels'
import { getSupabase } from '../lib/supabase'
import type { RecipientFilterStatus, RecipientRow, RecipientStatus } from '../types/database'
import './RecipientsPage.css'

const FILTER_TABS: { value: RecipientFilterStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

const EMPTY_MESSAGES: Record<RecipientFilterStatus, string> = {
  pending: 'No pending requests.',
  approved: 'No approved recipients yet.',
  rejected: 'No rejected requests.',
  all: 'No recipient requests yet.',
}

function statusMatchesFilter(status: RecipientStatus, filter: RecipientFilterStatus): boolean {
  if (filter === 'all') return true
  return status === filter
}

interface RecipientCardProps {
  recipient: RecipientRow
  savingId: string | null
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

function RecipientCard({ recipient, savingId, onApprove, onReject }: RecipientCardProps) {
  const isPending = recipient.status === 'pending'
  const isSaving = savingId === recipient.id

  return (
    <article className="recipient-card surface-card">
      <div className="recipient-card__header">
        <div>
          <h3 className="recipient-card__name">{recipient.name}</h3>
          <p className="recipient-card__meta">
            {recipient.phone} · Submitted {formatSubmittedDate(recipient.created_at)}
          </p>
        </div>
        <span className={`status-pill status-pill--${recipient.status}`}>
          <span className="status-pill__dot" aria-hidden="true" />
          {RECIPIENT_STATUS_LABELS[recipient.status]}
        </span>
      </div>

      <dl className="recipient-card__details">
        <div className="recipient-card__row">
          <dt>Address</dt>
          <dd>{formatRecipientAddress(recipient)}</dd>
        </div>
        <div className="recipient-card__row">
          <dt>Meals</dt>
          <dd>
            {recipient.meals} meal{recipient.meals === 1 ? '' : 's'} · household of{' '}
            {recipient.household_size}
          </dd>
        </div>
        <div className="recipient-card__row">
          <dt>Window</dt>
          <dd>{DELIVERY_WINDOW_LABELS[recipient.delivery_window]}</dd>
        </div>
        <div className="recipient-card__row">
          <dt>Language</dt>
          <dd>{LANGUAGE_LABELS[recipient.language]}</dd>
        </div>
        {recipient.frequency && (
          <div className="recipient-card__row">
            <dt>Frequency</dt>
            <dd>{FREQUENCY_LABELS[recipient.frequency]}</dd>
          </div>
        )}
        {recipient.contact_pref && (
          <div className="recipient-card__row">
            <dt>Contact</dt>
            <dd>{CONTACT_PREF_LABELS[recipient.contact_pref]}</dd>
          </div>
        )}
        {recipient.notes && (
          <div className="recipient-card__row">
            <dt>Notes</dt>
            <dd>{recipient.notes}</dd>
          </div>
        )}
      </dl>

      {isPending && (
        <div className="recipient-card__actions">
          <button
            type="button"
            className="btn-primary btn-primary--inline recipient-card__approve"
            disabled={isSaving}
            onClick={() => onApprove(recipient.id)}
          >
            {isSaving ? 'Saving…' : 'Approve'}
          </button>
          <button
            type="button"
            className="btn-secondary recipient-card__reject"
            disabled={isSaving}
            onClick={() => onReject(recipient.id)}
          >
            Reject
          </button>
        </div>
      )}
    </article>
  )
}

export function RecipientsPage() {
  const [filter, setFilter] = useState<RecipientFilterStatus>('pending')
  const [recipients, setRecipients] = useState<RecipientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const fetchRecipients = useCallback(async () => {
    setLoading(true)
    setFetchError(null)

    let query = getSupabase()
      .from('recipients')
      .select('*')
      .order('created_at', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data, error } = await query

    if (error) {
      setFetchError('Could not load recipients. Please refresh.')
      setRecipients([])
    } else {
      setRecipients((data as RecipientRow[]) ?? [])
    }
    setLoading(false)
  }, [filter])

  useEffect(() => {
    void fetchRecipients()
  }, [fetchRecipients])

  useEffect(() => {
    const channel = getSupabase()
      .channel('recipients_list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'recipients' },
        (payload) => {
          const row = payload.new as RecipientRow
          if (statusMatchesFilter(row.status, filter)) {
            setRecipients((prev) => {
              if (prev.some((r) => r.id === row.id)) return prev
              return [row, ...prev]
            })
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'recipients' },
        (payload) => {
          const row = payload.new as RecipientRow
          setRecipients((prev) => {
            const without = prev.filter((r) => r.id !== row.id)
            if (statusMatchesFilter(row.status, filter)) {
              return [row, ...without]
            }
            return without
          })
        },
      )
      .subscribe()

    return () => {
      void getSupabase().removeChannel(channel)
    }
  }, [filter])

  async function updateStatus(id: string, status: 'approved' | 'rejected') {
    setActionError(null)
    setSavingId(id)

    const { error } = await getSupabase()
      .from('recipients')
      .update({ status })
      .eq('id', id)

    setSavingId(null)

    if (error) {
      setActionError('Could not update recipient. Please try again.')
      return
    }

    if (filter !== 'all') {
      setRecipients((prev) => prev.filter((r) => r.id !== id))
    } else {
      setRecipients((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r)),
      )
    }
  }

  function handleApprove(id: string) {
    void updateStatus(id, 'approved')
  }

  function handleReject(id: string) {
    if (!window.confirm('Reject this request? The recipient will not receive meals.')) {
      return
    }
    void updateStatus(id, 'rejected')
  }

  return (
    <StaffLayout
      title="Recipients"
      subtitle="Review and approve langar requests"
      backTo="/staff"
    >
      <nav className="recipients-tabs" aria-label="Filter by status">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`recipients-tabs__item${filter === tab.value ? ' recipients-tabs__item--active' : ''}`}
              aria-current={filter === tab.value ? 'page' : undefined}
              onClick={() => setFilter(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {fetchError && (
          <div className="form-error-banner" role="alert">
            {fetchError}
          </div>
        )}

        {actionError && (
          <div className="form-error-banner" role="alert">
            {actionError}
          </div>
        )}

        {loading && (
          <div className="recipients-loading surface-card" role="status">
            <p>Loading recipients…</p>
          </div>
        )}

        {!loading && !fetchError && recipients.length === 0 && (
          <div className="recipients-empty surface-card">
            <p>{EMPTY_MESSAGES[filter]}</p>
          </div>
        )}

        {!loading && !fetchError && recipients.length > 0 && (
          <ul className="recipients-list">
            {recipients.map((recipient) => (
              <li key={recipient.id}>
                <RecipientCard
                  recipient={recipient}
                  savingId={savingId}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              </li>
            ))}
          </ul>
        )}
    </StaffLayout>
  )
}
