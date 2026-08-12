#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [environment,file,confirm]=process.argv.slice(2);
if((environment!=='staging'&&environment!=='production')||!file){console.error('Usage: node scripts/restore-d1.mjs staging|production backup.sql [--confirm-restore]');process.exit(2)}
const backup=resolve(file);if(!existsSync(backup)){console.error(`Backup file not found: ${backup}`);process.exit(1)}
if(confirm!=='--confirm-restore'){console.error('Restore is intentionally dry-by-default. Re-run with --confirm-restore after reviewing the backup and recovery checklist.');process.exit(2)}
if(environment==='production'&&process.env.SPARATON_RESTORE_CONFIRM!=='production'){console.error('Production restore additionally requires SPARATON_RESTORE_CONFIRM=production in the current shell.');process.exit(2)}
const config=environment==='staging'?'workers/api/wrangler.staging.jsonc':'workers/api/wrangler.jsonc';const database=environment==='staging'?'sparaton-staging':'sparaton-production';
console.error(`RESTORE TARGET: ${environment} / ${database}`);console.error('This executes SQL against the selected remote D1 database. It does not alter DNS or deploy application code.');
const result=spawnSync(process.platform==='win32'?'npx.cmd':'npx',['wrangler','d1','execute',database,'--remote','--file',backup,'--config',config],{stdio:'inherit'});process.exit(result.status??1);
