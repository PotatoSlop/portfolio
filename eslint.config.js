// Flat ESLint config — deliberately MINIMAL.
//
// This project had no linting; the point of adding ESLint is not "lint the
// codebase", it's to install ONE structural guardrail so the routing/lifecycle
// dual-state bug (docs/routing-and-lifecycle.md) can't silently come back. So
// no stylistic/recommended rule sets are enabled — only the two selectors
// below. Keeping it this tight means `npm run lint` is a signal, never noise.
//
// The bug: page/component behavior wired to a hand-rolled `astro:page-load`
// listener misses the FIRST in-app navigation into a page (the bundled module
// can evaluate after page-load already fired — no catch-up), and
// `DOMContentLoaded` never re-fires after a ClientRouter swap at all. Both make
// content "only render on a direct load / refresh". The sanctioned fix is
// onPageReady() in src/lib/motion/lifecycle.ts, which bakes in the catch-up.

import astro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

const lifecycleGuardrail = [
  'error',
  {
    selector:
      "CallExpression[callee.property.name='addEventListener'][arguments.0.value='astro:page-load']",
    message:
      "Don't hand-roll an astro:page-load listener — it misses the first in-app navigation into a page (no catch-up mount), the exact 'only renders on a direct load / refresh' bug. Route page/component behavior through onPageReady() in src/lib/motion/lifecycle.ts. See docs/routing-and-lifecycle.md §3.1. A genuinely global, bound-once handler with its own imperative catch-up may add `// eslint-disable-next-line no-restricted-syntax` with a comment saying why.",
  },
  {
    selector:
      "CallExpression[callee.property.name='addEventListener'][arguments.0.value='DOMContentLoaded']",
    message:
      "Don't use DOMContentLoaded for page content — it never re-fires after a ClientRouter SPA swap, so the content only initializes on a full load / refresh. Use onPageReady() in src/lib/motion/lifecycle.ts. See docs/routing-and-lifecycle.md §2.",
  },
];

export default [
  // Never lint build output, deps, or the standalone legacy prototype under
  // public/ (dead code, full of the very anti-patterns we ban — see the doc's
  // "Legacy" note; it is not part of the ClientRouter site).
  {
    ignores: ['dist/**', 'node_modules/**', '.astro/**', 'public/**'],
  },

  // Parser + <script>-extraction processor for .astro files. `flat/base` enables
  // NO rules — it only wires up parsing, which is exactly what we want.
  ...astro.configs['flat/base'],

  // The guardrail on plain TS/JS files.
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: { parser: tseslint.parser },
    rules: { 'no-restricted-syntax': lifecycleGuardrail },
  },

  // The guardrail on .astro frontmatter and on the TS/JS the processor extracts
  // from <script> blocks (the virtual `*.astro/*.{js,ts}` files) — where the
  // client-side listeners actually live. Parser comes from flat/base above.
  {
    files: ['**/*.astro', '**/*.astro/*.{js,ts}'],
    rules: { 'no-restricted-syntax': lifecycleGuardrail },
  },

  // lifecycle.ts IS the sanctioned implementation of the pattern, so it
  // necessarily contains the raw astro:page-load listener the rule bans.
  {
    files: ['src/lib/motion/lifecycle.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
];
