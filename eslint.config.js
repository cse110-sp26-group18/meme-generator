const globals = require('globals');

module.exports = [
  {
    files: ['meme-app/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      // standard variables from browser that are allowed
      globals: {
        ...globals.browser,
        MemeGen: 'readonly',
      },
    },
    rules: {
      // syntax errors
      'no-undef': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      // style violations
      'no-unused-vars': 'warn',
      'no-console': 'warn',
    },
  },
];
