import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Locked data model — see SCHEMA.md. Change only with a deliberate reason.
const DISCIPLINES = ['engineering', 'design', 'software'] as const;
const SUBTAGS = [
  'hardware',
  'firmware',
  '3d',
  'illustration',
  'uiux',
  'webdev',
  'gamedev',
] as const;

const projects = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      status: z.enum(['shipped', 'wip']),
      // Non-empty: every project belongs to ≥1 discipline. Multiple = cross-functional.
      disciplines: z.array(z.enum(DISCIPLINES)).min(1),
      subTags: z.array(z.enum(SUBTAGS)).default([]),
      hero: z.boolean().default(false),
      order: z.number().default(0),
      // Optional so frontmatter-only WIP stubs validate.
      cover: image().optional(),
      glb: z.string().optional(),
      gallery: z.array(image()).default([]),
      // Outbound CTAs — most light projects are primarily a card + one of these.
      links: z
        .object({
          repo: z.string().url().optional(),
          live: z.string().url().optional(),
          download: z.string().url().optional(),
        })
        .optional(),
      overview: z.string().optional(),
      process: z.string().optional(),
      outcome: z.string().optional(),
      // Validated refs; point these ACROSS disciplines on purpose.
      related: z.array(reference('projects')).default([]),
    }),
});

export const collections = { projects };
