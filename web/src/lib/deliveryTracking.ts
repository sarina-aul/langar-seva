import type { DeliveryStopStatus } from '../types/database'

export const DELIVERY_STOP_STATUS_LABELS: Record<DeliveryStopStatus, string> = {
  pending: 'Pending',
  on_the_way: 'On the way',
  nearby: 'Nearby',
  delivered: 'Delivered',
  skipped: 'Skipped',
  unable_to_contact: 'Unable to contact',
  delayed: 'Delayed',
}

export const CLIENT_DELIVERY_STATUS_COPY: Record<DeliveryStopStatus, string> = {
  pending: 'Your delivery is being prepared.',
  on_the_way: 'Your meal is on the way.',
  nearby: 'Your sevadar is nearby.',
  delivered: 'Your meal has been delivered.',
  skipped: 'This delivery was skipped.',
  unable_to_contact: 'We could not complete this delivery.',
  delayed: 'Your delivery is delayed.',
}

export const DRIVER_STOP_STATUSES: DeliveryStopStatus[] = [
  'on_the_way',
  'nearby',
  'delivered',
  'unable_to_contact',
  'delayed',
  'skipped',
]

export function formatEtaWindow(etaStart: string | null, etaEnd: string | null): string {
  if (!etaStart && !etaEnd) return 'ETA will update after pickup'

  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })

  if (etaStart && etaEnd) {
    return `Expected between ${formatter.format(new Date(etaStart))} and ${formatter.format(new Date(etaEnd))}`
  }

  return `Expected around ${formatter.format(new Date(etaStart ?? etaEnd ?? ''))}`
}

export function estimateStopEta(baseTime: Date, stopOrder: number): { eta_start: string; eta_end: string } {
  const midpointMinutes = Math.max(1, stopOrder) * 18
  const etaStart = new Date(baseTime)
  etaStart.setMinutes(etaStart.getMinutes() + midpointMinutes - 10)

  const etaEnd = new Date(baseTime)
  etaEnd.setMinutes(etaEnd.getMinutes() + midpointMinutes + 10)

  return {
    eta_start: etaStart.toISOString(),
    eta_end: etaEnd.toISOString(),
  }
}
