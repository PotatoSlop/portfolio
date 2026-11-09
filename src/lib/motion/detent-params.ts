/*
  detent-params.ts — the knob's detent-click sound settings, shared by the page
  (engineering-page.ts + the in-page "sound config" dialog) and the lab tuner.
  Plain data only (no DOM), so Astro frontmatter can import it to render sliders.

  The sound itself: CLICK = white noise → band-pass → fast envelope; THUMP = a
  sine sweep (start → end Hz) → envelope; both summed into a master gain.
*/

export const DETENT_DEFAULTS = {
  clickFreq: 5000, // Hz   band-pass centre: brightness of the tick
  clickQ: 6, //            band-pass Q: low = noisy, high = pitched / ringing
  clickGain: 0.3, //       peak level of the tick
  clickAttack: 2.4, // ms  rise time
  clickDecay: 8, // ms     time to fall silent
  thumpStart: 190, // Hz   body sine start pitch
  thumpEnd: 220, // Hz     pitch it sweeps to (above start = slight rise)
  thumpGain: 0.12, //      peak level of the body (0 = tick only)
  thumpDecay: 80, // ms    body length
  master: 0.75, //         overall volume
};
export type DetentParams = typeof DETENT_DEFAULTS;
export type DetentKey = keyof DetentParams;

/** Slider groups (ranges/steps/units) for any tuning UI. */
export const DETENT_SLIDERS: Array<{
  group: string;
  rows: Array<{ key: DetentKey; label: string; unit: string; min: number; max: number; step: number }>;
}> = [
  {
    group: 'Click · noise → band-pass',
    rows: [
      { key: 'clickFreq', label: 'Freq', unit: ' Hz', min: 300, max: 9000, step: 50 },
      { key: 'clickQ', label: 'Q', unit: '', min: 0.1, max: 20, step: 0.1 },
      { key: 'clickGain', label: 'Level', unit: '', min: 0, max: 1, step: 0.01 },
      { key: 'clickAttack', label: 'Attack', unit: ' ms', min: 0.2, max: 10, step: 0.1 },
      { key: 'clickDecay', label: 'Decay', unit: ' ms', min: 3, max: 150, step: 1 },
    ],
  },
  {
    group: 'Thump · sine sweep',
    rows: [
      { key: 'thumpStart', label: 'Start', unit: ' Hz', min: 30, max: 800, step: 5 },
      { key: 'thumpEnd', label: 'End', unit: ' Hz', min: 20, max: 800, step: 5 },
      { key: 'thumpGain', label: 'Level', unit: '', min: 0, max: 1, step: 0.01 },
      { key: 'thumpDecay', label: 'Decay', unit: ' ms', min: 5, max: 250, step: 1 },
    ],
  },
  { group: 'Output', rows: [{ key: 'master', label: 'Master', unit: '', min: 0, max: 2, step: 0.05 }] },
];

/** Built-in "fun" presets for the in-page config dialog. */
export const DETENT_PRESETS: Array<{ name: string; params: DetentParams }> = [
  { name: 'Detent', params: { ...DETENT_DEFAULTS } },
  {
    name: 'Thock',
    params: { clickFreq: 1800, clickQ: 1, clickGain: 0.35, clickAttack: 1, clickDecay: 30, thumpStart: 140, thumpEnd: 70, thumpGain: 0.28, thumpDecay: 60, master: 0.8 },
  },
  {
    name: 'Tick',
    params: { clickFreq: 6500, clickQ: 8, clickGain: 0.25, clickAttack: 0.5, clickDecay: 6, thumpStart: 300, thumpEnd: 300, thumpGain: 0, thumpDecay: 10, master: 0.8 },
  },
  {
    name: 'Clack',
    params: { clickFreq: 3800, clickQ: 0.6, clickGain: 0.45, clickAttack: 0.3, clickDecay: 14, thumpStart: 220, thumpEnd: 110, thumpGain: 0.18, thumpDecay: 30, master: 0.8 },
  },
  {
    name: 'Blip',
    params: { clickFreq: 2600, clickQ: 18, clickGain: 0.22, clickAttack: 1, clickDecay: 45, thumpStart: 640, thumpEnd: 320, thumpGain: 0.12, thumpDecay: 45, master: 0.7 },
  },
  {
    name: 'Bubble',
    params: { clickFreq: 900, clickQ: 12, clickGain: 0.3, clickAttack: 2, clickDecay: 40, thumpStart: 300, thumpEnd: 700, thumpGain: 0.2, thumpDecay: 70, master: 0.7 },
  },
];
