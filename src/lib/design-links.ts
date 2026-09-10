import type { CollectionEntry } from 'astro:content';

/*
  Single source of truth for what a design card DOES when clicked. Both the
  drift rows (MarqueeRow) and the master grid (FilterGrid) resolve every entry
  through this so gating + dead-link neutralisation stay identical across them.

  Kinds:
    model — a 3D piece with a wired `.glb`; opens the interactive viewer modal.
    case  — a UI/UX piece whose case study has been WRITTEN (caseStudy: true);
            navigates to /design/<id>.
    gated — a UI/UX piece with NO case study yet; shows the WIP "case study in
            progress" state and does NOT navigate (the point of the switch:
            UI/UX has no value as a bare thumbnail, so we don't dead-end into one).
    link  — a real outbound/internal destination (Figma, external, real route).
    dead  — anything else (href '#' / missing, no viewer, not gated). Rendered
            inert so a placeholder card never leads to a broken destination.

  Only `link` and `case` actually navigate; the rest are intercepted in
  src/lib/motion/design-actions.ts.
*/
export type CardAction =
  | { kind: 'model'; glb: string }
  | { kind: 'case'; href: string }
  | { kind: 'link'; href: string }
  | { kind: 'gated' }
  | { kind: 'dead' };

const isRealHref = (href?: string): href is string =>
  !!href && href !== '#' && (/^https?:\/\//.test(href) || href.startsWith('/'));

export function resolveCardAction(entry: CollectionEntry<'design'>): CardAction {
  const { category, glb, caseStudy, href } = entry.data;

  if (category === '3d' && glb) return { kind: 'model', glb };
  if (category === 'uiux') {
    return caseStudy ? { kind: 'case', href: `/design/${entry.id}` } : { kind: 'gated' };
  }
  if (isRealHref(href)) return { kind: 'link', href };
  return { kind: 'dead' };
}

/* Does this card navigate on click (real anchor) vs. get intercepted by JS? */
export const cardNavigates = (a: CardAction): a is Extract<CardAction, { href: string }> =>
  a.kind === 'link' || a.kind === 'case';

/* The ONE category label shown in a card's corner chip — mirrors the filter chips
   so the badge always names a real filter (code matches UI). One tag per card:
   discipline first, then the 2D sub-category by priority. */
export function primaryTagLabel(entry: CollectionEntry<'design'>): string {
  const { category, tags = [] } = entry.data;
  if (category === '3d') return '3D';
  if (category === 'uiux') return 'UI / UX';
  if (tags.includes('game-asset')) return 'Game Asset';
  if (tags.includes('design')) return 'Design';
  if (tags.includes('illustration')) return 'Illustration';
  return '2D';
}

/* Inline object-fit/position overrides for a gallery cover/sprite <img>, from the
   entry's coverFit/coverPosition. Returns undefined when neither is set so the
   component's default framing (cover / .g-sprite contain) stands. */
export function coverStyle(d: { coverFit?: string; coverPosition?: string }): string | undefined {
  const parts: string[] = [];
  if (d.coverFit) parts.push(`object-fit:${d.coverFit}`);
  if (d.coverPosition) parts.push(`object-position:${d.coverPosition}`);
  return parts.length ? parts.join(';') : undefined;
}
