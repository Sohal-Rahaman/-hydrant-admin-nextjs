/**
 * Order status alignment - matches iOS User App & HYDRANT_ALIGNMENT.md
 * Firebase stores: placed, pending, confirmed, in_progress, out_for_delivery, delivered, completed, canceled, cancelled
 * Admin UI uses: pending, processing, completed, cancelled
 */
export type AdminOrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled';

const STATUS_MAP: Record<string, AdminOrderStatus> = {
  pending: 'pending',
  processing: 'processing',
  completed: 'completed',
  cancelled: 'cancelled',
  delivered: 'completed',
  canceled: 'cancelled',
  placed: 'pending',
  confirmed: 'processing',
  in_progress: 'processing',
  out_for_delivery: 'processing',
  in_transit: 'processing',
};

export function normalizeOrderStatus(raw: string | undefined): AdminOrderStatus {
  const key = String(raw || '').toLowerCase().trim();
  return STATUS_MAP[key] ?? 'pending';
}

export function isOpenOrderStatus(status: string): boolean {
  const normalized = normalizeOrderStatus(status);
  return normalized === 'pending' || normalized === 'processing';
}
