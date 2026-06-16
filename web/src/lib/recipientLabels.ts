import type {
  ContactPref,
  DeliveryFrequency,
  DeliveryWindow,
  LanguagePref,
  RecipientRow,
  RecipientStatus,
} from '../types/database'

export const DELIVERY_WINDOW_LABELS: Record<DeliveryWindow, string> = {
  morning: 'Morning (8am – 11am)',
  afternoon: 'Afternoon (11am – 3pm)',
  evening: 'Evening (3pm – 7pm)',
  flexible: 'Flexible — any window works',
}

export const LANGUAGE_LABELS: Record<LanguagePref, string> = {
  english: 'English',
  punjabi: 'Punjabi',
  hindi: 'Hindi',
  urdu: 'Urdu',
  other: 'Other',
}

export const FREQUENCY_LABELS: Record<DeliveryFrequency, string> = {
  one_time: 'One time',
  weekly: 'Weekly',
  biweekly: 'Every two weeks',
  monthly: 'Monthly',
}

export const CONTACT_PREF_LABELS: Record<ContactPref, string> = {
  phone: 'Phone call',
  text: 'Text message',
  either: 'Either is fine',
}

export const RECIPIENT_STATUS_LABELS: Record<RecipientStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  active: 'Active',
  paused: 'Paused',
  rejected: 'Rejected',
}

export const DELIVERY_WINDOW_OPTIONS: { value: DeliveryWindow; label: string }[] = [
  { value: 'morning', label: DELIVERY_WINDOW_LABELS.morning },
  { value: 'afternoon', label: DELIVERY_WINDOW_LABELS.afternoon },
  { value: 'evening', label: DELIVERY_WINDOW_LABELS.evening },
  { value: 'flexible', label: DELIVERY_WINDOW_LABELS.flexible },
]

export const LANGUAGE_OPTIONS: { value: LanguagePref; label: string }[] = [
  { value: 'english', label: LANGUAGE_LABELS.english },
  { value: 'punjabi', label: LANGUAGE_LABELS.punjabi },
  { value: 'hindi', label: LANGUAGE_LABELS.hindi },
  { value: 'urdu', label: LANGUAGE_LABELS.urdu },
  { value: 'other', label: LANGUAGE_LABELS.other },
]

export const FREQUENCY_OPTIONS: { value: DeliveryFrequency; label: string }[] = [
  { value: 'one_time', label: FREQUENCY_LABELS.one_time },
  { value: 'weekly', label: FREQUENCY_LABELS.weekly },
  { value: 'biweekly', label: FREQUENCY_LABELS.biweekly },
  { value: 'monthly', label: FREQUENCY_LABELS.monthly },
]

export const CONTACT_PREF_OPTIONS: { value: ContactPref; label: string }[] = [
  { value: 'phone', label: CONTACT_PREF_LABELS.phone },
  { value: 'text', label: CONTACT_PREF_LABELS.text },
  { value: 'either', label: CONTACT_PREF_LABELS.either },
]

export function formatRecipientAddress(recipient: Pick<RecipientRow, 'address' | 'unit_buzz'>): string {
  if (recipient.unit_buzz) {
    return `${recipient.address}, ${recipient.unit_buzz}`
  }
  return recipient.address
}

export function formatSubmittedDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
