// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import node from '@astrojs/node';

const directusUrl =
	process.env.PUBLIC_DIRECTUS_URL ||
	process.env.DIRECTUS_URL ||
	'https://cornolere.asoloweb.it';
let directusProtocol = 'https';
let directusHostname = 'cornolere.asoloweb.it';

try {
	const parsed = new URL(directusUrl);
	directusProtocol = parsed.protocol.replace(':', '');
	directusHostname = parsed.hostname;
} catch {
	// Fall back to defaults if env is invalid.
}

const useNodeAdapter = process.env.ASTRO_ADAPTER === 'node';

// https://astro.build/config
export default defineConfig({
	output: 'server',
	adapter: useNodeAdapter
		? node({ mode: 'standalone' })
		: cloudflare(),
  image: {
    domains: [directusHostname],
    remotePatterns: [
      {
        protocol: directusProtocol,
        hostname: directusHostname,
        port: '',
        pathname: '/assets/**'
      }
    ]
  },
  vite: {
    ssr: {
      noExternal: ['astro/jsx-runtime']
    }
  }
});
