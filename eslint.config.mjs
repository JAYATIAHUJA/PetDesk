import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

const rendererFiles = ['renderer.mjs', 'settings.mjs', 'src/engine/**/*.mjs', 'src/pet/**/*.mjs', 'src/ui/**/*.mjs'];

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    // Main process, scripts and tests run in Node
    files: ['**/*.mjs'],
    ignores: rendererFiles,
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.node },
  },
  {
    // Sandboxed renderers: browser globals only, no Node
    files: rendererFiles,
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.browser },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: globals.node },
  },
  {
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-case-declarations': 'off', // the pet state machine declares per-state locals inside its switch
    },
  },
  prettier,
];
