/*
  TEMPORARY whole-page stub for /design.

  While DESIGN_WIP is true, every design surface (hero, drift rows, masonry, master
  grid) renders BLANK placeholder cards instead of real project content — the page
  is an intentional WIP skeleton (a notice sits under the hero). This trades the
  section's usability for a clean, unfinished-but-tidy look while the real gallery +
  case studies are built out.

  To restore the real, data-driven gallery: flip DESIGN_WIP to false (the resolver
  wiring in design-links.ts and every component's real branch are still intact), or
  delete this module and the `DESIGN_WIP` imports/branches that reference it.
*/
// Annotated `boolean` (not the inferred `true` literal) so both the stub and real
// branches always type-check and flipping this value never shifts inference.
export const DESIGN_WIP: boolean = false;

// Blank-card counts per surface, tuned to fill each layout without real data.
export const STUB_COUNTS = { row: 6, masonry: 8, grid: 8 } as const;

// Blank tiles carry every filter key so the master-grid chips never hide them
// (filtering a skeleton to empty would look broken).
export const STUB_TAGS = 'all 3d uiux 2d game-asset';

export const stubList = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
