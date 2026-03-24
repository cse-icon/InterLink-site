import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://interlink.products.cse-icon.com',
  vite: {
    plugins: [tailwindcss()],
  },
});
