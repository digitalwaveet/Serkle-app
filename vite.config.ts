import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync } from 'node:fs';
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

function publicSupabaseConfig(mode: string) {
  const env = loadEnv(mode, process.cwd(), [
    'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY',
  ]);
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
  return {
    ...(url ? { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(url) } : {}),
    ...(key ? { 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(key) } : {}),
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: publicSupabaseConfig(mode),
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@jsquash/webp'] },
  server: {
    host: "::",
    port: 8082,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png', 'badge-72.png'],
      // One source of truth. Keep /manifest.json for existing links while the
      // plugin generates and links the equivalent /manifest.webmanifest.
      manifest: JSON.parse(readFileSync(path.resolve(__dirname, 'public/manifest.json'), 'utf8')),
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
      devOptions: {
        // Keep the PWA worker out of Vite dev sessions so it cannot serve
        // stale cached chunks over the live module graph/HMR requests.
        enabled: false,
        type: 'module'
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs'],
        },
      },
    },
  },
}));
