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
    },
  },

  // Must be last: turns off stylistic rules that would fight Prettier.
  prettier,
])
