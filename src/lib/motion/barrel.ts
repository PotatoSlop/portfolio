// Barrel (fisheye) lens distortion for the engineering-page dot field.
//
// The lens magnifies points near its centre and eases to no distortion at the
// rim, so the dot lattice bulges outward like a wide-angle camera. `distort`
// maps a lattice point to where it appears on screen; `undistort` is its inverse,
// used to find which lattice dot the cursor is visually hovering over.

export interface BarrelLens {
  /** Lens centre in screen pixels (fixed at the viewport centre). */
  centerX: number;
  centerY: number;
  /** Distortion reaches zero at this radius from the centre. */
  radius: number;
  /** Peak magnification at the centre, e.g. 0.18 = up to 18% larger. */
  strength: number;
  /** Field-wide offset applied before distortion, driving the parallax drift. */
  parallaxX: number;
  parallaxY: number;
}

export function createBarrelLens(strength: number): BarrelLens {
  return { centerX: 0, centerY: 0, radius: 1, strength, parallaxX: 0, parallaxY: 0 };
}

/**
 * Map a lattice point to its on-screen position.
 *
 * Returns `[screenX, screenY, radiusScale]`, where `radiusScale` swells dots
 * near the centre so they read as physically closer to the lens.
 */
export function distort(lens: BarrelLens, x: number, y: number): [number, number, number] {
  const shiftedX = x + lens.parallaxX;
  const shiftedY = y + lens.parallaxY;
  const offsetX = shiftedX - lens.centerX;
  const offsetY = shiftedY - lens.centerY;
  const distance = Math.hypot(offsetX, offsetY);

  if (distance >= lens.radius) {
    return [shiftedX, shiftedY, 1];
  }

  const rimFraction = distance / lens.radius; // 0 at centre, 1 at rim
  const magnification = 1 + lens.strength * (1 - rimFraction * rimFraction);
  const radiusScale = 1 + (magnification - 1) * 0.6;
  return [
    lens.centerX + offsetX * magnification,
    lens.centerY + offsetY * magnification,
    radiusScale,
  ];
}

/**
 * Approximate on-screen spacing of the lattice near a screen point — how far
 * apart two adjacent grid rows *appear* after distortion. The barrel stretches
 * rows apart toward the centre (returns > `latticeSpacing`) and compresses them
 * toward the rim. Used to size a distortion-aware tolerance for hit-testing the
 * grid-snapped trail against the (undistorted) wordmark.
 */
export function screenGridPitch(lens: BarrelLens, screenX: number, screenY: number, latticeSpacing: number): number {
  const offsetX = screenX - lens.centerX;
  const offsetY = screenY - lens.centerY;
  const radius = Math.hypot(offsetX, offsetY);
  if (radius >= lens.radius) return latticeSpacing;
  // Local radial stretch is g'(r), the derivative of the forward radius map.
  const stretch = 1 + lens.strength * (1 - (3 * radius * radius) / (lens.radius * lens.radius));
  return latticeSpacing * stretch;
}

/**
 * Inverse of `distort`: map a screen point back to its lattice point.
 *
 * The forward map sends a radius r to g(r) = r + strength·r·(1 − r²/radius²).
 * That stays monotonic for strength below ~0.5, so a few Newton steps recover r
 * from the on-screen radius; then we undo the parallax offset.
 */
export function undistort(lens: BarrelLens, screenX: number, screenY: number): [number, number] {
  const offsetX = screenX - lens.centerX;
  const offsetY = screenY - lens.centerY;
  const screenRadius = Math.hypot(offsetX, offsetY);

  let latticeX = screenX;
  let latticeY = screenY;

  if (screenRadius > 0.001 && screenRadius < lens.radius) {
    const radiusSquared = lens.radius * lens.radius;
    let radius = screenRadius; // g(r) ≥ r, so the true radius is a touch smaller — a good seed
    for (let step = 0; step < 6; step++) {
      const distorted = radius + lens.strength * radius * (1 - (radius * radius) / radiusSquared);
      const slope = 1 + lens.strength * (1 - (3 * radius * radius) / radiusSquared);
      radius -= (distorted - screenRadius) / slope;
    }
    const scale = radius / screenRadius;
    latticeX = lens.centerX + offsetX * scale;
    latticeY = lens.centerY + offsetY * scale;
  }

  return [latticeX - lens.parallaxX, latticeY - lens.parallaxY];
}
