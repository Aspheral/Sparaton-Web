# D1 Backup and Recovery

This runbook prepares Sparaton for controlled recovery without automatically touching a production database. Production credentials are never committed.

## Safety rules

- Take a remote export before every production migration or any operation that could delete or rewrite content.
- Keep staging and production exports separate and label them with the source environment and timestamp.
- Never restore directly over production as a first diagnostic step. Reproduce the problem against staging or a local copy first.
- Application rollback and database rollback are different operations. Do not assume an older application build can safely run against a newer schema.
- Ticket message bodies are canonical records. Recovery work must preserve their ordering and internal-note separation.

## Export

Staging:

```sh
node scripts/backup-d1.mjs staging
```

Production:

```sh
node scripts/backup-d1.mjs production
```

The wrapper calls `wrangler d1 export ... --remote` and writes a timestamped SQL file. It is read-only against D1. Store production exports in an owner-approved secure backup location rather than committing them to Git.

## Pre-migration procedure

1. Confirm the target environment and Cloudflare account.
2. Run the deployment configuration validator.
3. Export D1 and verify the SQL file is non-empty.
4. Apply migrations to the isolated CI/test database first.
5. Apply the migration to staging and run smoke tests.
6. Review the migration for destructive statements and document any irreversible transformation.
7. Only then apply the migration to production as an explicit operator action.

The normal deploy script intentionally does **not** apply remote migrations.

## Restore

The restore wrapper is dry-by-default:

```sh
node scripts/restore-d1.mjs staging backups/example.sql --confirm-restore
```

Production requires both the command confirmation and a second shell-level guard:

```sh
SPARATON_RESTORE_CONFIRM=production node scripts/restore-d1.mjs production backups/example.sql --confirm-restore
```

Before a production restore, first export the current damaged state. That snapshot can be valuable for forensic comparison or selective recovery.

## Failure playbooks

### Migration fails before completion

Stop deployment. Capture the exact Wrangler/D1 error and current migration state. Do not repeatedly re-run a partially destructive migration. Reproduce from the pre-migration export in staging/local D1, repair the migration or create a forward-fix migration, and validate the complete sequence before production is touched again.

### Content is accidentally deleted

Export the current database immediately. Restore the last known-good export into staging/local D1, locate only the missing records and dependent join rows, and prefer a reviewed selective forward-repair over replacing the entire production database. Whole-database restore is the last resort.

### Ticket data is corrupted

Preserve the damaged database and ticket audit trail first. Reconstruct the ticket from the latest known-good export plus surviving canonical `ticket_messages`, assignments, status events, attachment metadata, and audit records. Never copy `ticket_internal_notes` into public message rows during recovery.

### Application code is rolled back after schema advanced

Do not automatically reverse migrations. Check whether the older application expects removed/renamed columns or different constraints. Prefer deploying a compatibility/forward-fix build. Database rollback is appropriate only when a tested reverse procedure exists and the pre-migration export has been verified.

## Disaster-recovery checklist

- Identify incident start time and affected environment.
- Freeze destructive Admin operations if continuing writes could worsen the incident.
- Export current D1 before making recovery changes.
- Preserve relevant R2 objects and application logs.
- Determine the last known-good application SHA and database backup.
- Rehearse recovery against staging/local resources.
- Verify ticket privacy boundaries, published/draft state, and relationship integrity.
- Run static, unit/integration, migration, build, and browser smoke checks.
- Perform the explicitly approved production repair.
- Record what changed, by whom, and which backup/recovery artifact was used.

Cloudflare account-level backup features may provide additional recovery options depending on the owner’s plan and configuration. This runbook does not claim those are enabled until verified in the real account.
