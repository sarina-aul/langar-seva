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
  const firstName = recipient.name.split(' ')[0]

  return (
    <div className="confirmation">
      <header className="confirmation__header">
        <p className="confirmation__scope">Request received</p>
        <h1 className="confirmation__title">Pending review</h1>
        <p className="confirmation__subtitle">
          A coordinator is reviewing your request.
        </p>
      </header>

      <div className="confirmation__body">
        <div className="confirmation__status" role="status">
          <span className="confirmation__status-dot" aria-hidden="true" />
          <span className="confirmation__status-label">Active request</span>
        </div>

        <p className="confirmation__message">
          Thank you, {firstName}. A coordinator will review your request and contact you at{' '}
          {recipient.phone} if we need anything else.
        </p>

        <dl className="confirmation__details">
          <div className="confirmation__detail">
            <dt>Delivery address</dt>
            <dd>{formatRecipientAddress(recipient)}</dd>
          </div>

          <div className="confirmation__detail">
            <dt>Meals</dt>
            <dd>
              {recipient.meals} meal{recipient.meals === 1 ? '' : 's'} for household of{' '}
              {recipient.household_size}
            </dd>
          </div>

          <div className="confirmation__detail">
            <dt>Delivery window</dt>
            <dd>{DELIVERY_WINDOW_LABELS[recipient.delivery_window] ?? recipient.delivery_window}</dd>
          </div>

          <div className="confirmation__detail">
            <dt>Language</dt>
            <dd>{LANGUAGE_LABELS[recipient.language] ?? recipient.language}</dd>
          </div>
        </dl>

        <p className="confirmation__footnote">
          You'll receive a text confirmation within 24 hours once your request is reviewed.
        </p>

        <button type="button" className="confirmation__reset" onClick={onReset}>
          Submit another request
        </button>
      </div>
    </div>
  )
}
