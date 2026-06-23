import { useState } from 'react'
import {
  CONTACT_PREF_OPTIONS,
  DELIVERY_WINDOW_OPTIONS,
  FREQUENCY_OPTIONS,
  LANGUAGE_OPTIONS,
} from '../lib/recipientLabels'
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
  consent?: string
}

function validate(data: IntakeFormData, consent: boolean): FieldErrors {
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
  if (!consent) {
    errors.consent = 'Please provide consent to proceed.'
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
  onBack: () => void
}

export function IntakeForm({ onSuccess, onBack }: IntakeFormProps) {
  const [form, setForm] = useState<IntakeFormData>(initialForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [consent, setConsent] = useState(false)
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

    const fieldErrors = validate(form, consent)
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
    <div className="intake-form-page">
      <header className="intake-form-page__header">
        <button type="button" className="intake-form-page__back" onClick={onBack}>
          <span className="intake-form-page__back-icon" aria-hidden="true">
            ←
          </span>
          <span>Back</span>
        </button>
        <div>
          <h1 className="intake-form-page__title">Intake Form</h1>
          <p className="intake-form-page__subtitle">Request Langar Delivery</p>
        </div>
      </header>

      {submitError && (
        <div className="intake-form-page__banner" role="alert">
          {submitError}
        </div>
      )}

      <form className="intake-form" onSubmit={handleSubmit} noValidate>
        <section className="intake-section" aria-labelledby="household-heading">
          <h2 id="household-heading" className="intake-section__title">
            1. Your Household
          </h2>

          <div className="intake-field">
            <label className="intake-field__label" htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              className={`intake-field__input${errors.name ? ' intake-field__input--error' : ''}`}
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
            />
            {errors.name && <span className="intake-field__error">{errors.name}</span>}
          </div>

          <div className="intake-field">
            <label className="intake-field__label" htmlFor="phone">
              Phone number
            </label>
            <input
              id="phone"
              className={`intake-field__input${errors.phone ? ' intake-field__input--error' : ''}`}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              required
            />
            {errors.phone && <span className="intake-field__error">{errors.phone}</span>}
          </div>

          <div className="intake-field-row">
            <div className="intake-field">
              <label className="intake-field__label" htmlFor="household_size">
                Household size
              </label>
              <select
                id="household_size"
                className={`intake-field__input intake-field__select${errors.household_size ? ' intake-field__input--error' : ''}`}
                value={form.household_size}
                onChange={(e) => updateField('household_size', Number(e.target.value))}
                required
              >
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              {errors.household_size && (
                <span className="intake-field__error">{errors.household_size}</span>
              )}
            </div>

            <div className="intake-field">
              <label className="intake-field__label" htmlFor="language">
                Preferred language
              </label>
              <select
                id="language"
                className="intake-field__input intake-field__select"
                value={form.language}
                onChange={(e) => updateField('language', e.target.value as LanguagePref)}
                required
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="intake-section" aria-labelledby="delivery-heading">
          <h2 id="delivery-heading" className="intake-section__title">
            2. Delivery Details
          </h2>

          <div className="intake-field">
            <label className="intake-field__label" htmlFor="address">
              Home address — delivery destination
            </label>
            <input
              id="address"
              className={`intake-field__input${errors.address ? ' intake-field__input--error' : ''}`}
              type="text"
              autoComplete="street-address"
              placeholder="Where should the sevadar deliver?"
              value={form.address}
              onChange={(e) => updateField('address', e.target.value)}
              required
            />
            {errors.address && <span className="intake-field__error">{errors.address}</span>}
          </div>

          <div className="intake-field">
            <label className="intake-field__label" htmlFor="unit_buzz">
              Apt / buzz code
            </label>
            <input
              id="unit_buzz"
              className={`intake-field__input${errors.unit_buzz ? ' intake-field__input--error' : ''}`}
              type="text"
              placeholder="Helps the sevadar find you"
              value={form.unit_buzz}
              onChange={(e) => updateField('unit_buzz', e.target.value)}
              required
            />
            {errors.unit_buzz && <span className="intake-field__error">{errors.unit_buzz}</span>}
          </div>

          <fieldset className="intake-fieldset">
            <legend className="intake-field__label">Preferred window</legend>
            <div className="intake-radio-list">
              {DELIVERY_WINDOW_OPTIONS.map((opt) => (
                <label key={opt.value} className="intake-radio">
                  <input
                    type="radio"
                    name="delivery_window"
                    value={opt.value}
                    checked={form.delivery_window === opt.value}
                    onChange={() => updateField('delivery_window', opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="intake-fieldset">
            <legend className="intake-field__label">Contact preference</legend>
            <div className="intake-radio-row">
              <label className="intake-radio">
                <input
                  type="radio"
                  name="contact_pref"
                  value=""
                  checked={form.contact_pref === ''}
                  onChange={() => updateField('contact_pref', '')}
                />
                <span>No preference</span>
              </label>
              {CONTACT_PREF_OPTIONS.map((opt) => (
                <label key={opt.value} className="intake-radio">
                  <input
                    type="radio"
                    name="contact_pref"
                    value={opt.value}
                    checked={form.contact_pref === opt.value}
                    onChange={() => updateField('contact_pref', opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="intake-section" aria-labelledby="meals-heading">
          <h2 id="meals-heading" className="intake-section__title">
            3. Meals &amp; Dietary Needs
          </h2>

          <div className="intake-field">
            <label className="intake-field__label" htmlFor="meals">
              Meals needed
            </label>
            <select
              id="meals"
              className={`intake-field__input intake-field__select${errors.meals ? ' intake-field__input--error' : ''}`}
              value={form.meals}
              onChange={(e) => {
                setMealsTouched(true)
                updateField('meals', Number(e.target.value))
              }}
              required
            >
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} meal{n === 1 ? '' : 's'}
                </option>
              ))}
            </select>
            {errors.meals && <span className="intake-field__error">{errors.meals}</span>}
          </div>

          <div className="intake-field">
            <label className="intake-field__label" htmlFor="notes">
              Allergies / restrictions
            </label>
            <textarea
              id="notes"
              className="intake-field__input intake-field__textarea"
              rows={2}
              placeholder="Dietary needs, gate codes, or anything else we should know"
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
            />
          </div>
        </section>

        <section className="intake-section" aria-labelledby="frequency-heading">
          <h2 id="frequency-heading" className="intake-section__title">
            4. Frequency
          </h2>

          <fieldset className="intake-fieldset">
            <legend className="sr-only">How often</legend>
            <div className="intake-radio-list">
              <label className="intake-radio">
                <input
                  type="radio"
                  name="frequency"
                  value=""
                  checked={form.frequency === ''}
                  onChange={() => updateField('frequency', '')}
                />
                <span>Not sure yet</span>
              </label>
              {FREQUENCY_OPTIONS.map((opt) => (
                <label key={opt.value} className="intake-radio">
                  <input
                    type="radio"
                    name="frequency"
                    value={opt.value}
                    checked={form.frequency === opt.value}
                    onChange={() => updateField('frequency', opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="intake-section intake-section--consent">
          <label className="intake-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked)
                setErrors((prev) => ({ ...prev, consent: undefined }))
              }}
              required
            />
            <span>
              I consent to receive delivery updates by text. I understand my information is shared
              only with the Gurdwara coordinator and assigned sevadar for the purpose of this
              delivery.
            </span>
          </label>
          {errors.consent && <span className="intake-field__error">{errors.consent}</span>}
        </section>

        <div className="intake-form__actions">
          <button type="submit" className="intake-form__submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit request for review'}
          </button>
          <p className="intake-form__footnote">
            A coordinator will review your request. You'll receive a text confirmation within 24
            hours.
          </p>
        </div>
      </form>
    </div>
  )
}
