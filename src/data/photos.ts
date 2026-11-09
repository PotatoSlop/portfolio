/*
  Photo metadata for the /design Photography section, keyed by the ORIGINAL
  filename in public/Assets/Photography. src/lib/photos.ts merges it into each
  scanned photo. A photo with no entry still shows; it just has no title or
  location (and generic alt text).

  Migrated from the legacy root gallery.js. Orientation isn't stored here any
  more: it's read from the file itself at build time.
*/
export interface PhotoMeta {
  title: string;
  location: string;
}

export const PHOTO_META: Record<string, PhotoMeta> = {
  'Sample Horz (1).jpg': { title: 'Lanterns', location: 'Jiufen, Taiwan' },
  'Sample Horz (2).jpg': { title: 'Sounds under the Shade', location: 'Seattle, Washington' },
  'Sample Horz (3).jpg': { title: 'Fairy Foliage', location: 'Queens, New York' },
  'Sample Horz (4).jpg': { title: "Waiting for Adel's", location: 'Manhattan, New York' },
  'Sample Horz (5).jpg': { title: 'Temple in the fog', location: 'Jiufen, Taiwan' },
  'Sample Horz (6).jpg': { title: 'Golden Egg', location: 'Taipei, Taiwan' },
  'Sample Horz (7).jpg': { title: 'Zipline Temple', location: 'Jiufen, Taiwan' },
  'Sample Horz (8).jpg': { title: 'Siesta', location: 'Jiufen, Taiwan' },
  'Sample Horz (9).jpg': { title: 'Seeking V formation', location: 'Boston, Massachusetts' },
  'Sample Vert (1).jpg': { title: 'Heat Lamp', location: 'Manhattan, New York' },
  'Sample Vert (2).jpg': { title: 'Golden Corner', location: 'Boston, Massachusetts' },
  'Sample Vert (3).jpg': { title: 'Hidden Message', location: 'Queens, New York' },
  'Sample Vert (4).jpg': { title: 'Corner Cart', location: 'Queens, New York' },
  'Sample Vert (5).jpg': { title: 'Queue', location: 'Queens, New York' },
  'Sample Vert (6).jpg': { title: 'Oyakodon', location: 'Shibuya, Tokyo' },
  'Sample Vert (7).jpg': { title: 'Wispy Skies', location: 'Queens, New York' },
  'Sample Vert (8).jpg': { title: 'Tower', location: 'Boston, Massachusetts' },
  'Sample Vert (9).jpg': { title: 'Peek', location: 'Queens, New York' },
  'Sample Vert (10).jpg': { title: 'Emperial', location: 'Asakusa, Tokyo' },
  'Sample Vert (11).jpg': { title: 'Capacity', location: 'Marina Square, Singapore' },
  'Sample Vert (12).jpg': { title: 'Shoulder Surfing', location: 'Seattle, Washington' },
  'Sample Vert (13).jpg': { title: 'Still Steel', location: 'Brooklyn, New York' },
};
