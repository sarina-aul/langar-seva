export type RecipientStatus =
  | 'pending'
  | 'approved'
  | 'active'
  | 'paused'
  | 'rejected'

export type RecipientFilterStatus = 'pending' | 'approved' | 'rejected' | 'all'

export type DeliveryWindow = 'morning' | 'afternoon' | 'evening' | 'flexible'

export type LanguagePref = 'english' | 'punjabi' | 'hindi' | 'urdu' | 'other'

export type DeliveryFrequency = 'one_time' | 'weekly' | 'biweekly' | 'monthly'

export type ContactPref = 'phone' | 'text' | 'either'

// ─── Kitchen batch ────────────────────────────────────────────────────────────

export type BatchStatus = 'prep' | 'cooking' | 'packing' | 'ready' | 'pickup' | 'dispatched'

export const BATCH_STAGES: BatchStatus[] = [
  'prep',
  'cooking',
  'packing',
  'ready',
  'pickup',
  'dispatched',
]

export const BATCH_STAGE_LABELS: Record<BatchStatus, string> = {
  prep: 'Prep',
  cooking: 'Cooking',
  packing: 'Packing',
  ready: 'Ready',
  pickup: 'Pickup',
  dispatched: 'Dispatched',
}

export interface BatchInsert {
  batch_date: string // 'YYYY-MM-DD'
  meal_count_planned: number
  meal_count_packed?: number
  notes?: string | null
  status?: BatchStatus
}

export interface BatchRow {
  id: string
  created_at: string
  updated_at: string
  batch_date: string
  status: BatchStatus
  meal_count_planned: number
  meal_count_packed: number
  notes: string | null
  created_by: string | null
  cooking_at: string | null
  packing_at: string | null
  ready_at: string | null
  pickup_at: string | null
  dispatched_at: string | null
}

// ─── Staff notifications ──────────────────────────────────────────────────────

export type NotificationKind = 'batch_ready'

export interface StaffNotificationRow {
  id: string
  created_at: string
  user_id: string
  batch_id: string
  kind: NotificationKind
  title: string
  body: string | null
  read_at: string | null
}

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
      batches: {
        Row: BatchRow
        Insert: BatchInsert
        Update: Partial<BatchInsert> & { status?: BatchStatus; meal_count_packed?: number }
        Relationships: []
      }
      staff_notifications: {
        Row: StaffNotificationRow
        Insert: never
        Update: { read_at?: string | null }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_coordinator:   { Args: Record<string, never>; Returns: boolean }
      is_kitchen_admin: { Args: Record<string, never>; Returns: boolean }
      is_staff:         { Args: Record<string, never>; Returns: boolean }
    }
    Enums: {
      recipient_status: RecipientStatus
      delivery_window: DeliveryWindow
      language_pref: LanguagePref
      delivery_frequency: DeliveryFrequency
      contact_pref: ContactPref
      batch_status: BatchStatus
    }
    CompositeTypes: Record<string, never>
  }
}
