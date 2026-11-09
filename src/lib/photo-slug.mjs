// Shared by scripts/optimize-photos.mjs (Node, plain ESM) and src/lib/photos.ts
// (Astro build), so a photo's derivative filename is computed one way only.

/** Image files the Photography section picks up. */
export const PHOTO_EXT = /\.(jpe?g|png|webp)$/i;

/**
 * "Sample Horz (1).jpg" → "sample-horz-1"
 * @param {string} filename
 * @returns {string}
 */
export const photoSlug = (filename) =>
  filename
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
