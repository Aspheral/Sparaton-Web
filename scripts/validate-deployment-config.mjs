#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args=new Map(process.argv.slice(2).map((arg,index,array)=>arg.startsWith('--')?[arg,array[index+1]&&!array[index+1].startsWith('--')?array[index+1]:'true']:null).filter(Boolean));
const environment=args.get('--environment');
if(environment!=='staging'&&environment!=='production'){console.error('Usage: node scripts/validate-deployment-config.mjs --environment staging|production [--config path] [--require-secrets]');process.exit(2)}
const configPath=resolve(args.get('--config')||`workers/api/wrangler${environment==='staging'?'.staging':''}.jsonc`);
let config;
try{config=parseJsonc(readFileSync(configPath,'utf8'))}catch(error){console.error(`Could not parse ${configPath}: ${error.message}`);process.exit(1)}
const errors=[];const warnings=[];
const db=config.d1_databases?.find(item=>item.binding==='DB');
if(!db)errors.push('Missing D1 binding DB.');else{required(db.database_name,'D1 database_name');required(db.database_id,'D1 database_id');if(environment==='production'&&/staging|preview|test/i.test(db.database_name||''))errors.push('Production config points at a non-production-looking D1 name.');if(environment==='staging'&&/production/i.test(db.database_name||''))errors.push('Staging config points at a production-looking D1 name.');}
const durable=config.durable_objects?.bindings?.find(item=>item.name==='TICKET_ROOMS'&&item.class_name==='TicketRoom');if(!durable)errors.push('Missing TICKET_ROOMS Durable Object binding.');
for(const binding of ['ATTACHMENTS','CMS_MEDIA'])if(!config.r2_buckets?.some(item=>item.binding===binding))errors.push(`Missing R2 binding ${binding}.`);
for(const key of ['STUDIOS_ORIGIN','ADMIN_ORIGIN','DEPLOYMENT_ENV'])required(config.vars?.[key],`vars.${key}`);
if(config.vars?.DEPLOYMENT_ENV!==environment)errors.push(`vars.DEPLOYMENT_ENV must be ${environment}.`);
if(environment==='staging'&&config.vars?.EMAIL_DELIVERY_MODE!=='disabled')warnings.push('Staging email delivery is not disabled; verify this is intentional before deployment.');
if(environment==='production'&&config.vars?.EMAIL_DELIVERY_MODE!=='enabled')warnings.push('Production email delivery is not enabled; ticket persistence still works but email fallback will remain disabled.');
const serialized=JSON.stringify(config);if(/REPLACE_WITH_|CHANGE_ME|example\.com/i.test(serialized))errors.push('Configuration still contains owner-action placeholder values.');
if(args.has('--require-secrets'))for(const key of ['TICKET_TOKEN_PEPPER','SESSION_SIGNING_SECRET','CLOUDFLARE_ACCESS_TEAM_DOMAIN','CLOUDFLARE_ACCESS_AUD','ADMIN_OWNER_EMAILS'])if(!process.env[key])errors.push(`Required deployment secret/environment value ${key} is not present in this shell.`);
for(const optional of ['RESEND_API_KEY','CLOUDFLARE_API_TOKEN','CLOUDFLARE_ZONE_ID','GITHUB_TOKEN'])if(args.has('--require-secrets')&&!process.env[optional])warnings.push(`${optional} is not present; its integration will stay explicitly unconfigured/degraded.`);
for(const warning of warnings)console.warn(`WARN: ${warning}`);if(errors.length){for(const error of errors)console.error(`ERROR: ${error}`);process.exit(1)}
console.log(`Configuration validation passed for ${environment}: ${configPath}`);

function required(value,label){if(typeof value!=='string'||!value.trim())errors.push(`Missing ${label}.`)}
function parseJsonc(text){return JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'').replace(/,\s*([}\]])/g,'$1'))}
