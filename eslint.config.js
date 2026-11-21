// ESLint "flat config" (ESLint 9+): one array of config objects, applied in order.
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist/', 'coverage/']),

  js.configs.recommended,
  tseslint.configs.recommended,
  pluginVue.configs['flat/recommended'],

  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
    // TypeScript (vue-tsc) already reports undefined names; ESLint's version misfires on browser globals.
    rules: { 'no-undef': 'off' },
  },

  // Layer rule (CLAUDE.md / ADR 0002): simulation must stay framework-, DOM- and renderer-free.
  {
    files: ['src/simulation/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['vue', 'vue/*', '@vue/*'],
              message: 'Simulation code must not depend on Vue (ADR 0002).',
            },
            {
              group: [
                '**/render',
                '**/render/**',
                '**/input',
                '**/input/**',
                '**/app',
                '**/app/**',
              ],
              message:
                'Simulation must not import render/input/app layers (see architecture overview).',
            },
          ],
        },
      ],
      // Browser APIs and wall-clock time don't belong in a deterministic, testable simulation.
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'navigator',
          'localStorage',
          'requestAnimationFrame',
          'cancelAnimationFrame',
          'performance',
        ].map((name) => ({
          name,
          message: 'Simulation must not use browser APIs (ADR 0002); pass data in from app/.',
        })),
      ],
      // Unseeded randomness and real time silently break determinism.
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded rng (src/simulation/rng.ts) so behavior is reproducible.',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'Use world.time; simulation time comes from fixed steps.',
        },
      ],
    },
  },

  // Must be last: turns off stylistic rules that would fight Prettier.
  prettier,
])
