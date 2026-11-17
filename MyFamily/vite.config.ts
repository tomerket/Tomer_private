import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The app version shown on Home ("v1.0") comes from package.json
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    // Port 3000 matches the Supabase Auth default "Site URL" (email confirmation links)
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
