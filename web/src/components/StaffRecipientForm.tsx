import { useState } from 'react'
import {
  CONTACT_PREF_OPTIONS,
  DELIVERY_WINDOW_OPTIONS,
  FREQUENCY_OPTIONS,
  LANGUAGE_OPTIONS,
} from '../lib/recipientLabels'
import { getSupabase } from '../lib/supabase'
import { isValidPostalCode, normalizePostalCode, POSTAL_CODE_HINT } from '../lib/postalCode'
import type {
  ContactPref,
  DeliveryFrequency,
  DeliveryWindow,
  LanguagePref,
  RecipientInsert,
  RecipientRow,
} from '../types/database'
import './StaffRecipientForm.css'

export interface StaffRecipientFormData {
  name: string
  phone: string
  address: string
  unit_buzz: string
  postal_code: string
  household_size: number
  meals: number
  delivery_window: DeliveryWindow
  language: LanguagePref
  frequency: DeliveryFrequency | ''
  contact_pref: ContactPref | ''
  notes: string
}

interface FieldErrors {
  name?: string
  phone?: string
  address?: string
  unit_buzz?: string
  postal_code?: string
  household_size?: string
  meals?: string
}

function recipientToForm(recipient: RecipientRow): StaffRecipientFormData {
  return {
    name: recipient.name,
    phone: recipient.phone,
    address: recipient.address,
    unit_buzz: recipient.unit_buzz,
    postal_code: recipient.postal_code ?? '',
    household_size: recipient.household_size,
    meals: recipient.meals,
    delivery_window: recipient.delivery_window,
    language: recipient.language,
    frequency: recipient.frequency ?? '',
    contact_pref: recipient.contact_pref ?? '',
    notes: recipient.notes ?? '',
  }
}

const emptyForm: StaffRecipientFormData = {
  name: '',
  phone: '',
  address: '',
  unit_buzz: '',
  postal_code: '',
  household_size: 1,
  meals: 1,
  delivery_window: 'flexible',
  language: 'english',
  frequency: '',
  contact_pref: '',
  notes: '',
}

function validate(data: StaffRecipientFormData): FieldErrors {
  const errors: FieldErrors = {}
  if (!data.name.trim()) errors.name = 'Name is required.'
  if (!data.phone.trim()) errors.phone = 'Phone is required.'
  if (!data.address.trim()) errors.address = 'Address is required.'
  if (!data.unit_buzz.trim()) errors.unit_buzz = 'Unit or buzzer is required (use "none" if not applicable).'
  if (!data.postal_code.trim()) {
    errors.postal_code = 'Postal code is required for routing.'
  } else if (!isValidPostalCode(data.postal_code)) {
    errors.postal_code = `Enter a valid Canadian postal code (${POSTAL_CODE_HINT}).`
  }
  if (data.household_size < 1 || data.household_size > 20) {
    errors.household_size = 'Household size must be between 1 and 20.'
  }
  if (data.meals < 1 || data.meals > 20) {
    errors.meals = 'Meals must be between 1 and 20.'
  } else if (data.meals > data.household_size) {
    errors.meals = 'Meals cannot exceed household size.'
  }
  return errors
}

function toPayload(data: StaffRecipientFormData): RecipientInsert {
  return {
    name: data.name.trim(),
    phone: data.phone.trim(),
    address: data.address.trim(),
    unit_buzz: data.unit_buzz.trim(),
    postal_code: normalizePostalCode(data.postal_code),
    household_size: data.household_size,
    meals: data.meals,
    delivery_window: data.delivery_window,
    language: data.language,
    frequency: data.frequency || null,
    contact_pref: data.contact_pref || null,
    notes: data.notes.trim() || null,
    status: 'pending',
  }
}

interface StaffRecipientFormProps {
  mode: 'create' | 'edit'
  recipient?: RecipientRow
  onCancel: () => void
  onSaved: (recipient: RecipientRow) => void
}

