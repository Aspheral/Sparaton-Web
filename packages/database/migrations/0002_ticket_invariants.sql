PRAGMA foreign_keys = ON;

-- Enforce the one-active-ticket policy at the database layer as well as in application logic.
-- This closes the race where two ticket-creation requests for the same normalized email arrive concurrently.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_ticket_requester
ON tickets(requester_email_normalized)
WHERE status IN ('new','open','assigned','awaiting_staff','awaiting_client');

-- Keep the common active-assignment lookup narrow for realtime/email fallback.
CREATE INDEX IF NOT EXISTS idx_ticket_assignments_staff_active
ON ticket_assignments(staff_email, active, ticket_id);
