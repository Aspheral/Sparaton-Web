export const ACTIVE_TICKET_STATUSES = ['new','open','assigned','awaiting_staff','awaiting_client'] as const;
export const CLOSED_TICKET_STATUSES = ['resolved','closed','archived'] as const;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