export function StaffRecipientForm({ mode, recipient, onCancel, onSaved }: StaffRecipientFormProps) {
  const [form, setForm] = useState<StaffRecipientFormData>(
    recipient ? recipientToForm(recipient) : emptyForm,
  )
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function updateField<K extends keyof StaffRecipientFormData>(key: K, value: StaffRecipientFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitError(null)

    const fieldErrors = validate(form)
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      return
    }

    setSubmitting(true)
    const payload = toPayload(form)

    if (mode === 'create') {
      const { data, error } = await getSupabase()
        .from('recipients')
        .insert({ ...payload, intake_channel: 'staff' })
        .select()
        .single()

      setSubmitting(false)
      if (error || !data) {
        setSubmitError('Could not save recipient request.')
        return
      }
      onSaved(data as RecipientRow)
      return
    }

    if (!recipient) {
      setSubmitting(false)
      return
    }

    const { data, error } = await getSupabase()
      .from('recipients')
      .update(payload)
      .eq('id', recipient.id)
      .select()
      .single()

    setSubmitting(false)
    if (error || !data) {
      setSubmitError('Could not update recipient request.')
      return
    }
    onSaved(data as RecipientRow)
  }

  return (
    <form className="staff-recipient-form" onSubmit={(event) => void handleSubmit(event)}>
      <div className="staff-recipient-form__grid">
        <label className="staff-recipient-form__field">
          <span>Name</span>
          <input value={form.name} onChange={(e) => updateField('name', e.target.value)} />
          {errors.name && <small role="alert">{errors.name}</small>}
        </label>
        <label className="staff-recipient-form__field">
          <span>Phone</span>
          <input value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
          {errors.phone && <small role="alert">{errors.phone}</small>}
        </label>
        <label className="staff-recipient-form__field staff-recipient-form__field--wide">
          <span>Address</span>
          <input value={form.address} onChange={(e) => updateField('address', e.target.value)} />
          {errors.address && <small role="alert">{errors.address}</small>}
        </label>
        <label className="staff-recipient-form__field">
          <span>Unit / buzzer</span>
          <input value={form.unit_buzz} onChange={(e) => updateField('unit_buzz', e.target.value)} />
          {errors.unit_buzz && <small role="alert">{errors.unit_buzz}</small>}
        </label>
        <label className="staff-recipient-form__field">
          <span>Postal code</span>
          <input
            value={form.postal_code}
            placeholder={POSTAL_CODE_HINT}
            onChange={(e) => updateField('postal_code', e.target.value.toUpperCase())}
          />
          {errors.postal_code && <small role="alert">{errors.postal_code}</small>}
        </label>
        <label className="staff-recipient-form__field">
          <span>Household size</span>
          <input
            type="number"
            min={1}
            max={20}
            value={form.household_size}
            onChange={(e) => updateField('household_size', Number(e.target.value))}
          />
          {errors.household_size && <small role="alert">{errors.household_size}</small>}
        </label>
        <label className="staff-recipient-form__field">
          <span>Meals</span>
          <input
            type="number"
            min={1}
            max={20}
            value={form.meals}
            onChange={(e) => updateField('meals', Number(e.target.value))}
          />
          {errors.meals && <small role="alert">{errors.meals}</small>}
        </label>
        <label className="staff-recipient-form__field">
          <span>Delivery window</span>
          <select
            value={form.delivery_window}
            onChange={(e) => updateField('delivery_window', e.target.value as DeliveryWindow)}
          >
            {DELIVERY_WINDOW_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="staff-recipient-form__field">
          <span>Language</span>
          <select
            value={form.language}
            onChange={(e) => updateField('language', e.target.value as LanguagePref)}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="staff-recipient-form__field">
          <span>Frequency</span>
          <select
            value={form.frequency}
            onChange={(e) => updateField('frequency', e.target.value as DeliveryFrequency | '')}
          >
            <option value="">Not specified</option>
            {FREQUENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="staff-recipient-form__field">
          <span>Contact preference</span>
          <select
            value={form.contact_pref}
            onChange={(e) => updateField('contact_pref', e.target.value as ContactPref | '')}
          >
            <option value="">Not specified</option>
            {CONTACT_PREF_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="staff-recipient-form__field staff-recipient-form__field--wide">
          <span>Notes</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
          />
        </label>
      </div>

      {submitError && (
        <p className="staff-recipient-form__error" role="alert">
          {submitError}
        </p>
      )}

      <div className="staff-recipient-form__actions">
        <button type="button" className="staff-recipient-form__button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="staff-recipient-form__button staff-recipient-form__button--primary" disabled={submitting}>
          {submitting ? 'Saving…' : mode === 'create' ? 'Add pending request' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
