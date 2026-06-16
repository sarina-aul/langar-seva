import type { RecipientRow } from '../types/database'
import './Confirmation.css'

const WINDOW_LABELS: Record<string, string> = {
  morning: 'Morning (8am – 11am)',
  afternoon: 'Afternoon (11am – 3pm)',
  evening: 'Evening (3pm – 7pm)',
  flexible: 'Flexible',
}

const LANGUAGE_LABELS: Record<string, string> = {
  english: 'English',
  punjabi: 'Punjabi',
  hindi: 'Hindi',
  urdu: 'Urdu',
  other: 'Other',
}

interface ConfirmationProps {
  recipient: RecipientRow
  onReset: () => void
}

export function Confirmation({ recipient, onReset }: ConfirmationProps) {
  return (
    <div className="form-card confirmation">
      <div className="confirmation__icon" aria-hidden="true">
        ✓
      </div>

      <h2 className="confirmation__heading">Request received</h2>

      <div className="status-badge" role="status">
        <span className="status-badge__dot" aria-hidden="true" />
        Pending review
      </div>

      <p className="confirmation__message">
        Thank you, {recipient.name.split(' ')[0]}. A coordinator will review your request and
        contact you at {recipient.phone} if we need anything else.
      </p>

      <dl className="confirmation__details">
        <dt>Delivery address</dt>
        <dd>
          {recipient.address}
          {recipient.unit_buzz ? `, ${recipient.unit_buzz}` : ''}
        </dd>

        <dt>Meals</dt>
        <dd>
          {recipient.meals} meal{recipient.meals === 1 ? '' : 's'} for household of{' '}
          {recipient.household_size}
        </dd>

        <dt>Delivery window</dt>
        <dd>{WINDOW_LABELS[recipient.delivery_window] ?? recipient.delivery_window}</dd>

        <dt>Language</dt>
        <dd>{LANGUAGE_LABELS[recipient.language] ?? recipient.language}</dd>
      </dl>

      <button type="button" className="btn-secondary" onClick={onReset}>
        Submit another request
      </button>
    </div>
  )
}
