#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const env=process.argv[2];
if(env!=='staging'&&env!=='production'){console.error('Usage: node scripts/backup-d1.mjs staging|production [output-directory]');process.exit(2)}
const config=env==='staging'?'workers/api/wrangler.staging.jsonc':'workers/api/wrangler.jsonc';
const database=env==='staging'?'sparaton-staging':'sparaton-production';
const directory=resolve(process.argv[3]||'backups');mkdirSync(directory,{recursive:true});
const timestamp=new Date().toISOString().replace(/[:.]/g,'-');const output=resolve(directory,`${database}-${timestamp}.sql`);
console.log(`Creating read-only D1 export from ${env} into ${output}`);
const result=spawnSync(process.platform==='win32'?'npx.cmd':'npx',['wrangler','d1','export',database,'--remote','--output',output,'--config',config],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status??1);console.log(`Backup complete: ${output}`);
