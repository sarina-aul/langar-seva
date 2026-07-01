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

export type IntakeChannel = 'web' | 'ivr' | 'staff'

// ─── Kitchen batch ────────────────────────────────────────────────────────────

export type BatchStatus = 'prep' | 'cooking' | 'packing' | 'ready' | 'pickup' | 'dispatched'
export type DispatchRouteStatus = 'planned' | 'assigned' | 'picked_up' | 'completed' | 'cancelled'
export type DeliveryStopStatus =
  | 'pending'
  | 'on_the_way'
  | 'nearby'
  | 'delivered'
  | 'skipped'
  | 'unable_to_contact'
  | 'delayed'
export type DeliveryNotificationStatus = 'queued' | 'sent' | 'failed' | 'skipped' | 'logged'
export type BatchAuditEventType =
  | 'stage_changed'
  | 'packed_count_changed'
  | 'short_count_reason_set'
  | 'batch_plan_changed'
  | 'route_created'
  | 'route_status_changed'

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
  ready: 'Ready for pickup',
  pickup: 'Pickup in progress',
  dispatched: 'Dispatched',
}

export const BATCH_STAGE_DESCRIPTIONS: Record<BatchStatus, string> = {
  prep: 'Gathering ingredients and station setup',
  cooking: 'Meals being prepared in the langar hall',
  packing: 'Portioning and labeling meal containers',
  ready: 'Meals plated and waiting for sevadars',
  pickup: 'Pickup window is open and sevadars are collecting route bundles',
  dispatched: 'All meals are out for delivery',
}

export const BATCH_STAGE_NEXT_ACTION: Record<BatchStatus, string | null> = {
  prep: 'Start cooking',
  cooking: 'Start packing',
  packing: 'Mark ready for pickup',
  ready: 'Begin pickup window',
  pickup: 'Mark all dispatched',
  dispatched: null,
}

export interface BatchInsert {
  batch_date: string // 'YYYY-MM-DD'
  meal_count_planned: number
  meal_count_packed?: number
  menu?: string
  pickup_window_start?: string | null
  pickup_window_end?: string | null
  service_location_name?: string
  service_location_address?: string | null
  short_count_reason?: string | null
  ingredients_confirmed_at?: string | null
  stations_confirmed_at?: string | null
  prep_confirmed_by?: string | null
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
  menu: string
  pickup_window_start: string | null
  pickup_window_end: string | null
  service_location_name: string
  service_location_address: string | null
  short_count_reason: string | null
  ingredients_confirmed_at: string | null
  stations_confirmed_at: string | null
  prep_confirmed_by: string | null
  notes: string | null
  created_by: string | null
  cooking_at: string | null
  packing_at: string | null
  ready_at: string | null
  pickup_at: string | null
  pickup_opened_at: string | null
  dispatched_at: string | null
}

export interface SevadarInsert {
  name: string
  phone?: string | null
  home_postal_code?: string | null
  notes?: string | null
  active?: boolean
}

export interface SevadarRow extends SevadarInsert {
  id: string
  created_at: string
  updated_at: string
  name: string
  phone: string | null
  home_postal_code: string | null
  home_postal_prefix: string | null
  notes: string | null
  active: boolean
}

export interface DispatchRouteInsert {
  batch_id: string
  sevadar_id?: string | null
  route_name: string
  status?: DispatchRouteStatus
  notes?: string | null
}

export interface DispatchRouteRow extends DispatchRouteInsert {
  id: string
  created_at: string
  updated_at: string
  batch_id: string
  sevadar_id: string | null
  route_name: string
  status: DispatchRouteStatus
  pickup_at: string | null
  completed_at: string | null
  notes: string | null
}

export interface DispatchRouteRecipientInsert {
  route_id: string
  recipient_id: string
  stop_order?: number
  meals: number
  delivery_status?: DeliveryStopStatus
  eta_start?: string | null
  eta_end?: string | null
  driver_note_internal?: string | null
  client_visible_note?: string | null
}

export interface DispatchRouteRecipientRow extends DispatchRouteRecipientInsert {
  id: string
  created_at: string
  route_id: string
  recipient_id: string
  stop_order: number
  meals: number
  delivery_status: DeliveryStopStatus
  eta_start: string | null
  eta_end: string | null
  status_updated_at: string
  delivered_at: string | null
  skipped_at: string | null
  driver_note_internal: string | null
  client_visible_note: string | null
}

