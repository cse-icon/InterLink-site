import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://products.cse-icon.com',
  integrations: [sitemap()],
});
