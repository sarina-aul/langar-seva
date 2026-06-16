export type RecipientStatus =
  | 'pending'
  | 'approved'
  | 'active'
  | 'paused'
  | 'rejected'

export type DeliveryWindow = 'morning' | 'afternoon' | 'evening' | 'flexible'

export type LanguagePref = 'english' | 'punjabi' | 'hindi' | 'urdu' | 'other'

export type DeliveryFrequency = 'one_time' | 'weekly' | 'biweekly' | 'monthly'

export type ContactPref = 'phone' | 'text' | 'either'

export interface RecipientInsert {
  name: string
  phone: string
  address: string
  unit_buzz: string
  household_size: number
  meals: number
  delivery_window: DeliveryWindow
  language: LanguagePref
  frequency?: DeliveryFrequency | null
  contact_pref?: ContactPref | null
  notes?: string | null
  status?: RecipientStatus
}

export interface RecipientRow extends RecipientInsert {
  id: string
  created_at: string
  updated_at: string
  status: RecipientStatus
  geocode_lat: number | null
  geocode_lng: number | null
  geocode_place_id: string | null
  geocoded_at: string | null
}

export interface Database {
  public: {
    Tables: {
      recipients: {
        Row: RecipientRow
        Insert: RecipientInsert
        Update: Partial<RecipientInsert>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_coordinator: { Args: Record<string, never>; Returns: boolean }
    }
    Enums: {
      recipient_status: RecipientStatus
      delivery_window: DeliveryWindow
      language_pref: LanguagePref
      delivery_frequency: DeliveryFrequency
      contact_pref: ContactPref
    }
    CompositeTypes: Record<string, never>
  }
}
