import js from '@eslint/js';
import globals from 'globals';

// Pragmatic baseline: eslint:recommended plus a small set of high-value
// correctness/hygiene rules. Lint covers code only — generated runtime state
// (dist/), datasets (data/), the digest-bound static inputs (data-static/),
// and the clinician review audit trail (docs/) are never linted.
export default [
  {
    ignores: [
      'node_modules/',
      'dist/',
      'data/',
      'data-static/',
      'docs/',
      'tools/',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.nodeBuiltin,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      'no-unused-vars': ['error', {
        args: 'all',
        argsIgnorePattern: '^_',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      // `== null` deliberately stays allowed: the codebase uses it as the
      // idiomatic null-or-undefined check.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
      // The codebase deliberately wraps caught errors into new
      // message-composed errors in many fail-closed paths; attaching `cause`
      // everywhere would change observable error shapes, which is a
      // behavioral change this lint setup must not force.
      'preserve-caught-error': 'off',
      // The crawler CLIs deliberately rethrow fetcher-close failures from
      // `finally` blocks as part of their fail-closed shutdown contract;
      // restructuring that control flow would be a behavioral change.
      'no-unsafe-finally': 'off',
    },
  },
  {
    // This module hand-encodes the approval-package policy as exhaustive
    // expected-shape constants; several are documentation of the frozen
    // policy shape and are not (yet) referenced by an assertion. Deleting
    // them would remove policy-encoding data, so unused ALL_CAPS constants
    // are tolerated here only.
    files: ['src/lib/interaction-approval-draft.mjs'],
    rules: {
      'no-unused-vars': ['error', {
        args: 'all',
        argsIgnorePattern: '^_',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^(_|[A-Z][A-Z0-9_]*$)',
      }],
    },
  },
];
