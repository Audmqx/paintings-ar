// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Mettre l'URL de production avant de déployer : canonical, OG et sitemap en dépendent.
export default defineConfig({
  site: 'https://example.com',
  integrations: [sitemap()],
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  build: { inlineStylesheets: 'auto' },
});
