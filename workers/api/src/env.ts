export interface Env {
  DB: D1Database;
  TICKET_ROOMS: DurableObjectNamespace;
  STUDIOS_ORIGIN: string;
  ADMIN_ORIGIN: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM_NOTIFICATIONS: string;
  EMAIL_FROM_TICKETS: string;
  TICKET_TOKEN_PEPPER: string;
  SESSION_SIGNING_SECRET: string;
  CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
  CLOUDFLARE_ACCESS_AUD?: string;
  ADMIN_OWNER_EMAILS?: string;
}
