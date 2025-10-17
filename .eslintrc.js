module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'import', 'node', 'promise', 'prettier'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:node/recommended',
    'plugin:promise/recommended',
    'prettier',
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // Enforce ES6+ patterns
    'prefer-const': 'error',
    'no-var': 'error',
    'prefer-arrow-callback': 'error',
    'func-style': ['error', 'declaration', { allowArrowFunctions: false }], // Allow arrow functions but prefer declarations for named functions
    'prefer-destructuring': ['error', 'always'],
    'object-shorthand': ['error', 'always'],
    'prefer-template': 'error',

    // Enforce arrow functions over function expressions
    '@typescript-eslint/prefer-function-type': 'error',

    // Object-oriented architecture enforcement
    'class-methods-use-this': 'off', // Allow static methods
    '@typescript-eslint/explicit-member-accessibility': [
      'error',
      { accessibility: 'explicit' },
    ],
    '@typescript-eslint/member-ordering': [
      'error',
      {
        default: ['signature', 'field', 'constructor', 'method'],
      },
    ],

    // Import/Export rules for ES6 modules
    'import/no-default-export': 'error',
    'import/prefer-default-export': 'off', // Disable since we want named exports
    'import/no-amd': 'error',
    'import/no-commonjs': 'error',
    'import/no-dynamic-require': 'error',
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        'newlines-between': 'always',
      },
    ],

    // Node.js specific rules
    'node/no-unsupported-features/es-syntax': 'off', // Allow ES2022 features
    'node/no-missing-import': 'off', // Let TypeScript handle this

    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off', // Allow inferred return types
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',

    // Promise rules
    'promise/always-return': 'off', // Can be too restrictive
    'promise/no-return-wrap': 'error',
    'promise/param-names': 'error',
    'promise/catch-or-return': 'error',
    'promise/no-native': 'off',
    'promise/no-nesting': 'warn',
    'promise/no-promise-in-callback': 'warn',
    'promise/no-callback-in-promise': 'warn',
    'promise/avoid-new': 'off',
    'promise/no-new-statics': 'error',
    'promise/no-return-in-finally': 'warn',
    'promise/valid-params': 'error',

    // General code quality
    'no-console': 'off', // Allow console for CLI tools
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-sequences': 'error',
    'no-throw-literal': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-unused-labels': 'error',
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-useless-escape': 'error',
    'no-useless-return': 'error',
    'no-void': 'error',
    'no-with': 'error',
    radix: 'error',
    'require-await': 'off', // Allow non-async functions that return promises
    strict: ['error', 'global'],
    'no-shadow': 'off', // TypeScript handles this better
    '@typescript-eslint/no-shadow': 'error',

    // Prettier integration
    'prettier/prettier': 'error',
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
      },
    },
  },
};
