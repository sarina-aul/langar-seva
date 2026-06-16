import { useState } from 'react'
import { getSupabase } from '../lib/supabase'
import type {
  ContactPref,
  DeliveryFrequency,
  DeliveryWindow,
  LanguagePref,
  RecipientInsert,
  RecipientRow,
} from '../types/database'
import './IntakeForm.css'

const DELIVERY_WINDOWS: { value: DeliveryWindow; label: string }[] = [
  { value: 'morning', label: 'Morning (8am – 11am)' },
  { value: 'afternoon', label: 'Afternoon (11am – 3pm)' },
  { value: 'evening', label: 'Evening (3pm – 7pm)' },
  { value: 'flexible', label: 'Flexible — any window works' },
]

const LANGUAGES: { value: LanguagePref; label: string }[] = [
  { value: 'english', label: 'English' },
  { value: 'punjabi', label: 'Punjabi' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'urdu', label: 'Urdu' },
  { value: 'other', label: 'Other' },
]

const FREQUENCIES: { value: DeliveryFrequency; label: string }[] = [
  { value: 'one_time', label: 'One time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every two weeks' },
  { value: 'monthly', label: 'Monthly' },
]

const CONTACT_PREFS: { value: ContactPref; label: string }[] = [
  { value: 'phone', label: 'Phone call' },
  { value: 'text', label: 'Text message' },
  { value: 'either', label: 'Either is fine' },
]

export interface IntakeFormData {
  name: string
  phone: string
  address: string
  unit_buzz: string
  household_size: number
  meals: number
  delivery_window: DeliveryWindow
  language: LanguagePref
  frequency: DeliveryFrequency | ''
  contact_pref: ContactPref | ''
  notes: string
}

const initialForm: IntakeFormData = {
  name: '',
  phone: '',
  address: '',
  unit_buzz: '',
  household_size: 1,
  meals: 1,
  delivery_window: 'flexible',
  language: 'english',
  frequency: '',
  contact_pref: '',
  notes: '',
}

interface FieldErrors {
  name?: string
  phone?: string
  address?: string
  unit_buzz?: string
  household_size?: string
  meals?: string
  delivery_window?: string
  language?: string
}

function validate(data: IntakeFormData): FieldErrors {
  const errors: FieldErrors = {}

  if (!data.name.trim()) errors.name = 'Please enter your name.'
  if (!data.phone.trim()) errors.phone = 'Please enter a phone number we can reach you at.'
  if (!data.address.trim()) errors.address = 'Please enter your delivery address.'
  if (!data.unit_buzz.trim()) errors.unit_buzz = 'Please enter your unit or buzzer number (or type "none").'
  if (data.household_size < 1 || data.household_size > 20) {
    errors.household_size = 'Household size must be between 1 and 20.'
  }
  if (data.meals < 1 || data.meals > 20) {
    errors.meals = 'Number of meals must be between 1 and 20.'
  }

  return errors
}

function recipientFromSubmission(payload: RecipientInsert): RecipientRow {
  const now = new Date().toISOString()
  return {
    ...payload,
    frequency: payload.frequency ?? null,
    contact_pref: payload.contact_pref ?? null,
    notes: payload.notes ?? null,
    status: 'pending',
    id: '',
    created_at: now,
    updated_at: now,
    geocode_lat: null,
    geocode_lng: null,
    geocode_place_id: null,
    geocoded_at: null,
  }
}

interface IntakeFormProps {
  onSuccess: (recipient: RecipientRow) => void
}

