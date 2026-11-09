# Case-study template

One theme-agnostic page template for long-form project write-ups. It runs today on
`/design/<id>`. Engineering and software can reuse it unchanged: the template only
reads `--cs-*` tokens, and those map onto each theme's `--theme-*` contract.

| Piece | File |
|---|---|
| Page shell (hero, cover, at-a-glance, body, next study) | `src/components/case-study/CaseStudy.astro` |
| MDX blocks | `src/components/case-study/blocks/*.astro`, exported as a map from `blocks.ts` |
| Styles (global, namespaced `.cs`) | `styles/components/case-study.css` |
| Design route | `src/pages/design/[slug].astro` |
| Gating (route and cards) | `hasLiveCaseStudy()` / `caseLayoutOf()` in `src/lib/design-links.ts` |

## Publishing a design study

1. Rename the entry `src/content/design/<id>.md` to `.mdx` (the collection loads both).
2. In the frontmatter, set `caseStudy: true` and `draft: true`.
3. Fill in the hero fields: `summary` (the lede), `role`, `timeline`, `team`, `tools`.
   Optional: `facts` (extra meta), `links` (hero buttons), `glance` (the
   Problem / Approach / Outcome cards), `coverCaption`, `eyebrow`, `caseLayout`.
4. Write the body (see below), and check it with `npm run dev` at `/design/<id>`.
   A **Draft** pill marks the page.
5. Remove `draft: true` to ship it. Production builds skip drafts entirely: there is
   no page, and the card stays gated (UI/UX) or inert (2D).

**Locking a study (`wip: true`).** For a project too early to write up, add
`wip: true`. The page then renders only the hero (title, summary, meta) and the
shared "case study in progress" notice (`StubNotice.astro`) in **every** build,
dev included, and the card links to that stub. The cover, glance cards, links,
body and gallery are withheld, and the study is left out of the "next study"
rotation. The body can stay in the file. Remove the flag to unlock it (`draft`
then applies as usual).

`m8s.mdx` is the UX-layout example, a draft with placeholder copy.
`red-cross-poster.mdx` shows the visual layout, but 2D work is hidden from the
site (`isOnSite()` in `src/lib/design-links.ts`), so that page is not built at the
moment. Its body still shows how the visual blocks are written.

## Layouts

- **ux** (default for `uiux`): text-led. The `##` headings become numbered sections
  and the sticky contents list. Prose holds a ~66ch measure, and blocks span the full
  column. Below 1000px the contents list collapses into a sticky chip rail.
- **visual** (default for `2d` / `3d`): image-led. There is no contents list. Art sits
  on mats and is never cropped. Paragraphs become a centred statement column.

Set `caseLayout: ux | visual` to override the default.

## Writing the body

Plain Markdown is styled:

- `##` is a numbered section and a contents entry.
- `###` is a subhead.
- `> quote` is a pull quote.
- A lone `![alt](src)` is a full-column figure.

The blocks are available by name, with no imports. Any figure without a `src`
renders as a hatched placeholder, so you can lay out a study before its images
exist.

| Block | Use |
|---|---|
| `<Callout label?>text</Callout>` | Problem statement / "How might we…" |
| `<Steps steps={[{label, note?}]} />` | Process timeline |
| `<Stats items={[{value, label}]} />` | Key numbers |
| `<Quote cite?>text</Quote>` | Pull quote with attribution |
| `<Cards items={[{title, text, kicker?}]} kickerPrefix? />` | Insights, principles |
| `<Apps items={[{name, icon?, meta?, inset?}]} />` | Labeled app icons (competitors, references): 4-up row, 2×2 below 768px. Missing `icon` file → monogram tile; `inset` pads a transparent free-form icon on a white plate |
| `<Figure src? alt? caption? label? ratio? mat? placeholder? />` | One figure. Omit `label` to auto-number ("Fig. 01"); `label={false}` drops it |
| `<Row items={[{src?, caption?, label?, chip?, placeholder?}]} cols? mat? ratio? />` | Before/after (`chip`), pairs (`mat`), 3–4 up process strips |
| `<Screens items={[{label, src?}]} />` | Snap-scrolling phone screens |
| `<Palette colors={[{name, hex}]} font?={{family, href?, note?, weights?}} />` | Design-system snapshot |
| `<Checklist>` + a Markdown list | Ticked results |
| `<Columns cols={[{label, items: []}]} />` | "What worked" / "Next time" |
| `<Feature src title kicker? specs?>notes</Feature>` | Visual: piece + sticky side note |
| `<Wall src label? caption? />` | Visual: one piece on a full-bleed block |
| `<WorkIndex items={[{src, label, href?}]} />` | Visual: catalogue of the series |
| `<Specs items={[{label, value}]} />` | Ruled facts table |

## Reusing it for engineering or software

Add a route such as `src/pages/engineering/[slug].astro` that maps a `projects`
entry onto the same `<CaseStudy>` props, inside `<Base theme="engineering">`, and
renders `<Content components={caseStudyBlocks} />`. Nothing in the template changes.

The theme idioms come along automatically:

- **Engineering**: a drafting dot grid behind the hero, an ink-block eyebrow, square
  corners, and Syne for display text.
- **Software**: a `>` prompt and a blinking caret on the title, and `// 01` section
  numbers. Mono is used for labels, but prose stays in IBM Plex Sans, because mono
  is tiring to read at paragraph length.

To theme a new discipline, override `--cs-*` tokens under `[data-theme='x'] .cs` in
`case-study.css`. Never restyle individual blocks.
