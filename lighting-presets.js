/*
  lighting-presets.js
  -------------------
  Per-model lighting/rendering configurations for the 3D viewer.

  Each preset describes the full scene look — background, tone mapping,
  whether to use an environment map, env intensity, and the light rig.
  viewer3d.js looks up a preset by name (read from the model card's
  data-lighting-preset attribute) and applies it.

  Adding a new preset:
  1. Add an entry below with the same shape as 'boat' or 'mecha'.
  2. Add data-lighting-preset="<your-key>" to the button in HTML.
  Done.

  Light types supported by viewer3d.js's createLight():
    - { type: 'ambient', color, intensity }
    - { type: 'hemisphere', skyColor, groundColor, intensity, position?: [x,y,z] }
    - { type: 'directional', color, intensity, position?: [x,y,z] }

  Tone mapping options (string -> THREE constant in viewer3d.js):
    'NoToneMapping' | 'Linear' | 'Cineon' | 'Reinhard' | 'ACESFilmic'
*/

export const lightingPresets = {

  // -----------------------------------------------------------------
  // BOAT — original pre-refactor lighting.
  // No env map, warm ambient, strong directional key. ACES tone mapping
  // for some baked filmic contrast. Good for low-poly stylised assets
  // where physical realism isn't the goal.
  // -----------------------------------------------------------------
  boat: {
    background: 0xf0f0f0,
    toneMapping: 'ACESFilmic',
    toneMappingExposure: 1.0,
    useEnvironment: false,
    envMapIntensity: 1.0,
    lights: [
      { type: 'ambient', color: 0xfff0d9, intensity: 2 },
      { type: 'directional', color: 0xffffff, intensity: 5, position: [5, 10, 7.5] },
    ],
  },

  // -----------------------------------------------------------------
  // MECHA — Blender-default-ish flat industrial render.
  // Linear tone mapping, neutral mid-gray background, low-intensity
  // RoomEnvironment, hemi+key+ambient lighting. Brighter hemi ground
  // color and ambient lift shadow detail without blowing highlights.
  // -----------------------------------------------------------------
  mecha: {
    background: 0x777777,
    toneMapping: 'Linear',
    toneMappingExposure: 0.9,
    useEnvironment: true,
    envMapIntensity: 0.4,
    lights: [
      // Hemi: skyColor stays neutral light gray; groundColor bumped from
      // 0x404040 -> 0x707070 to lift the underside of forms. This is the
      // primary "show me detail in shadows" dial.
      { type: 'hemisphere', skyColor: 0xeeeeee, groundColor: 0x707070, intensity: 1.2, position: [0, 1, 0] },

      // Key: soft white from above-front-right.
      { type: 'directional', color: 0xffffff, intensity: 1.8, position: [3, 6, 5] },

      // Ambient: bumped from 0.25 -> 0.45 to globally lift shadow detail.
      // Push higher (0.6+) if the model is still too dark in pockets.
      { type: 'ambient', color: 0xffffff, intensity: 0.45 },
    ],
  },

};

// Fallback when a button has no data-lighting-preset, or the preset name
// doesn't match a known key.
export const DEFAULT_PRESET = 'mecha';
