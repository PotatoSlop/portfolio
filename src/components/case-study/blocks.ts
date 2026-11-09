/*
  Case-study MDX blocks. Routes pass this map to <Content components={…} />, so a
  study's .mdx body can use <Callout>, <Stats>, <Figure>… without importing them.
  Plain Markdown is styled too: `##` = numbered section (and a contents entry),
  `###` = subhead, `> quote` = pull quote, a lone `![img](…)` = full-column figure.
  See docs/case-study-template.md.
*/
import Callout from './blocks/Callout.astro';
import Quote from './blocks/Quote.astro';
import Steps from './blocks/Steps.astro';
import Stats from './blocks/Stats.astro';
import Cards from './blocks/Cards.astro';
import Apps from './blocks/Apps.astro';
import Figure from './blocks/Figure.astro';
import Row from './blocks/Row.astro';
import Screens from './blocks/Screens.astro';
import Palette from './blocks/Palette.astro';
import Checklist from './blocks/Checklist.astro';
import Columns from './blocks/Columns.astro';
import Feature from './blocks/Feature.astro';
import Wall from './blocks/Wall.astro';
import WorkIndex from './blocks/WorkIndex.astro';
import Specs from './blocks/Specs.astro';
import SectionHeading from './blocks/SectionHeading.astro';

export const caseStudyBlocks = {
  // Markdown overrides (no tag to write: `##` maps here).
  h2: SectionHeading,
  Callout,
  Quote,
  Steps,
  Stats,
  Cards,
  Apps,
  Figure,
  Row,
  Screens,
  Palette,
  Checklist,
  Columns,
  Feature,
  Wall,
  WorkIndex,
  Specs,
};
