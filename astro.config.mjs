import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

import icon from 'astro-icon';

// Static build → GitHub Pages, apex custom domain (dylanchen.me).
// Custom domain = served at the root, so no `base` path needed.
// https://astro.build/config
export default defineConfig({
  site: 'https://dylanchen.me',
  integrations: [react(), mdx(), icon()],
  // Dev-only: silence the dev toolbar (its chunk kept 504-ing as
  // "Outdated Optimize Dep" and cluttering the console). No effect on builds.
  devToolbar: { enabled: false },
  vite: {
    // Pre-bundle the three.js addon modules the design model-viewer imports
    // dynamically. Without this, `OrbitControls` (imported nowhere else) is
    // optimized ON DEMAND the first time a visitor opens the 3D modal — that
    // request can 504 as an "Outdated Optimize Dep", and because the viewer's
    // loader is fired with `void loadModel()`, the rejected dynamic import is
    // swallowed and the modal hangs forever on "Loading model…". Listing them
    // here bundles them up front so the import always resolves.
    optimizeDeps: {
      include: [
        'three',
        'three/examples/jsm/loaders/GLTFLoader.js',
        'three/examples/jsm/controls/OrbitControls.js',
        'three/examples/jsm/environments/RoomEnvironment.js',
      ],
    },
  },
});