#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const environment=process.argv[2];
if(environment!=='staging'&&environment!=='production'){console.error('Usage: node scripts/deploy.mjs staging|production [--confirm-production] [--smoke-url URL]');process.exit(2)}
const production=environment==='production';
if(production&&!process.argv.includes('--confirm-production')){console.error('Production deploy is intentionally explicit. Re-run with --confirm-production after backup/migration review.');process.exit(2)}
const smokeIndex=process.argv.indexOf('--smoke-url'),smokeUrl=smokeIndex>=0?process.argv[smokeIndex+1]:null;
run('node',['scripts/validate-deployment-config.mjs','--environment',environment,'--require-secrets']);
run(process.platform==='win32'?'npm.cmd':'npm',['ci']);
run(process.platform==='win32'?'npm.cmd':'npm',['run','check']);
run(process.platform==='win32'?'npm.cmd':'npm',['test']);
run(process.platform==='win32'?'npm.cmd':'npm',['run','build']);
console.log('Database migrations are NOT run automatically by this deploy script. Apply them as an explicit controlled step after a pre-migration backup.');
const config=environment==='staging'?'workers/api/wrangler.staging.jsonc':'workers/api/wrangler.jsonc';
run(process.platform==='win32'?'npx.cmd':'npx',['wrangler','deploy','--config',config]);
if(smokeUrl){if(!/^https:\/\//i.test(smokeUrl))fail('Smoke URL must use HTTPS.');const response=await fetch(smokeUrl,{redirect:'manual'});if(response.status<200||response.status>=400)fail(`Smoke check failed with HTTP ${response.status}: ${smokeUrl}`);console.log(`Smoke check passed: ${smokeUrl} (${response.status})`)}
function run(command,args){console.log(`> ${command} ${args.join(' ')}`);const result=spawnSync(command,args,{stdio:'inherit',env:process.env});if(result.status!==0)process.exit(result.status??1)}
function fail(message){console.error(message);process.exit(1)}
