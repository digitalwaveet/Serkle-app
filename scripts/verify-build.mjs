// Windows verification fallback: load the existing JS-compatible Vite config
// directly, avoiding esbuild's blocked ancestor-directory config discovery.
// Uses the same production plugins/options without modifying the config.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
  .replace(/\b__dirname\b/g, JSON.stringify(root))
  .replace(/from\s+(['"])([^'"]+)\1/g, (_, quote, specifier) => `from ${JSON.stringify(import.meta.resolve(specifier))}`);
const { default: config } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
await build({ ...config({ command: 'build', mode: 'production' }), root, configFile: false, logLevel: 'error' });