export function IntakeForm({ onSuccess }: IntakeFormProps) {
  const [form, setForm] = useState<IntakeFormData>(initialForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [mealsTouched, setMealsTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function updateField<K extends keyof IntakeFormData>(key: K, value: IntakeFormData[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }

      if (key === 'household_size' && !mealsTouched) {
        next.meals = value as number
      }

      return next
    })
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

    const payload: RecipientInsert = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      unit_buzz: form.unit_buzz.trim(),
      household_size: form.household_size,
      meals: form.meals,
      delivery_window: form.delivery_window,
      language: form.language,
      frequency: form.frequency || null,
      contact_pref: form.contact_pref || null,
      notes: form.notes.trim() || null,
      status: 'pending',
    }

    const { error } = await getSupabase().from('recipients').insert(payload)

    setSubmitting(false)

    if (error) {
      setSubmitError(
        error.message.includes('JWT')
          ? 'Unable to connect to our servers. Please try again shortly.'
          : error.message.includes('row-level security')
            ? 'Unable to submit right now. If you are signed in as staff, sign out and try again.'
            : 'Something went wrong submitting your request. Please try again.',
      )
      return
    }

    onSuccess(recipientFromSubmission(payload))
  }

  return (
    <div className="form-card">
      <div className="form-card__intro">
        <h2 className="form-card__heading">Request langar meals</h2>
        <p className="form-card__subtext">
          Tell us where to deliver. A coordinator will review your request — usually within one business day.
        </p>
      </div>

      {submitError && (
        <div className="form-error-banner" role="alert">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <section className="form-section" aria-labelledby="contact-heading">
          <h3 id="contact-heading" className="form-section__title">
            Contact
          </h3>

          <div className="field">
            <label className="field__label" htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              className={`field__input${errors.name ? ' field__input--error' : ''}`}
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
            />
            {errors.name && <span className="field__error">{errors.name}</span>}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="phone">
              Phone number
            </label>
            <input
              id="phone"
              className={`field__input${errors.phone ? ' field__input--error' : ''}`}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              required
            />
            {errors.phone && <span className="field__error">{errors.phone}</span>}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="language">
              Preferred language
            </label>
            <select
              id="language"
              className="field__select"
              value={form.language}
              onChange={(e) => updateField('language', e.target.value as LanguagePref)}
              required
            >
              {LANGUAGES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="form-section" aria-labelledby="delivery-heading">
          <h3 id="delivery-heading" className="form-section__title">
            Delivery address
          </h3>

          <div className="field">
            <label className="field__label" htmlFor="address">
              Street address
            </label>
            <input
              id="address"
              className={`field__input${errors.address ? ' field__input--error' : ''}`}
              type="text"
              autoComplete="street-address"
              value={form.address}
              onChange={(e) => updateField('address', e.target.value)}
              required
            />
            {errors.address && <span className="field__error">{errors.address}</span>}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="unit_buzz">
              Unit / buzzer
            </label>
            <input
              id="unit_buzz"
              className={`field__input${errors.unit_buzz ? ' field__input--error' : ''}`}
              type="text"
              placeholder="e.g. Unit 4B, buzz 1234, or none"
              value={form.unit_buzz}
              onChange={(e) => updateField('unit_buzz', e.target.value)}
              required
            />
            {errors.unit_buzz && <span className="field__error">{errors.unit_buzz}</span>}
          </div>
        </section>

        <section className="form-section" aria-labelledby="meals-heading">
          <h3 id="meals-heading" className="form-section__title">
            Meals
          </h3>

          <div className="field-row field-row--2">
            <div className="field">
              <label className="field__label" htmlFor="household_size">
                Household size
              </label>
              <input
                id="household_size"
                className={`field__input${errors.household_size ? ' field__input--error' : ''}`}
                type="number"
                min={1}
                max={20}
                value={form.household_size}
                onChange={(e) => updateField('household_size', Number(e.target.value))}
                required
              />
              {errors.household_size && (
                <span className="field__error">{errors.household_size}</span>
              )}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="meals">
                Meals needed
              </label>
              <span className="field__hint">Defaults to household size</span>
              <input
                id="meals"
                className={`field__input${errors.meals ? ' field__input--error' : ''}`}
                type="number"
                min={1}
                max={20}
                value={form.meals}
                onChange={(e) => {
                  setMealsTouched(true)
                  updateField('meals', Number(e.target.value))
                }}
                required
              />
              {errors.meals && <span className="field__error">{errors.meals}</span>}
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="delivery_window">
              Preferred delivery window
            </label>
            <select
              id="delivery_window"
              className="field__select"
              value={form.delivery_window}
              onChange={(e) => updateField('delivery_window', e.target.value as DeliveryWindow)}
              required
            >
              {DELIVERY_WINDOWS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="form-section" aria-labelledby="optional-heading">
          <h3 id="optional-heading" className="form-section__title">
            Optional <span className="optional-tag">— helps us serve you better</span>
          </h3>

          <div className="field-row field-row--2">
            <div className="field">
              <label className="field__label" htmlFor="frequency">
                How often?
              </label>
              <select
                id="frequency"
                className="field__select"
                value={form.frequency}
                onChange={(e) =>
                  updateField('frequency', e.target.value as DeliveryFrequency | '')
                }
              >
                <option value="">Not sure yet</option>
                {FREQUENCIES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="contact_pref">
                Contact preference
              </label>
              <select
                id="contact_pref"
                className="field__select"
                value={form.contact_pref}
                onChange={(e) =>
                  updateField('contact_pref', e.target.value as ContactPref | '')
                }
              >
                <option value="">No preference</option>
                {CONTACT_PREFS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              className="field__textarea"
              rows={3}
              placeholder="Dietary needs, gate codes, or anything else we should know"
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
            />
          </div>
        </section>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </form>
    </div>
  )
}
