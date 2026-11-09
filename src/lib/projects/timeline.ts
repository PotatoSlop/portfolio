/*
  timeline.ts — date ordering + featured-project selection for discipline pages.

  Dates in the `projects` collection are loose strings: 'Apr 2025', 'Sep 2025',
  '2024'. `when()` turns them into a sortable number (year + month/12).

  Featured selection (pickFeatured) is a strict cascade — the first tier that has
  any candidate wins, and "first in the list" is never used as a default:
    1. MANUAL   a project flagged `hero: true` (if several, the most recent one)
    2. SHIPPED  the most recently COMPLETED project (status 'shipped'), ranked by
                its end date (falling back to its start date)
    3. ANY      the most recent project regardless of status, by start date
*/
import type { CollectionEntry } from 'astro:content';

type Project = CollectionEntry<'projects'>;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** 'Apr 2025' → 2025.25, '2024' → 2024. Unparseable → NaN; missing → undefined. */
export function when(s?: string): number | undefined {
  if (!s) return undefined;
  const m = s.trim().match(/^(?:([A-Za-z]{3})[A-Za-z]*\.?\s+)?(\d{4})$/);
  if (!m) return Number.NaN;
  const mi = m[1] ? MONTHS.indexOf(m[1].toLowerCase()) : 0;
  return Number(m[2]) + Math.max(0, mi) / 12;
}

const num = (v: number | undefined, fallback: number) => (v === undefined || Number.isNaN(v) ? fallback : v);

/**
 * Comparator for timeline order. dir = 1 → oldest first (No. 01 = earliest
 * build); dir = -1 → newest first. Ties fall back to end date (ongoing work,
 * with no end, sorts after anything that ended), then the manual `order` field.
 */
export function byTimeline(dir: 1 | -1 = 1) {
  return (a: Project, b: Project) =>
    dir * (num(when(a.data.started), 0) - num(when(b.data.started), 0)) ||
    dir * (num(when(a.data.ended), Infinity) - num(when(b.data.ended), Infinity)) ||
    a.data.order - b.data.order;
}

/** The latest of `list` by `key` (ties → lower `order`). */
function latest(list: Project[], key: (p: Project) => number): Project {
  return list.reduce((best, p) => {
    const d = key(p) - key(best);
    return d > 0 || (d === 0 && p.data.order < best.data.order) ? p : best;
  });
}

const startKey = (p: Project) => num(when(p.data.started), -Infinity);
const completedKey = (p: Project) => num(when(p.data.ended), startKey(p));

/** Featured project by the manual → most-recent-shipped → most-recent cascade. */
export function pickFeatured(projects: Project[]): Project | null {
  if (!projects.length) return null;
  const manual = projects.filter((p) => p.data.hero);
  if (manual.length) return latest(manual, startKey);
  const shipped = projects.filter((p) => p.data.status === 'shipped');
  if (shipped.length) return latest(shipped, completedKey);
  return latest(projects, startKey);
}
