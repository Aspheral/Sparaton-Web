import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
export default defineConfig({ site:'https://ilmp.sparaton.com', output:'server', adapter:cloudflare(), trailingSlash:'never' });
