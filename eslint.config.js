import js from '@eslint/js';
import globals from 'globals';

/**
 * Flat ESLint config.
 *
 * The project deliberately avoids a build step, so this is the single source
 * of truth for code style + the security guard that forbids innerHTML-style
 * DOM injection of API data.
 */
export default [
  {
    ignores: ['node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      // Security guard: never inject API data as HTML.
      'no-restricted-properties': [
        'error',
        {
          property: 'innerHTML',
          message: 'Never use innerHTML with (API) data. Build DOM with createElement/textContent.',
        },
        {
          property: 'outerHTML',
          message: 'Never use outerHTML with (API) data. Build DOM with createElement/textContent.',
        },
        {
          object: 'document',
          property: 'write',
          message: 'document.write is forbidden.',
        },
        {
          object: 'document',
          property: 'writeln',
          message: 'document.writeln is forbidden.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: 'insertAdjacentHTML is forbidden. Build DOM with createElement/textContent.',
        },
      ],
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
];
