import fs from 'node:fs';
import path from 'node:path';

/*
  resumes.ts — build-time discovery of résumé PDFs.

  Instead of hardcoding one link per résumé, we scan the public documents folder
  at build time (Astro frontmatter runs on Node) and derive each entry's variant
  + version straight from its filename. Drop a new PDF into
  public/Assets/documents and it shows up in the dropdown on the next build — no
  code edit.

  Filename contract (matches the existing files):
    "Dylan Chen Resume - <Variant> <M>_<YY>.pdf"
    e.g. "Dylan Chen Resume - Hardware 9_26.pdf"
  The variant is whatever sits between "Resume -" and the trailing M_YY version.
  The version is OPTIONAL — a bare "... Resume - Hardware.pdf" still resolves (it
  just carries no date), so the model degrades gracefully if the convention drifts.
*/

export interface ResumeLink {
  /** Human variant label, e.g. "Hardware" / "Software". */
  variant: string;
  /** Raw version token as written ("9_26"), or null when absent. */
  version: string | null;
  /** Friendly date, e.g. "Sep 2026", or null when no version parsed. */
  dateLabel: string | null;
  /** Public, URL-encoded href to the PDF. */
  href: string;
  /** Original filename (for the download attribute / debugging). */
  filename: string;
  /** year*100 + month, for "newest wins" + ordering; 0 when undated. */
  sortKey: number;
}

const DOCS_DIR = path.join(process.cwd(), 'public', 'Assets', 'documents');
const PUBLIC_BASE = '/Assets/documents';
const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "... Resume - <variant> [<month>_<year>].pdf" — variant lazy so it stops at the
// optional trailing version; separators tolerant of - _ . / and en/em dashes.
const RESUME_RE = /resume\s*[-–—]\s*(.+?)(?:[\s_]+(\d{1,2})[._/-](\d{2,4}))?\.pdf$/i;

const toFullYear = (yy: string): number => (yy.length <= 2 ? 2000 + Number(yy) : Number(yy));

export function getResumes(): ResumeLink[] {
  let files: string[];
  try {
    files = fs.readdirSync(DOCS_DIR);
  } catch {
    // Folder missing (e.g. mid-refactor) — no résumés rather than a build crash.
    return [];
  }

  const links = files
    .filter((f) => f.toLowerCase().endsWith('.pdf') && /resume/i.test(f))
    .map((filename): ResumeLink | null => {
      const m = RESUME_RE.exec(filename);
      if (!m) return null;
      const variant = m[1].trim();
      const month = m[2] ? Number(m[2]) : null;
      const year = m[3] ? toFullYear(m[3]) : null;
      const dated = month != null && year != null && month >= 1 && month <= 12;
      return {
        variant,
        version: m[2] && m[3] ? `${m[2]}_${m[3]}` : null,
        dateLabel: dated ? `${MONTHS[month!]} ${year}` : null,
        filename,
        href: `${PUBLIC_BASE}/${encodeURIComponent(filename)}`,
        sortKey: dated ? year! * 100 + month! : 0,
      };
    })
    .filter((x): x is ResumeLink => x !== null);

  // Collapse to the newest file per variant, then order variants alphabetically
  // for a stable menu.
  const newest = new Map<string, ResumeLink>();
  for (const link of links) {
    const key = link.variant.toLowerCase();
    const cur = newest.get(key);
    if (!cur || link.sortKey > cur.sortKey) newest.set(key, link);
  }
  return [...newest.values()].sort((a, b) => a.variant.localeCompare(b.variant));
}