export interface DeliveryTrackingLinkRow {
  id: string
  created_at: string
  route_recipient_id: string
  token_hash: string
  expires_at: string
  revoked_at: string | null
  sent_at: string | null
  last_viewed_at: string | null
  created_by: string | null
}

export interface DriverRouteLinkRow {
  id: string
  created_at: string
  route_id: string
  token_hash: string
  expires_at: string
  revoked_at: string | null
  sent_at: string | null
  last_viewed_at: string | null
  created_by: string | null
}

export interface DeliveryNotificationInsert {
  route_recipient_id: string
  recipient_id: string
  channel?: 'sms'
  event_type:
    | 'tracking_link_created'
    | 'tracking_link_sent'
    | 'driver_route_link_sent'
    | 'delivery_status_update'
    | 'delivery_exception'
  status?: DeliveryNotificationStatus
  provider_message_id?: string | null
  error?: string | null
  sent_at?: string | null
}

export interface DeliveryNotificationRow extends DeliveryNotificationInsert {
  id: string
  created_at: string
  channel: 'sms'
  status: DeliveryNotificationStatus
  provider_message_id: string | null
  error: string | null
  sent_at: string | null
}

export interface DeliveryTrackingStatus {
  delivery_status: DeliveryStopStatus
  status_label: string
  eta_start: string | null
  eta_end: string | null
  last_updated_at: string
  route_progress_label: string | null
  client_visible_note: string | null
  delivered_at: string | null
}

export interface BatchAuditEventRow {
  id: string
  created_at: string
  batch_id: string
  actor_user_id: string | null
  event_type: BatchAuditEventType
  from_value: string | null
  to_value: string | null
  note: string | null
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
  postal_code?: string | null
  household_size: number
  meals: number
  delivery_window: DeliveryWindow
  language: LanguagePref
  frequency?: DeliveryFrequency | null
  contact_pref?: ContactPref | null
  notes?: string | null
  status?: RecipientStatus
  intake_channel?: IntakeChannel
}

export interface RecipientRow extends RecipientInsert {
  id: string
  created_at: string
  updated_at: string
  status: RecipientStatus
  intake_channel: IntakeChannel
  sms_confirmation_status: string | null
  postal_code: string | null
  postal_prefix: string | null
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
      sevadars: {
        Row: SevadarRow
        Insert: SevadarInsert
        Update: Partial<SevadarInsert>
        Relationships: []
      }
      dispatch_routes: {
        Row: DispatchRouteRow
        Insert: DispatchRouteInsert
        Update: Partial<DispatchRouteInsert> & { status?: DispatchRouteStatus }
        Relationships: []
      }
      dispatch_route_recipients: {
        Row: DispatchRouteRecipientRow
        Insert: DispatchRouteRecipientInsert
        Update: Partial<DispatchRouteRecipientInsert>
        Relationships: []
      }
      delivery_tracking_links: {
        Row: DeliveryTrackingLinkRow
        Insert: never
        Update: { revoked_at?: string | null; sent_at?: string | null; last_viewed_at?: string | null }
        Relationships: []
      }
      delivery_notifications: {
        Row: DeliveryNotificationRow
        Insert: DeliveryNotificationInsert
        Update: Partial<DeliveryNotificationInsert>
        Relationships: []
      }
      batch_audit_events: {
        Row: BatchAuditEventRow
        Insert: never
        Update: never
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
      is_coordinator: { Args: Record<string, never>; Returns: boolean }
      is_kitchen_admin: { Args: Record<string, never>; Returns: boolean }
      is_staff: { Args: Record<string, never>; Returns: boolean }
      create_delivery_tracking_link: {
        Args: { p_route_recipient_id: string }
        Returns: { tracking_token: string; expires_at: string }[]
      }
      get_delivery_tracking_status: {
        Args: { p_tracking_token: string }
        Returns: DeliveryTrackingStatus[]
      }
      mark_delivery_tracking_link_sent: {
        Args: { p_route_recipient_id: string; p_provider_message_id?: string | null }
        Returns: undefined
      }
    }
    Enums: {
      recipient_status: RecipientStatus
      delivery_window: DeliveryWindow
      language_pref: LanguagePref
      delivery_frequency: DeliveryFrequency
      contact_pref: ContactPref
      batch_status: BatchStatus
      dispatch_route_status: DispatchRouteStatus
      delivery_stop_status: DeliveryStopStatus
      delivery_notification_status: DeliveryNotificationStatus
    }
    CompositeTypes: Record<string, never>
  }
}
