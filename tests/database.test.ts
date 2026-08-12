import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ACTIVE_TICKET_STATUSES, normalizeEmail } from '../packages/database/src/index';

describe('ticket policy helpers',()=>{
  it('normalizes requester email consistently',()=>expect(normalizeEmail('  Example@Sparaton.COM ')).toBe('example@sparaton.com'));
  it('treats waiting states as active',()=>{
    expect(ACTIVE_TICKET_STATUSES).toContain('awaiting_staff');
    expect(ACTIVE_TICKET_STATUSES).toContain('awaiting_client');
    expect(ACTIVE_TICKET_STATUSES).not.toContain('closed');
  });
});

describe('migrated settings contract',()=>{
  it('keeps the settings handler aligned with the second-pass key rename',()=>{
    const migration=readFileSync('packages/database/migrations/0004_second_pass.sql','utf8');
    const handler=readFileSync('workers/api/src/settings.ts','utf8');
    expect(migration).toContain('RENAME COLUMN setting_key TO key');
    expect(handler).toContain('SELECT key,value_json');
    expect(handler).toContain('INSERT INTO site_settings(key,value_json');
    expect(handler).not.toContain('site_settings(setting_key');
  });
});
