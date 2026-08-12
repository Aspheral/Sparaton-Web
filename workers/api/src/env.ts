export interface Env {
  DB: D1Database;
  TICKET_ROOMS: DurableObjectNamespace;
  ATTACHMENTS?: R2Bucket;
  STUDIOS_ORIGIN: string;
  ADMIN_ORIGIN: string;
  EMAIL_FROM_NOTIFICATIONS: string;
  EMAIL_FROM_TICKETS: string;
  RESEND_API_KEY?: string;
  TICKET_TOKEN_PEPPER: string;
  SESSION_SIGNING_SECRET: string;
  CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
  CLOUDFLARE_ACCESS_AUD?: string;
  ADMIN_OWNER_EMAILS?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ZONE_ID?: string;
  GITHUB_TOKEN?: string;
}
