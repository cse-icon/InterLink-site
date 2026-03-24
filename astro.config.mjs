import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://interlink.products.cse-icon.com',
  integrations: [tailwind()],
  output: 'static',
});
