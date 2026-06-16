import type { User } from '@supabase/supabase-js'
import { STAFF_ROLES, type StaffRole } from '../types/auth'

export function getStaffRole(user: User | null | undefined): StaffRole | null {
  if (!user) return null

  const role = user.app_metadata?.role
  if (typeof role === 'string' && STAFF_ROLES.includes(role as StaffRole)) {
    return role as StaffRole
  }

  return null
}

export function isCoordinator(user: User | null | undefined): boolean {
  return getStaffRole(user) === 'coordinator'
}

export function isKitchenAdmin(user: User | null | undefined): boolean {
  return getStaffRole(user) === 'kitchen_admin'
}

export function isStaff(user: User | null | undefined): boolean {
  return getStaffRole(user) !== null
}

export function getStaffHomePath(role: StaffRole): string {
  switch (role) {
    case 'coordinator':
    case 'kitchen_admin':
      return '/staff'
  }
}
