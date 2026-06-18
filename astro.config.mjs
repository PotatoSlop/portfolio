import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

// Static build → GitHub Pages, apex custom domain (dylanchen.me).
// Custom domain = served at the root, so no `base` path needed.
// https://astro.build/config
export default defineConfig({
  site: 'https://dylanchen.me',
  integrations: [react(), mdx()],
  // Dev-only: silence the dev toolbar (its chunk kept 504-ing as
  // "Outdated Optimize Dep" and cluttering the console). No effect on builds.
  devToolbar: { enabled: false },
});
