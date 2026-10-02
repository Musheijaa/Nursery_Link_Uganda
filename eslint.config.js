import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/dev-dist/**', '**/node_modules/**', 'coverage/**', 'data/**', '.kilo/**', '**/migrations/**', 'packages/api-client/src/schema.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.js', 'playwright.config.ts', 'packages/shared/vitest.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // An empty catch hides failures; every catch must handle or rethrow
      'no-empty': ['error', { allowEmptyCatch: false }],
    },
  },
  {
    // Browser code: the two frontends and the shared UI package
    files: ['apps/web/**/*.{ts,tsx}', 'apps/admin/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}', 'packages/api-client/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      // Components may take focus where a screen has a single job (e.g. the SMS code entry);
      // plain DOM autoFocus is still flagged
      'jsx-a11y/no-autofocus': ['error', { ignoreNonDOM: true }],
      // A sideways-scrolling table is a focusable, labelled region, so keyboard users can scroll it (axe: scrollable-region-focusable)
      'jsx-a11y/no-noninteractive-tabindex': ['error', { tags: [], roles: ['tabpanel', 'region'] }],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
);
