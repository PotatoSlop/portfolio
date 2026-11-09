import type { CollectionEntry } from 'astro:content';

/*
  Single source of truth for what a design card DOES when clicked. Both the
  drift rows (MarqueeRow) and the master grid (FilterGrid) resolve every entry
  through this so gating + dead-link neutralisation stay identical across them.

  Kinds:
    model — a 3D piece with a wired `.glb`; opens the interactive viewer modal.
    case  — a piece whose case study has been WRITTEN (caseStudy: true; a
            `draft` study only counts in `astro dev`), or one locked with
            `wip: true` (its page is the shared stub); navigates to /design/<id>.
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

/* Is this entry shown on the site at all? 2D work (illustration, design/branding,
   game assets) was taken off the site in Nov 2026 — Photography took its place.
   The 2D entries and their images are KEPT in src/content/design and
   public/Assets/design/2d; delete '2d' from this list to bring them back. */
const HIDDEN_CATEGORIES: ReadonlyArray<CollectionEntry<'design'>['data']['category']> = ['2d'];
export const isOnSite = (entry: CollectionEntry<'design'>): boolean =>
  !HIDDEN_CATEGORIES.includes(entry.data.category);

/* Does this entry have a case-study page in THIS build? Drafts exist only under
   `astro dev`, so a half-written study never ships. The /design/[slug] route and
   the card resolver both use this, so a card can't link to a page that wasn't built. */
export const hasLiveCaseStudy = (entry: CollectionEntry<'design'>): boolean =>
  isOnSite(entry) && entry.data.caseStudy && !entry.data.wip && (!entry.data.draft || import.meta.env.DEV);

/* `wip: true` locks a study behind the shared stub page in every build. Its
   body is never rendered, and it's left out of the "next study" rotation. */
export const isWipStudy = (entry: CollectionEntry<'design'>): boolean => isOnSite(entry) && entry.data.wip;

/* Does /design/<id> exist in this build at all (real study or WIP stub)? */
export const hasCasePage = (entry: CollectionEntry<'design'>): boolean => hasLiveCaseStudy(entry) || isWipStudy(entry);

/* Template layout for an entry's study: explicit `caseLayout`, else by category. */
export const caseLayoutOf = (entry: CollectionEntry<'design'>): 'ux' | 'visual' =>
  entry.data.caseLayout ?? (entry.data.category === 'uiux' ? 'ux' : 'visual');

export function resolveCardAction(entry: CollectionEntry<'design'>): CardAction {
  const { category, glb, href } = entry.data;

  if (category === '3d' && glb) return { kind: 'model', glb };
  if (hasCasePage(entry)) return { kind: 'case', href: `/design/${entry.id}` };
  if (category === 'uiux') return { kind: 'gated' };
  if (isRealHref(href)) return { kind: 'link', href };
  return { kind: 'dead' };
}

/* Does this card navigate on click (real anchor) vs. get intercepted by JS? */
export const cardNavigates = (a: CardAction): a is Extract<CardAction, { href: string }> =>
  a.kind === 'link' || a.kind === 'case';

/* The ONE category label shown in a card's corner chip — mirrors the filter chips
   so the badge always names a real filter (code matches UI). Photo tiles label
   themselves "Photo" in FilterGrid. */
export function primaryTagLabel(entry: CollectionEntry<'design'>): string {
  const { category } = entry.data;
  return category === '3d' ? '3D' : category === 'uiux' ? 'UI / UX' : category.toUpperCase();
}

/* Inline object-fit/position overrides for a gallery cover <img>, from the
   entry's coverFit/coverPosition. Returns undefined when neither is set so the
   component's default framing (object-fit: cover) stands. */
export function coverStyle(d: { coverFit?: string; coverPosition?: string }): string | undefined {
  const parts: string[] = [];
  if (d.coverFit) parts.push(`object-fit:${d.coverFit}`);
  if (d.coverPosition) parts.push(`object-position:${d.coverPosition}`);
  return parts.length ? parts.join(';') : undefined;
}
