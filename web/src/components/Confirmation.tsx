import {
  DELIVERY_WINDOW_LABELS,
  formatRecipientAddress,
  LANGUAGE_LABELS,
} from '../lib/recipientLabels'
import type { RecipientRow } from '../types/database'
import './Confirmation.css'

interface ConfirmationProps {
  recipient: RecipientRow
  onReset: () => void
}

export function Confirmation({ recipient, onReset }: ConfirmationProps) {
  return (
    <div className="form-card confirmation surface-card">
      <div className="confirmation__icon" aria-hidden="true">
        ✓
      </div>

      <h2 className="confirmation__heading">Request received</h2>

      <div className="status-pill status-pill--pending" role="status">
        <span className="status-pill__dot" aria-hidden="true" />
        Pending review
      </div>

      <p className="confirmation__message">
        Thank you, {recipient.name.split(' ')[0]}. A coordinator will review your request and
        contact you at {recipient.phone} if we need anything else.
      </p>

      <dl className="confirmation__details">
        <dt>Delivery address</dt>
        <dd>{formatRecipientAddress(recipient)}</dd>

        <dt>Meals</dt>
        <dd>
          {recipient.meals} meal{recipient.meals === 1 ? '' : 's'} for household of{' '}
          {recipient.household_size}
        </dd>

        <dt>Delivery window</dt>
        <dd>{DELIVERY_WINDOW_LABELS[recipient.delivery_window] ?? recipient.delivery_window}</dd>

        <dt>Language</dt>
        <dd>{LANGUAGE_LABELS[recipient.language] ?? recipient.language}</dd>
      </dl>

      <button type="button" className="btn-secondary" onClick={onReset}>
        Submit another request
      </button>
    </div>
  )
}
